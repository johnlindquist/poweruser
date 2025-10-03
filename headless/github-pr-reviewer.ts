#!/usr/bin/env bun
// GitHub PR webhook → Claude review → PR comment

import { createHmac, timingSafeEqual } from "node:crypto";

const PORT = Number(Bun.env.PORT || 8790);
const SECRET = Bun.env.GH_WEBHOOK_SECRET || "";
const GH_TOKEN = Bun.env.GH_TOKEN || "";
if (!SECRET || !GH_TOKEN) {
  console.error("Set GH_WEBHOOK_SECRET and GH_TOKEN");
  process.exit(2);
}

// --- Claude session ---
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

// --- Verify GitHub signature ---
function verifyGitHubSignature(raw: string, sigHeader: string) {
  const mac = createHmac("sha256", SECRET).update(raw).digest("hex");
  const expected = `sha256=${mac}`;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sigHeader || "", "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// --- GitHub API helpers ---
async function ghFetch(path: string, init?: RequestInit) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${GH_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "claude-bridge",
      ...(init?.headers || {}),
    },
  });
}

async function commentOnPR(owner: string, repo: string, number: number, body: string) {
  await ghFetch(`/repos/${owner}/${repo}/issues/${number}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

// --- Server ---
Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") return new Response("ok");

    if (req.method === "POST" && url.pathname === "/github/webhook") {
      const raw = await req.text();
      const sig = req.headers.get("x-hub-signature-256") || "";
      if (!verifyGitHubSignature(raw, sig)) return new Response("bad signature", { status: 401 });

      const event = req.headers.get("x-github-event") || "";
      if (event !== "pull_request") return new Response("ignored"); // keep focused
      const payload = JSON.parse(raw);

      const action = payload.action;
      if (!["opened", "synchronize", "ready_for_review", "reopened"].includes(action)) {
        return new Response("ok");
      }

      const full = (payload.repository?.full_name as string) || ""; // "owner/repo"
      const [owner = "", repo = ""] = full.split("/");
      const number = payload.pull_request?.number as number;

      // Grab changed files (top N)
      const filesRes = await ghFetch(`/repos/${owner}/${repo}/pulls/${number}/files?per_page=100`);
      const filesData = await filesRes.json();
      const files: any[] = Array.isArray(filesData) ? filesData : [];
      const summaryLines = files.slice(0, 20).map((f: any) =>
        `- ${f.filename} (+${f.additions}/-${f.deletions})`
      ).join("\n");

      const title = payload.pull_request?.title || "";
      const author = payload.pull_request?.user?.login || "";
      const base = payload.pull_request?.base?.ref || "";
      const head = payload.pull_request?.head?.ref || "";

      const prompt = [
        `[github:pull_request] ${owner}/${repo} #${number}`,
        `Title: ${title} | Author: ${author} | ${base} ← ${head}`,
        `Changed files (sample):\n${summaryLines || "(none)"}`,
        "",
        "Write a brief, constructive PR review in **markdown** with:",
        "1) Risk & impact (1–2 bullets)",
        "2) Test coverage suggestions (1–3 bullets)",
        "3) Quick nits (0–5 bullets)",
        "Keep it under ~150 words.",
        "Return your entire reply prefixed by 'REVIEW: ' on the first line.",
      ].join("\n");

      const review = await claude.sendAndWait(prompt);
      const cleaned = review.startsWith("REVIEW:") ? review.replace(/^REVIEW:\s*/i, "") : review;
      const body = cleaned || "_(No content)_";

      await commentOnPR(owner, repo, number, body);
      return new Response("ok");
    }

    return new Response("not found", { status: 404 });
  },
});

console.log(`GitHub PR reviewer on http://localhost:${PORT}/github/webhook`);
