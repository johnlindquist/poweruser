import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "node:child_process";

type RunOpts = { cwd?: string; timeoutMs?: number; maxBytes?: number; input?: string };
async function runCommand(cmd: string, args: string[], opts: RunOpts = {}) {
  const { cwd, timeoutMs = 30_000, maxBytes = 5 * 1024 * 1024, input } = opts;
  return await new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "", bytes = 0;
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d) => { bytes += d.length; if (bytes > maxBytes) child.kill("SIGKILL"); else stdout += d.toString("utf8"); });
    child.stderr.on("data", (d) => { stderr += d.toString("utf8"); });
    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ stdout, stderr, code: code ?? -1 }); });
    if (input) { child.stdin.write(input); }
    child.stdin.end();
  });
}

const server = new McpServer({ name: "mcp-curl", version: "1.0.0" });

server.tool(
  "http_request",
  "Fetch a URL using curl with optional method/headers/body.",
  {
    url: z.string().url(),
    method: z.enum(["GET","POST","PUT","DELETE","HEAD","PATCH"]).default("GET"),
    headers: z.record(z.string(), z.string()).default({}),
    body: z.string().optional(),
    followRedirects: z.boolean().default(true),
    insecureTLS: z.boolean().default(false),
    timeoutSeconds: z.number().int().min(1).max(120).default(30),
  },
  async ({ url, method, headers, body, followRedirects, insecureTLS, timeoutSeconds }) => {
    const args = ["-sS", "-i"]; // include headers in output
    if (followRedirects) args.push("-L");
    if (insecureTLS) args.push("-k");
    args.push("-X", method);
    for (const [k, v] of Object.entries(headers)) args.push("-H", `${k}: ${v}`);
    if (body != null && method !== "GET" && method !== "HEAD") args.push("--data-binary", body);
    args.push(url);

    try {
      const { stdout, stderr, code } = await runCommand("curl", args, { timeoutMs: timeoutSeconds * 1000 });
      if (code !== 0) {
        return { content: [{ type: "text", text: `curl exited with code ${code}\n${stderr || stdout}` }] };
      }

      // Parse last header block (handles redirects)
      const splitBy = stdout.includes("\r\n\r\n") ? "\r\n\r\n" : "\n\n";
      const blocks = stdout.split(splitBy);
      // In `-i` output, headers may appear multiple times (redirects). The last header block precedes body.
      // Find the last block that looks like headers (starts with HTTP/)
      let headerIdx = -1;
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (block && /^HTTP\/\d(\.\d)?\s+\d+/.test(block)) headerIdx = i;
      }
      const headersText: string = headerIdx >= 0 && blocks[headerIdx] ? blocks[headerIdx]! : "";
      const bodyText = headerIdx >= 0 ? blocks.slice(headerIdx + 1).join(splitBy) : stdout;

      const statusMatch = headersText.match(/HTTP\/\d(?:\.\d)?\s+(\d+)/);
      const status = statusMatch ? Number(statusMatch[1]) : undefined;

      const headerLines = headersText.split(/\r?\n/).slice(1);
      const headerObj: Record<string, string> = {};
      for (const line of headerLines) {
        const m = line.match(/^([^:]+):\s*(.*)$/);
        if (m && m[1] && m[2] !== undefined) headerObj[m[1].toLowerCase()] = m[2];
      }

      const preview = bodyText.slice(0, 2000);
      let maybeJson: unknown | undefined;
      const ct = headerObj["content-type"] || "";
      if (/application\/(.+\+)?json/i.test(ct)) {
        try { maybeJson = JSON.parse(bodyText); } catch {}
      }

      const lines: string[] = [];
      lines.push(`Status: ${status ?? "unknown"}`);
      lines.push(`Content-Type: ${ct || "unknown"}`);
      lines.push("");
      if (maybeJson !== undefined) {
        lines.push("JSON:");
        lines.push(JSON.stringify(maybeJson, null, 2));
      } else {
        lines.push("Body (preview):");
        lines.push(preview);
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (err: any) {
      const msg = err?.code === "ENOENT"
        ? "curl not found on PATH. Please install curl."
        : `curl error: ${String(err?.message || err)}`;
      return { content: [{ type: "text", text: msg }] };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("mcp-curl (stdio) ready");
