import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "node:child_process";

type RunOpts = { cwd?: string; timeoutMs?: number; maxBytes?: number; input?: string };
async function runCommand(cmd: string, args: string[], opts: RunOpts = {}) {
  const { cwd, timeoutMs = 20_000, maxBytes = 4 * 1024 * 1024, input } = opts;
  return await new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "", bytes = 0;
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d) => { bytes += d.length; if (bytes > maxBytes) child.kill("SIGKILL"); else stdout += d.toString("utf8"); });
    child.stderr.on("data", (d) => { stderr += d.toString("utf8"); });
    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ stdout, stderr, code: code ?? -1 }); });
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

const server = new McpServer({ name: "mcp-jq", version: "1.0.0" });

server.tool(
  "jq_filter",
  "Run a jq filter on a JSON string and return the result.",
  {
    json: z.string().describe("JSON input string"),
    filter: z.string().default(".").describe("jq filter (e.g., .items[] | {id, name})"),
    compact: z.boolean().default(true).describe("Compact output (-c)"),
    raw: z.boolean().default(false).describe("Raw/strings output (-r)"),
    slurp: z.boolean().default(false).describe("Read entire input stream into an array (-s)"),
  },
  async ({ json, filter, compact, raw, slurp }) => {
    const args = ["-M"]; // no color
    if (compact) args.push("-c");
    if (raw) args.push("-r");
    if (slurp) args.push("-s");
    args.push(filter || ".");

    try {
      const { stdout, stderr, code } = await runCommand("jq", args, { input: json });
      if (code !== 0) {
        return { content: [{ type: "text", text: `jq exited with code ${code}\n${stderr || stdout}` }] };
      }
      return { content: [{ type: "text", text: stdout.trim() }] };
    } catch (err: any) {
      const msg = err?.code === "ENOENT"
        ? "jq not found on PATH. Please install jq."
        : `jq error: ${String(err?.message || err)}`;
      return { content: [{ type: "text", text: msg }] };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("mcp-jq (stdio) ready");
