#!/usr/bin/env bun
// Batch tail of a text log → compact summary to Claude every INTERVAL secs.

const FILE = Bun.env.FILE; // required
if (!FILE) {
  console.error("Usage: FILE=/path/to/log [INTERVAL=300] [MAX_CHARS=3500] [TOP=8] [SAMPLES=2] bun run headless/tail-batched.ts");
  process.exit(2);
}

const INTERVAL = Number(Bun.env.INTERVAL || 300); // seconds
const MAX_CHARS = Number(Bun.env.MAX_CHARS || 3500);
const TOP = Number(Bun.env.TOP || 8);
const SAMPLES = Number(Bun.env.SAMPLES || 2);
const INIT = Bun.env.INIT || `You'll receive compact 5-minute summaries of ${FILE}. Focus on anomalies and recurring issues.`;

// ---------- Claude wiring ----------
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

const claude = Bun.spawn({
  cmd: ["claude", "-p", "--output-format=stream-json", "--input-format=stream-json", "--verbose"],
  stdin: "pipe",
  stdout: "pipe",
  stderr: "pipe",
});

function userText(text: string) {
  return JSON.stringify({
    type: "user",
    message: { role: "user", content: [{ type: "text", text }] },
  }) + "\n";
}
function sendToClaude(text: string) {
  writeLine(claude.stdin, userText(text));
}

// optional: show assistant text replies
(async () => {
  for await (const line of readLines(claude.stdout)) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === "assistant") {
        const text = (msg.message?.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
        if (text) console.log("Assistant:", text);
      }
    } catch {}
  }
})();

sendToClaude(INIT);

// ---------- Tail & aggregation ----------
type Bucket = { count: number; samples: string[] };
const patterns = new Map<string, Bucket>();
const severityCount: Record<string, number> = { error: 0, warn: 0, info: 0, debug: 0, other: 0 };
let totalLines = 0;
let windowStart = Date.now();

function normalizeLine(s: string): string {
  // remove obvious timestamps/IPs/UUIDs/hex/numbers; collapse spaces
  return s
    // ISO timestamps
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g, "<ts>")
    // 2025-10-03 12:34:56 etc.
    .replace(/\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}\b/g, "<ts>")
    // IPv4
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "<ip>")
    // UUID
    .replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b/g, "<uuid>")
    // long hex blobs
    .replace(/\b[0-9a-fA-F]{8,}\b/g, "<hex>")
    // numbers
    .replace(/\b\d+\b/g, "<n>")
    // whitespace
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}
function bumpSeverity(line: string) {
  const L = line.toLowerCase();
  if (/\berror\b/.test(L)) severityCount.error = (severityCount.error || 0) + 1;
  else if (/\bwarn(ing)?\b/.test(L)) severityCount.warn = (severityCount.warn || 0) + 1;
  else if (/\binfo\b/.test(L)) severityCount.info = (severityCount.info || 0) + 1;
  else if (/\bdebug\b/.test(L)) severityCount.debug = (severityCount.debug || 0) + 1;
  else severityCount.other = (severityCount.other || 0) + 1;
}

function record(line: string) {
  totalLines++;
  bumpSeverity(line);
  const key = normalizeLine(line);
  const b = patterns.get(key) || { count: 0, samples: [] };
  b.count++;
  if (b.samples.length < SAMPLES) b.samples.push(line.slice(0, 240));
  patterns.set(key, b);
}

// Tail -F (start at end)
const tail = Bun.spawn({ cmd: ["tail", "-n0", "-F", FILE], stdout: "pipe", stderr: "pipe" });
console.log(`Tailing ${FILE}; sending summaries every ${INTERVAL}s (TOP=${TOP}, SAMPLES=${SAMPLES}, MAX_CHARS=${MAX_CHARS})`);

(async () => {
  for await (const line of readLines(tail.stdout)) {
    record(line);
  }
})();

// Flush window
function flush() {
  if (!totalLines) { windowStart = Date.now(); return; }

  const windowEnd = Date.now();
  const secs = Math.max(1, Math.round((windowEnd - windowStart) / 1000));

  // top patterns by count
  const ranked = [...patterns.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, TOP);

  // build summary with hard char budget
  const header = `[logs:${FILE}] window=${secs}s total=${totalLines}  sev={error:${severityCount.error || 0}, warn:${severityCount.warn || 0}, info:${severityCount.info || 0}, debug:${severityCount.debug || 0}, other:${severityCount.other || 0}}`;
  let out = header + "\nTop patterns:\n";
  let used = out.length;
  for (const [pat, b] of ranked) {
    const block = `• ${b.count}×  ${pat}\n` + b.samples.map(s => `    ↳ ${s}`).join("\n") + "\n";
    if (used + block.length > MAX_CHARS) { out += "…(truncated)\n"; break; }
    out += block;
    used += block.length;
  }
  const omitted = patterns.size - ranked.length;
  if (omitted > 0 && used + 40 < MAX_CHARS) out += `(omitted ${omitted} lesser patterns)\n`;

  sendToClaude(out);

  // reset window
  patterns.clear();
  totalLines = 0;
  severityCount.error = 0;
  severityCount.warn = 0;
  severityCount.info = 0;
  severityCount.debug = 0;
  severityCount.other = 0;
  windowStart = Date.now();
}

setInterval(flush, INTERVAL * 1000);
