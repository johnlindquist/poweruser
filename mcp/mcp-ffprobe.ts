import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "node:child_process";

type RunOpts = { cwd?: string; timeoutMs?: number; maxBytes?: number };
async function runCommand(cmd: string, args: string[], opts: RunOpts = {}) {
  const { cwd, timeoutMs = 20_000, maxBytes = 2 * 1024 * 1024 } = opts;
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

const server = new McpServer({ name: "mcp-ffprobe", version: "1.0.0" });

server.tool(
  "ffprobe_info",
  "Inspect media file metadata (format/streams/chapters).",
  {
    file: z.string().min(1).describe("Path to media file"),
    showChapters: z.boolean().default(false),
  },
  async ({ file, showChapters }) => {
    const args = ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams"];
    if (showChapters) args.push("-show_chapters");
    args.push(file);

    try {
      const { stdout, stderr, code } = await runCommand("ffprobe", args);
      if (code !== 0) {
        return { content: [{ type: "text", text: `ffprobe exited with code ${code}\n${stderr || stdout}` }] };
      }
      let info: any;
      try { info = JSON.parse(stdout); } catch {
        return { content: [{ type: "text", text: "ffprobe produced non-JSON output." }] };
      }

      const fmt = info.format || {};
      const duration = fmt.duration ? `${Number(fmt.duration).toFixed(2)}s` : "unknown";
      const size = fmt.size ? `${fmt.size} bytes` : "unknown";
      const bitrate = fmt.bit_rate ? `${fmt.bit_rate} bps` : "unknown";

      const streamSummary = (info.streams || []).map((s: any) => {
        const kind = s.codec_type || "unknown";
        const codec = s.codec_name || "unknown";
        const dims = s.width && s.height ? `${s.width}x${s.height}` : "";
        const rate = s.avg_frame_rate && s.avg_frame_rate !== "0/0" ? `@${s.avg_frame_rate}` : "";
        return `- ${kind}: ${codec} ${dims} ${rate}`.trim();
      }).join("\n");

      const lines = [
        `File: ${file}`,
        `Duration: ${duration}`,
        `Size: ${size}`,
        `Bitrate: ${bitrate}`,
        streamSummary ? `Streams:\n${streamSummary}` : "Streams: none",
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (err: any) {
      const msg = err?.code === "ENOENT"
        ? "ffprobe not found on PATH. Please install FFmpeg."
        : `ffprobe error: ${String(err?.message || err)}`;
      return { content: [{ type: "text", text: msg }] };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("mcp-ffprobe (stdio) ready");
