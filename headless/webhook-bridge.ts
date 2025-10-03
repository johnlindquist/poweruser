#!/usr/bin/env bun
// Minimal webhook → Claude bridge (no deps)

const PORT = Number(Bun.env.PORT || 8787);
const INIT = Bun.env.INIT ?? "Summarize incoming webhook events and flag anomalies.";

function createUserEvent(source: string, payload: unknown) {
  const text =
    `[event:${source} @ ${new Date().toISOString()}]\n` +
    (typeof payload === "string" ? payload : JSON.stringify(payload));
  return JSON.stringify({
    type: "user",
    message: { role: "user", content: [{ type: "text", text }] },
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

// ---------- Spawn Claude (Bun.spawn) ----------
const claude = Bun.spawn({
  cmd: [
    "claude",
    "-p",
    "--output-format=stream-json",
    "--input-format=stream-json",
    "--verbose",
  ],
  stdin: "pipe",
  stdout: "pipe",
  stderr: "pipe",
});

// Prime with initial instruction
writeLine(claude.stdin, createUserEvent("bootstrap", INIT));

// Print assistant text replies
(async () => {
  for await (const line of readLines(claude.stdout)) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === "assistant") {
        const text = (msg.message?.content ?? [])
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("");
        if (text) console.log("Assistant:", text);
      }
    } catch {}
  }
})();

// ---------- Webhook Server ----------
Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/health") return new Response("ok", { status: 200 });
    if (!(req.method === "POST" && url.pathname === "/hook")) return new Response("not found", { status: 404 });

    const ct = req.headers.get("content-type") || "";
    const payload = ct.includes("application/json") ? await req.json() : await req.text();

    writeLine(claude.stdin, createUserEvent("webhook", payload));
    return new Response("accepted", { status: 202 });
  },
});

console.log(`Webhook listening on http://localhost:${PORT}/hook`);
