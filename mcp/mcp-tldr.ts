import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "node:child_process";

type RunOpts = { cwd?: string; timeoutMs?: number; maxBytes?: number };
async function runCommand(cmd: string, args: string[], opts: RunOpts = {}) {
  const { cwd, timeoutMs = 10_000, maxBytes = 512 * 1024 } = opts;
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

const server = new McpServer({ name: "mcp-tldr", version: "1.0.0" });

server.tool(
  "tldr_page",
  "Display TLDR help for a command (offline cheatsheets).",
  {
    command: z.string().min(1).describe("Command to look up (e.g., tar)"),
    platform: z.enum(["common","linux","osx","windows","sunos"]).default("common"),
    language: z.string().default("en"),
  },
  async ({ command, platform, language }) => {
    const args = ["--color", "never", "--platform", platform, "--language", language, command];
    try {
      const { stdout, stderr, code } = await runCommand("tldr", args);
      if (code !== 0) {
        return { content: [{ type: "text", text: `tldr exited with code ${code}\n${stderr || stdout}` }] };
      }
      return { content: [{ type: "text", text: stdout.trim() }] };
    } catch (err: any) {
      const msg = err?.code === "ENOENT"
        ? "tldr not found on PATH. Install the TLDR client."
        : `tldr error: ${String(err?.message || err)}`;
      return { content: [{ type: "text", text: msg }] };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("mcp-tldr (stdio) ready");
