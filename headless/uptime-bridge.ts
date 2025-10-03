#!/usr/bin/env bun
// Uptime monitor with change notifications + a tiny http_get tool

const URLS = (Bun.env.URLS ?? "").split(",").map(s => s.trim()).filter(Boolean);
if (URLS.length === 0) {
  console.error("Usage: URLS=https://example.com,https://status.example.com INTERVAL=15 bun run headless/uptime-bridge.ts");
  process.exit(2);
}
const INTERVAL = Number(Bun.env.INTERVAL || 15); // seconds
const INIT = Bun.env.INIT ?? "Track availability; notify on state changes only.";

type Status = "UP" | "DOWN";
const last: Record<string, Status | undefined> = {};

// --- helpers ---
function userText(text: string) {
  return JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text }] } }) + "\n";
}
function toolResult(id: string, content: any) {
  return JSON.stringify({
    type: "user",
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: JSON.stringify(content) }] },
  }) + "\n";
}

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

// --- claude process ---
const claude = Bun.spawn({
  cmd: ["claude", "-p", "--output-format=stream-json", "--input-format=stream-json", "--verbose"],
  stdin: "pipe",
  stdout: "pipe",
  stderr: "pipe",
});
writeLine(claude.stdin, userText(INIT));

// read assistant; handle tool_use:http_get
(async () => {
  for await (const line of readLines(claude.stdout)) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === "assistant") {
        // Print text blocks (optional)
        const text = (msg.message?.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
        if (text) console.log("Assistant:", text);

        // Handle tool_use
        for (const b of msg.message?.content ?? []) {
          if (b.type === "tool_use" && b.name === "http_get") {
            const { id, input } = b;
            try {
              const res = await fetch(input?.url, { redirect: "follow" });
              const contentType = res.headers.get("content-type") || "";
              const text = await res.text();
              writeLine(claude.stdin, toolResult(id, {
                ok: res.ok, status: res.status, contentType,
                body_snippet: text.slice(0, 2000)
              }));
            } catch (e: any) {
              writeLine(claude.stdin, toolResult(id, { error: e?.message || String(e) }));
            }
          }
        }
      }
    } catch {}
  }
})();

// --- monitoring loop ---
console.log(`Monitoring (${INTERVAL}s):\n` + URLS.map(u => ` - ${u}`).join("\n"));

async function probe(url: string): Promise<Status> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    clearTimeout(t);
    return res.ok ? "UP" : "DOWN";
  } catch { return "DOWN"; }
}

async function tick() {
  for (const url of URLS) {
    const now = await probe(url);
    if (last[url] && last[url] !== now) {
      const note = `[uptime] ${url} changed: ${last[url]} → ${now} at ${new Date().toISOString()}`;
      writeLine(claude.stdin, userText(note));
    }
    last[url] = now;
  }
}
await tick();
setInterval(tick, INTERVAL * 1000);
