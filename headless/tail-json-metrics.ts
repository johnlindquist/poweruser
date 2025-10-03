#!/usr/bin/env bun
// Batch tail of JSON logs → compact SLO/latency + error digest every INTERVAL secs.

const FILE = Bun.env.FILE;
if (!FILE) {
  console.error("Usage: FILE=/path/to/json.log [INTERVAL=300] [MAX_CHARS=3500] [TOP=5] bun run headless/tail-json-metrics.ts");
  process.exit(2);
}
const INTERVAL = Number(Bun.env.INTERVAL || 300);
const MAX_CHARS = Number(Bun.env.MAX_CHARS || 3500);
const TOP = Number(Bun.env.TOP || 5);
const INIT = Bun.env.INIT || `You'll receive compact 5-minute metrics from ${FILE}. Provide brief insights and potential causes.`;

// ---- helpers ----
async function* readLines(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.trim() !== "") yield line;
    }
  }
  if (buf.trim() !== "") yield buf;
}

function writeLine(sink: typeof claude.stdin, line: string) {
  sink.write(new TextEncoder().encode(line));
}

function userText(text: string) {
  return JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text }] } }) + "\n";
}

// ---- Claude ----
const claude = Bun.spawn({ cmd: ["claude", "-p", "--output-format=stream-json", "--input-format=stream-json", "--verbose"], stdin: "pipe", stdout: "pipe", stderr: "pipe" });
function sendToClaude(text: string) { writeLine(claude.stdin, userText(text)); }
sendToClaude(INIT);

// ---- aggregation ----
let total = 0, errors = 0;
const latencies: number[] = [];
const byPath = new Map<string, { count: number; slowest: number }>();
const errorPatterns = new Map<string, { count: number; samples: string[] }>();
let windowStart = Date.now();

function num(x: any): number | null {
  if (typeof x === "number" && isFinite(x)) return x;
  if (typeof x === "string" && x.trim()) {
    const v = Number(x); return isFinite(v) ? v : null;
  }
  return null;
}
function normalizeMsg(s: string): string {
  return s
    .replace(/\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, "<ts>")
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "<ip>")
    .replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b/g, "<uuid>")
    .replace(/\b[0-9a-fA-F]{8,}\b/g, "<hex>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/\s+/g, " ").trim().slice(0, 160);
}

// Tail JSON
const tail = Bun.spawn({ cmd: ["tail", "-n0", "-F", FILE], stdout: "pipe", stderr: "pipe" });
console.log(`Tailing ${FILE}; sending metrics every ${INTERVAL}s`);

(async () => {
  for await (const line of readLines(tail.stdout)) {
    let obj: any; try { obj = JSON.parse(line); } catch { continue; }

    total++;

    // level/status
    const level = (obj.level || obj.severity || "").toString().toLowerCase();
    const status = num(obj.status) ?? num(obj.statusCode);
    if (level === "error" || (status && status >= 500)) errors++;

    // latency
    const lat = num(obj.latency_ms) ?? num(obj.latency) ?? num(obj.duration_ms) ?? num(obj.ms);
    if (lat != null) latencies.push(Math.max(0, Math.min(lat, 10_000)));

    // path/route
    const path = (obj.route || obj.path || obj.url || "").toString();
    if (path) {
      const entry = byPath.get(path) || { count: 0, slowest: 0 };
      entry.count++;
      if (lat !== null && lat > entry.slowest) entry.slowest = lat;
      byPath.set(path, entry);
    }

    // error message patterns
    const msg = (obj.err?.message || obj.message || obj.msg || "").toString();
    if (msg) {
      const key = normalizeMsg(msg);
      const b = errorPatterns.get(key) || { count: 0, samples: [] };
      b.count++; if (b.samples.length < 2) b.samples.push(msg.slice(0, 220));
      errorPatterns.set(key, b);
    }
  }
})();

function quantiles(a: number[], q: number) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const idx = Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))));
  return Math.round(s[idx] || 0);
}

function flush() {
  if (!total) { windowStart = Date.now(); return; }
  const elapsed = Math.round((Date.now() - windowStart) / 1000);

  const p50 = quantiles(latencies, 0.50);
  const p95 = quantiles(latencies, 0.95);
  const p99 = quantiles(latencies, 0.99);
  const errRate = total ? ((errors / total) * 100).toFixed(1) : "0.0";

  const topPaths = [...byPath.entries()]
    .sort((a, b) => (b[1].slowest - a[1].slowest) || (b[1].count - a[1].count))
    .slice(0, TOP);

  const topErrors = [...errorPatterns.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, TOP);

  let out = `[metrics:${FILE}] window=${elapsed}s events=${total} errors=${errors} (${errRate}%) latency_ms={p50:${p50}, p95:${p95}, p99:${p99}}\n`;
  let used = out.length;

  // Top slow paths
  let section = "Top slow paths:\n";
  for (const [path, v] of topPaths) section += `• ${path}  (hits=${v.count}, slowest=${Math.round(v.slowest)}ms)\n`;
  if (used + section.length < MAX_CHARS) { out += section; used += section.length; }

  // Error digests
  section = "Common error patterns:\n";
  for (const [pat, v] of topErrors) {
    const block = `• ${v.count}× ${pat}\n` + (v.samples[0] ? `    ↳ ${v.samples[0]}\n` : "");
    if (used + block.length > MAX_CHARS) { out += "…(truncated)\n"; break; }
    out += block; used += block.length;
  }

  sendToClaude(out);

  // reset window
  total = 0; errors = 0; latencies.length = 0; byPath.clear(); errorPatterns.clear(); windowStart = Date.now();
}
setInterval(flush, INTERVAL * 1000);
