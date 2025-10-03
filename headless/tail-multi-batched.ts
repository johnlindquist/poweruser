#!/usr/bin/env bun
// Tail multiple files, push a compact combined summary every INTERVAL secs.

const FILES = (Bun.env.FILES || "").split(",").map(s => s.trim()).filter(Boolean);
if (!FILES.length) {
  console.error("Usage: FILES=/var/log/web.log,/var/log/worker.log [INTERVAL=300] [MAX_CHARS=3500] bun run headless/tail-multi-batched.ts");
  process.exit(2);
}
const INTERVAL = Number(Bun.env.INTERVAL || 300);
const MAX_CHARS = Number(Bun.env.MAX_CHARS || 3500);
const INIT = Bun.env.INIT || `You'll receive compact summaries from multiple logs. Prioritize cross-file correlations and anomalies.`;

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

// ---- per-file aggregators ----
type Agg = {
  total: number;
  sev: Record<string, number>;
  patterns: Map<string, { count: number; samples: string[] }>;
};
const aggs = new Map<string, Agg>();
for (const f of FILES) aggs.set(f, { total: 0, sev: { error: 0, warn: 0, info: 0, debug: 0, other: 0 }, patterns: new Map() });

function normalize(s: string) {
  return s
    .replace(/\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, "<ts>")
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "<ip>")
    .replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b/g, "<uuid>")
    .replace(/\b[0-9a-fA-F]{8,}\b/g, "<hex>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/\s+/g, " ").trim().slice(0, 160);
}
function bumpSev(sev: Record<string, number>, line: string) {
  const L = line.toLowerCase();
  if (/\berror\b/.test(L)) sev.error = (sev.error || 0) + 1;
  else if (/\bwarn(ing)?\b/.test(L)) sev.warn = (sev.warn || 0) + 1;
  else if (/\binfo\b/.test(L)) sev.info = (sev.info || 0) + 1;
  else if (/\bdebug\b/.test(L)) sev.debug = (sev.debug || 0) + 1;
  else sev.other = (sev.other || 0) + 1;
}

function record(file: string, line: string) {
  const a = aggs.get(file)!;
  a.total++;
  bumpSev(a.sev, line);
  const key = normalize(line);
  const b = a.patterns.get(key) || { count: 0, samples: [] };
  b.count++; if (b.samples.length < 1) b.samples.push(line.slice(0, 200));
  a.patterns.set(key, b);
}

// start tails
for (const f of FILES) {
  const t = Bun.spawn({ cmd: ["tail", "-n0", "-F", f], stdout: "pipe", stderr: "pipe" });
  console.log(`Tailing ${f}`);
  (async () => {
    for await (const line of readLines(t.stdout)) {
      record(f, line);
    }
  })();
}

function flush() {
  // Build compact, per-file sections until we hit MAX_CHARS
  let out = `[logs:multi] files=${FILES.length} window=~${INTERVAL}s\n`;
  let used = out.length;

  for (const f of FILES) {
    const a = aggs.get(f)!;
    if (!a.total) continue;

    const top = [...a.patterns.entries()].sort((x, y) => y[1].count - x[1].count).slice(0, 2);
    let section =
      `\n— ${f}\n` +
      `  total=${a.total}  sev={error:${a.sev.error || 0}, warn:${a.sev.warn || 0}, info:${a.sev.info || 0}, debug:${a.sev.debug || 0}, other:${a.sev.other || 0}}\n`;
    for (const [pat, b] of top) {
      section += `  • ${b.count}× ${pat}\n`;
      if (b.samples[0]) section += `      ↳ ${b.samples[0]}\n`;
    }
    if (used + section.length > MAX_CHARS) { out += "\n…(truncated)\n"; break; }
    out += section; used += section.length;
  }

  if (used > 0) sendToClaude(out);

  // reset
  for (const f of FILES) aggs.set(f, { total: 0, sev: { error: 0, warn: 0, info: 0, debug: 0, other: 0 }, patterns: new Map() });
}

setInterval(flush, INTERVAL * 1000);
