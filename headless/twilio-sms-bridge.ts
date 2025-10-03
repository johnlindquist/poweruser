#!/usr/bin/env bun
// Twilio SMS webhook → Claude → TwiML reply (no extra deps)

const PORT = Number(Bun.env.PORT || 8791);

class ClaudeSession {
  proc = Bun.spawn({
    cmd: ["claude", "-p", "--output-format=stream-json", "--input-format=stream-json", "--verbose"],
    stdin: "pipe", stdout: "pipe", stderr: "pipe",
  });
  private waiters: ((t: string) => void)[] = [];
  private buf = "";
  constructor() { this.loop(); }
  private async loop() {
    const r = this.proc.stdout.getReader(); const dec = new TextDecoder(); let b = "";
    while (true) {
      const { value, done } = await r.read(); if (done) break;
      b += dec.decode(value, { stream: true });
      let i: number;
      while ((i = b.indexOf("\n")) >= 0) {
        const line = b.slice(0, i); b = b.slice(i + 1);
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.type === "assistant") {
            const t = (msg.message?.content ?? []).filter((x: any) => x.type === "text").map((x: any) => x.text).join("");
            this.buf += t;
          } else if (msg.type === "result") {
            const w = this.waiters.shift(); const out = this.buf.trim(); this.buf = ""; w?.(out);
          }
        } catch {}
      }
    }
  }
  private userText(text: string) {
    return JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text }] } }) + "\n";
  }
  async sendAndWait(text: string) {
    this.proc.stdin.write(new TextEncoder().encode(this.userText(text)));
    return new Promise<string>((resolve) => this.waiters.push(resolve));
  }
}
const claude = new ClaudeSession();

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") return new Response("ok");

    if (req.method === "POST" && url.pathname === "/twilio/sms") {
      const body = await req.text(); // x-www-form-urlencoded
      const params = new URLSearchParams(body);
      const from = params.get("From") || "";
      const to = params.get("To") || "";
      const text = params.get("Body") || "";

      // Keep replies concise and SMS-friendly
      const prompt = [
        `[twilio:sms] from=${from} to=${to}`,
        "Reply as a single SMS (plain text). Max ~300 characters. No links unless asked.",
        "Message:",
        text,
      ].join("\n");

      let answer = (await claude.sendAndWait(prompt)).trim();
      if (answer.length > 300) answer = answer.slice(0, 297) + "...";

      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(answer || " ")}</Message></Response>`;
      return new Response(twiml, { headers: { "Content-Type": "application/xml" } });
    }

    return new Response("not found", { status: 404 });
  },
});

console.log(`Twilio SMS bridge on http://localhost:${PORT}/twilio/sms`);
