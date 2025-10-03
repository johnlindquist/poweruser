import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "node:child_process";

type RunOpts = { cwd?: string; timeoutMs?: number; maxBytes?: number };
async function runCommand(cmd: string, args: string[], opts: RunOpts = {}) {
  const { cwd, timeoutMs = 20_000, maxBytes = 6 * 1024 * 1024 } = opts;
  return await new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "", bytes = 0;
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d) => { bytes += d.length; if (bytes > maxBytes) child.kill("SIGKILL"); else stdout += d.toString("utf8"); });
    child.stderr.on("data", (d) => { stderr += d.toString("utf8"); });
    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ stdout, stderr, code: code ?? -1 }); });
  });
}

const server = new McpServer({ name: "mcp-ripgrep", version: "1.0.0" });

server.tool(
  "ripgrep_search",
  "Search files using ripgrep (--json) and return match info.",
  {
    query: z.string().min(1).describe("Search pattern (regex by default)"),
    dir: z.string().default(".").describe("Directory to search"),
    glob: z.array(z.string()).default([]).describe("One or more globs to include (e.g. **/*.ts)"),
    hidden: z.boolean().default(false).describe("Search hidden files"),
    fixedString: z.boolean().default(false).describe("Treat pattern as literal (-F)"),
    case: z.enum(["smart","sensitive","insensitive"]).default("smart"),
    maxResults: z.number().int().min(1).max(2000).default(200),
  },
  async ({ query, dir, glob, hidden, fixedString, case: kase, maxResults }) => {
    const args = ["--json"];
    if (hidden) args.push("--hidden");
    for (const g of glob) args.push("--glob", g);
    if (fixedString) args.push("-F");
    if (kase === "sensitive") args.push("--case-sensitive");
    else if (kase === "insensitive") args.push("--ignore-case");
    else args.push("--smart-case");
    args.push(query, dir);

    try {
      const { stdout, stderr, code } = await runCommand("rg", args);
      if (code !== 0 && !stdout.trim()) {
        return { content: [{ type: "text", text: `rg exited with code ${code}\n${stderr || stdout}` }] };
      }

      const results: Array<{ file: string; line: number; match: string }> = [];
      const lines = stdout.split(/\r?\n/);
      for (const line of lines) {
        if (!line) continue;
        try {
          const evt = JSON.parse(line);
          if (evt.type === "match") {
            const path = evt.data.path?.text ?? "";
            const lineNum = evt.data.line_number;
            const text = evt.data.lines?.text?.replace(/\n$/, "") ?? "";
            results.push({ file: path, line: lineNum, match: text });
            if (results.length >= maxResults) break;
          }
        } catch { /* skip */ }
      }

      if (results.length === 0) {
        return { content: [{ type: "text", text: "No matches." }] };
      }

      const out = results.map(r => `${r.file}:${r.line}: ${r.match}`).join("\n");
      return { content: [{ type: "text", text: out }] };
    } catch (err: any) {
      const msg = err?.code === "ENOENT"
        ? "ripgrep (rg) not found on PATH. Please install ripgrep."
        : `rg error: ${String(err?.message || err)}`;
      return { content: [{ type: "text", text: msg }] };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("mcp-ripgrep (stdio) ready");
