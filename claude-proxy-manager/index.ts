#!/usr/bin/env bun

import { spawn, type Subprocess } from "bun";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

interface ProxyConfig {
  host: string;
  port: number;
  useWebUI: boolean;
}

class ClaudeProxyManager {
  private mitmproxyProcess?: Subprocess;
  private claudeProcess?: Subprocess;
  private config: ProxyConfig;
  private caCertPath: string;

  constructor(config: Partial<ProxyConfig> = {}) {
    this.config = {
      host: config.host || "127.0.0.1",
      port: config.port || 8080,
      useWebUI: config.useWebUI !== false, // default to true
    };
    this.caCertPath = join(homedir(), ".mitmproxy", "mitmproxy-ca-cert.pem");
  }

  private async checkMitmproxyInstalled(): Promise<boolean> {
    try {
      const proc = spawn(["which", "mitmproxy"]);
      const text = await new Response(proc.stdout).text();
      return text.trim().length > 0;
    } catch {
      return false;
    }
  }

  private async ensureCACertificate(): Promise<void> {
    if (existsSync(this.caCertPath)) {
      console.log("✅ CA certificate already exists");
      return;
    }

    console.log("🔐 Generating mitmproxy CA certificate...");
    const proc = spawn([
      "mitmdump",
      "--listen-host", this.config.host,
      "--listen-port", this.config.port.toString(),
    ]);

    // Wait a bit for certificate generation
    await new Promise(resolve => setTimeout(resolve, 2000));

    proc.kill();
    await proc.exited;

    if (existsSync(this.caCertPath)) {
      console.log("✅ CA certificate generated successfully");
    } else {
      throw new Error("Failed to generate CA certificate");
    }
  }

  private async startProxy(): Promise<void> {
    const command = this.config.useWebUI ? "mitmweb" : "mitmproxy";
    const args = [
      "--listen-host", this.config.host,
      "--listen-port", this.config.port.toString(),
    ];

    if (this.config.useWebUI) {
      args.push("--web-host", this.config.host);
      args.push("--no-web-open-browser"); // Don't auto-open browser
      args.push("--set", "web_open_browser=false");
      args.push("--set", "webui_auth=false"); // Disable web UI authentication
    }

    console.log(`🚀 Starting ${command}...`);

    this.mitmproxyProcess = spawn([command, ...args], {
      stdout: "inherit",
      stderr: "inherit",
    });

    // Wait for proxy to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (this.config.useWebUI) {
      console.log(`🌐 Web UI available at: http://${this.config.host}:8081`);
    }
    console.log(`📡 Proxy listening on: ${this.config.host}:${this.config.port}`);
  }

  private async startClaude(args: string[] = []): Promise<void> {
    const env = {
      ...process.env,
      NODE_EXTRA_CA_CERTS: this.caCertPath,
      HTTPS_PROXY: `http://${this.config.host}:${this.config.port}`,
      HTTP_PROXY: `http://${this.config.host}:${this.config.port}`,
      NO_PROXY: "localhost,127.0.0.1,.local",
      ANTHROPIC_LOG: "debug", // Optional: can be removed if too verbose
    };

    console.log("\n🔧 Claude Code environment:");
    console.log(`   HTTP_PROXY:  ${env.HTTP_PROXY}`);
    console.log(`   HTTPS_PROXY: ${env.HTTPS_PROXY}`);
    console.log(`   NO_PROXY:    ${env.NO_PROXY}`);
    console.log(`   CA Cert:     ${env.NODE_EXTRA_CA_CERTS}`);
    console.log("\n🚀 Launching Claude Code...\n");

    this.claudeProcess = spawn(["claude", ...args], {
      env,
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    });

    console.log("💡 Tips:");
    console.log("  - Run '/status' in Claude Code to verify proxy settings");
    console.log("  - Watch proxy terminal/web UI to see intercepted traffic");
    console.log("  - Press Ctrl+C to stop both proxy and Claude Code\n");
  }

  public async run(claudeArgs: string[] = []): Promise<void> {
    console.log("🔧 Claude Code Proxy Inspection Manager\n");

    // Check if mitmproxy is installed
    if (!(await this.checkMitmproxyInstalled())) {
      console.error("❌ mitmproxy not found. Please install it first:");
      console.error("   brew install mitmproxy");
      process.exit(1);
    }

    // Ensure CA certificate exists
    await this.ensureCACertificate();

    // Start proxy
    await this.startProxy();

    // Start Claude Code
    await this.startClaude(claudeArgs);

    // Handle cleanup
    process.on("SIGINT", () => this.cleanup());
    process.on("SIGTERM", () => this.cleanup());

    // Wait for Claude to exit
    await this.claudeProcess?.exited;
    this.cleanup();
  }

  private cleanup(): void {
    console.log("\n🧹 Cleaning up...");

    if (this.claudeProcess) {
      this.claudeProcess.kill();
    }

    if (this.mitmproxyProcess) {
      this.mitmproxyProcess.kill();
    }

    console.log("✅ Done!");
    process.exit(0);
  }
}

// CLI Interface
if (import.meta.main) {
  const args = process.argv.slice(2);

  // Parse options
  let useWebUI = true;
  let port = 8080;
  let claudeArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--no-web":
        useWebUI = false;
        break;
      case "--port":
        port = parseInt(args[++i]);
        break;
      case "--help":
        console.log(`
Claude Code Proxy Manager

Usage:
  bun run index.ts [options] [-- claude-args]

Options:
  --no-web      Use terminal UI instead of web UI (default: web UI)
  --port PORT   Proxy port (default: 8080)
  --help        Show this help message

Examples:
  bun run index.ts                    # Start with web UI
  bun run index.ts --no-web           # Start with terminal UI
  bun run index.ts --port 9090        # Use custom port
  bun run index.ts -- --help          # Pass --help to Claude Code
`);
        process.exit(0);
      case "--":
        claudeArgs = args.slice(i + 1);
        i = args.length; // Exit loop
        break;
      default:
        if (!args[i - 1]?.includes("--port")) {
          claudeArgs.push(args[i]);
        }
    }
  }

  const manager = new ClaudeProxyManager({ useWebUI, port });
  await manager.run(claudeArgs);
}