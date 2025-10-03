#!/usr/bin/env bun
// Slack Events API bridge → Claude (reply via chat.postMessage)

import { createHmac, timingSafeEqual } from "node:crypto";

const PORT = Number(Bun.env.PORT || 8789);
const SIGNING_SECRET = Bun.env.SLACK_SIGNING_SECRET || "";
const BOT_TOKEN = Bun.env.SLACK_BOT_TOKEN || "";
if (!SIGNING_SECRET || !BOT_TOKEN) {
  console.error("Set SLACK_SIGNING_SECRET and SLACK_BOT_TOKEN");
  process.exit(2);
}

// --- minimal Claude session with sendAndWait(text) ---
class ClaudeSession {
  proc = Bun.spawn({
    cmd: ["claude", "-p", "--output-format=stream-json", "--input-format=stream-json", "--verbose"],
    stdin: "pipe", stdout: "pipe", stderr: "pipe",
  });
  private waiters: ((txt: string) => void)[] = [];
  private buffer = "";

  constructor() { this.readLoop(); }

  private async readLoop() {
    const r = this.proc.stdout.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await r.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.type === "assistant") {
            const t = (msg.message?.content ?? [])
              .filter((b: any) => b.type === "text")
              .map((b: any) => b.text)
              .join("");
            this.buffer += t;
          } else if (msg.type === "result") {
            const w = this.waiters.shift();
            const out = this.buffer.trim();
            this.buffer = "";
            w?.(out);
          }
        } catch {}
      }
    }
  }

  private userText(text: string) {
    return JSON.stringify({
      type: "user",
      message: { role: "user", content: [{ type: "text", text }] },
    }) + "\n";
  }
  async sendAndWait(text: string) {
    this.proc.stdin.write(new TextEncoder().encode(this.userText(text)));
    return new Promise<string>((resolve) => this.waiters.push(resolve));
  }
}
const claude = new ClaudeSession();

// --- Slack signature check (v0) ---
function verifySlackSignature(rawBody: string, ts: string, sig: string) {
  const base = `v0:${ts}:${rawBody}`;
  const mac = createHmac("sha256", SIGNING_SECRET).update(base).digest("hex");
  const expected = `v0=${mac}`;
  // timing-safe compare
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sig || "", "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// --- Slack API helper ---
async function postMessage(channel: string, text: string) {
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel, text }),
  });
}

// --- Server ---
Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") return new Response("ok");

    if (req.method === "POST" && url.pathname === "/slack/events") {
      const raw = await req.text();

      // Verify signature
      const ts = req.headers.get("x-slack-request-timestamp") || "";
      const sig = req.headers.get("x-slack-signature") || "";
      if (!verifySlackSignature(raw, ts, sig)) return new Response("bad signature", { status: 401 });

      const payload = JSON.parse(raw);

      // URL verification handshake
      if (payload.type === "url_verification") {
        return new Response(JSON.stringify({ challenge: payload.challenge }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (payload.type === "event_callback") {
        const ev = payload.event;
        if (ev?.type === "app_mention" || (ev?.type === "message" && !ev.bot_id)) {
          const channel = ev.channel;
          const user = ev.user;
          const text = ev.text || "";

          const prompt = [
            `[slack] user=${user} channel=${channel}`,
            "Reply concisely and helpfully. No Markdown unless asked.",
            "User said:",
            text,
          ].join("\n");

          const answer = await claude.sendAndWait(prompt);
          // Send reply back to Slack
          await postMessage(channel, answer || " ");
        }
        // Always 200 quickly
        return new Response("ok");
      }

      return new Response("ignored");
    }

    return new Response("not found", { status: 404 });
  },
});

console.log(`Slack bridge listening on http://localhost:${PORT}/slack/events`);
