#!/usr/bin/env bun
// Tail a file and forward each line to Claude (no deps)

const FILE = Bun.env.FILE; // path to log file (required)
if (!FILE) {
  console.error("Usage: FILE=/path/to/log bun run headless/tail-bridge.ts  [GREP=substring]");
  process.exit(2);
}
const GREP = Bun.env.GREP ?? "";
const INIT = Bun.env.INIT ?? `You're receiving log lines from ${FILE}. Summarize bursts of errors.`;

// --- helpers ---
function userText(text: string) {
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

// --- claude process ---
const claude = Bun.spawn({
  cmd: ["claude", "-p", "--output-format=stream-json", "--input-format=stream-json", "--verbose"],
  stdin: "pipe",
  stdout: "pipe",
  stderr: "pipe",
});
writeLine(claude.stdin, userText(INIT));

(async () => {
  // Optional: print assistant text
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

// --- tail the file and forward lines ---
const tail = Bun.spawn({ cmd: ["tail", "-F", FILE], stdout: "pipe", stderr: "pipe" });
console.log(`Tailing: ${FILE}${GREP ? ` (filter: "${GREP}")` : ""}`);

(async () => {
  for await (const line of readLines(tail.stdout)) {
    if (GREP && !line.includes(GREP)) continue;
    writeLine(claude.stdin, userText(`[log:${FILE}] ${line}`));
  }
})();
