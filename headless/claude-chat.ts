#!/usr/bin/env bun
/* bun-native streaming CLI for Claude Code
   - uses Bun.spawn + Web Streams (no child_process/readline)
   - interactive mode with spinner
   - JSONL stdin passthrough mode
*/

import { parseArgs } from "util";

// ---------- CLI args ----------
const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: "boolean", short: "h" },
    verbose: { type: "boolean", short: "v" },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log(`
Usage: bun run headless/claude-chat.ts [options] [initial-message]

A CLI tool that spawns a Claude Code instance and sends messages using --input-format stream-json.

Options:
  -h, --help      Show this help message
  -v, --verbose   Enable verbose output

Modes:
  - With initial message: Starts interactive mode with that message
  - Without arguments: Reads JSON messages from stdin (non-interactive)

Examples:
  # Interactive mode with initial message
  bun run headless/claude-chat.ts "Hello, what files are in the headless directory?"

  # With verbose output
  bun run headless/claude-chat.ts -v "List all TypeScript files"

  # Stdin mode (JSONL format)
  echo '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Hello"}]}}' | bun run headless/claude-chat.ts
`);
  process.exit(0);
}

const initialMessage = positionals.join(" ");

// ---------- Helpers ----------
function createUserMessage(text: string) {
  return JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: [{ type: "text", text }],
    },
  });
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

const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinnerIndex = 0;
let loadingInterval: ReturnType<typeof setInterval> | null = null;

function startLoading() {
  if (loadingInterval) return;
  process.stdout.write("\r");
  loadingInterval = setInterval(() => {
    process.stdout.write(`\r${spinnerFrames[spinnerIndex]} Thinking...`);
    spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
  }, 80);
}

function stopLoading() {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
    process.stdout.write("\r\x1b[K"); // clear line
  }
}

function promptLabel() {
  process.stdout.write("\nYou: ");
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

// ---------- Streams handling ----------
let readyForInput = !initialMessage; // interactive prompt shown after first result

// stdout: parse streaming JSONL messages
(async () => {
  for await (const line of readLines(claude.stdout)) {
    try {
      const msg = JSON.parse(line);

      if (msg.type === "assistant") {
        stopLoading();
        const textContent = msg.message?.content
          ?.filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join("");
        if (textContent) console.log("Assistant:", textContent);
      } else if (msg.type === "result") {
        stopLoading();
        if (values.verbose) {
          console.log("\n--- Session Complete ---");
          console.log("Session ID:", msg.session_id);
          console.log("Duration:", msg.duration_ms, "ms");
          console.log("Cost:", msg.total_cost_usd, "USD");
          console.log("Turns:", msg.num_turns);
        }
        if (initialMessage && !readyForInput) {
          readyForInput = true;
          promptLabel();
        }
      } else if (values.verbose) {
        // Other event types (e.g., tool calls, status)
        console.log("Message:", msg.type, msg.subtype || "");
      }
    } catch {
      if (values.verbose) console.error("Failed to parse JSON:", line);
    }
  }
})();

// stderr: surface errors when verbose
(async () => {
  if (!values.verbose) return;
  for await (const line of readLines(claude.stderr)) {
    console.error("Error:", line);
  }
})();

// exit handling
claude.exited.then((code) => {
  if (values.verbose) console.log(`\nClaude process exited with code ${code}`);
  process.exit(code ?? 0);
});

// ---------- Send message helper ----------
function sendMessage(text: string) {
  const msg = createUserMessage(text);
  if (values.verbose) console.log("Sending:", msg);
  writeLine(claude.stdin, msg + "\n");
  startLoading();
}

// ---------- Mode selection ----------
(async function main() {
  // If we have an initial message, send it and enter interactive mode
  if (initialMessage) {
    sendMessage(initialMessage);

    // Interactive input loop using Bun.stdin (no readline)
    const input = readLines(Bun.stdin.stream());
    for await (const raw of input) {
      const trimmed = raw.trim();
      if (!readyForInput) continue; // wait until first result
      if (!trimmed) {
        promptLabel();
        continue;
      }
      if (trimmed === "exit" || trimmed === "quit") {
        try {
          claude.kill();
        } catch {}
        break;
      }
      sendMessage(trimmed);
      // Next prompt will be shown after the next "result"
    }
    return;
  }

  // No initial message -> JSONL passthrough from stdin
  const stdinReader = readLines(Bun.stdin.stream());
  for await (const jsonl of stdinReader) {
    // forward each line to Claude as-is
    writeLine(claude.stdin, jsonl + "\n");
  }
  // close stdin to signal EOF
  claude.stdin.end();
})().catch((err) => {
  console.error("Fatal error:", err);
  try {
    claude.kill();
  } catch {}
  process.exit(1);
});
