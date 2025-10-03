#!/usr/bin/env bun

import { spawn, type Subprocess } from "bun";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

interface ProxyConfig {
  host: string;
  port: number;
  webPort: number;
  webPassword?: string;
  useWebUI: boolean;
  showProxyOutput: boolean;
}

class ClaudeProxyManager {
  private mitmproxyProcess?: Subprocess;
  private config: ProxyConfig;
  private caCertPath: string;

  constructor(config: Partial<ProxyConfig> = {}) {
    this.config = {
      host: config.host || "127.0.0.1",
      port: config.port || 8080,
      webPort: config.webPort || 8081,
      webPassword: config.webPassword,
      useWebUI: config.useWebUI ?? true,
      showProxyOutput: config.showProxyOutput ?? false,
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
      return;
    }

    console.log("🔐 Generating mitmproxy CA certificate...");
    console.log("   (This only happens once)");
    const proc = spawn([
      "mitmdump",
      "--listen-host", this.config.host,
      "--listen-port", this.config.port.toString(),
    ], {
      stdout: "pipe",
      stderr: "pipe",
    });

    // Wait a bit for certificate generation
    await new Promise(resolve => setTimeout(resolve, 2000));

    proc.kill();
    await proc.exited;

    if (existsSync(this.caCertPath)) {
      console.log("✅ CA certificate generated successfully\n");
    } else {
      throw new Error("Failed to generate CA certificate");
    }
  }

  private async startProxy(): Promise<void> {
    const command = this.config.useWebUI ? "mitmweb" : "mitmproxy";
    const webPassword = this.config.webPassword || randomUUID();

    const args = [
      "--listen-host", this.config.host,
      "--listen-port", this.config.port.toString(),
    ];

    if (this.config.useWebUI) {
      args.push("--web-host", this.config.host);
      args.push("--web-port", String(this.config.webPort));
      args.push("--no-web-open-browser");
      args.push("--set", "web_open_browser=false");
      args.push("--set", `web_password=${webPassword}`);
    }

    console.log(`🚀 Starting ${command}...`);

    this.mitmproxyProcess = spawn([command, ...args], {
      stdout: this.config.showProxyOutput ? "inherit" : "pipe",
      stderr: this.config.showProxyOutput ? "inherit" : "pipe",
    });

    await new Promise(resolve => setTimeout(resolve, 1500));

    if (this.config.useWebUI) {
      const url = `http://${this.config.host}:${this.config.webPort}/?token=${encodeURIComponent(webPassword)}`;
      console.log(`\n🌐 mitmweb UI: ${url}`);

      try {
        spawn(["open", url], { stdout: "pipe", stderr: "pipe" });
        console.log("   Opening in browser...");
      } catch (error) {
        // Silently fail if open command not available
      }
    }
    console.log(`✅ Proxy listening on: ${this.config.host}:${this.config.port}\n`);
  }

  private async generateAndCopyEnvVars(): Promise<void> {
    const envCommand = `NODE_EXTRA_CA_CERTS="${this.caCertPath}" HTTPS_PROXY="http://${this.config.host}:${this.config.port}" HTTP_PROXY="http://${this.config.host}:${this.config.port}" NO_PROXY="localhost,127.0.0.1,.local"`;

    // Copy to clipboard
    try {
      const proc = spawn(["pbcopy"], {
        stdin: "pipe",
      });
      proc.stdin?.write(envCommand);
      proc.stdin?.end();
      await proc.exited;
    } catch (error) {
      // Silently fail if pbcopy not available
    }

    console.log("📋 Environment variables for Claude:\n");
    console.log(envCommand);
    console.log("\n📋 Command copied to clipboard!");
    console.log("\n🚀 To start Claude in another terminal:");
    console.log("   1. Open a new terminal");
    console.log("   2. Paste the command (Cmd+V)");
    console.log("   3. Run: claude");
    console.log("\n💡 Tips:");
    console.log("  - Keep this terminal open to keep the proxy running");
    console.log("  - Use the mitmweb UI above to inspect traffic");
    console.log("  - Press Ctrl+C here to stop the proxy\n");
  }

  public async run(): Promise<void> {
    console.log("🔧 Claude Code Proxy Inspection Manager\n");

    // Check if mitmproxy is installed
    if (!(await this.checkMitmproxyInstalled())) {
      console.error("❌ mitmproxy not found. Please install it first:");
      console.error("   brew install mitmproxy");
      process.exit(1);
    }

    // Ensure CA certificate exists
    await this.ensureCACertificate();

    // Start the proxy
    await this.startProxy();

    // Generate and display environment variables
    await this.generateAndCopyEnvVars();

    // Handle cleanup
    process.on("SIGINT", () => this.cleanup());
    process.on("SIGTERM", () => this.cleanup());

    // Keep running until Ctrl+C
    await new Promise(() => { }); // Wait forever
  }

  private cleanup(): void {
    console.log("\n🧹 Cleaning up...");

    if (this.mitmproxyProcess) {
      this.mitmproxyProcess.kill();
    }

    console.log("✅ Proxy stopped!");
    process.exit(0);
  }
}

// CLI Interface
if (import.meta.main) {
  const args = process.argv.slice(2);

  // Parse options
  let port = 8080;
  let webPort = 8081;
  let webPassword: string | undefined;
  let useWebUI = true;
  let showProxyOutput = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--port":
        port = parseInt(args[++i] || "8080");
        break;
      case "--web-port":
        webPort = parseInt(args[++i] || "8081");
        break;
      case "--web-password":
        webPassword = args[++i];
        break;
      case "--no-web":
        useWebUI = false;
        break;
      case "--show-proxy-output":
        showProxyOutput = true;
        break;
      case "--help":
        console.log(`
Claude Code Proxy Manager

Usage:
  bun run index.ts [options]

Options:
  --port PORT           Proxy port (default: 8080)
  --web-port PORT       Web UI port for mitmweb (default: 8081)
  --web-password TOKEN  Set a specific Web UI token (default: random UUID)
  --no-web              Use terminal UI instead of web UI (default: web UI)
  --show-proxy-output   Show mitmproxy output in terminal (default: hidden)
  --help                Show this help message

Examples:
  bun run index.ts                        # Start proxy with web UI
  bun run index.ts --port 9090            # Use custom proxy port
  bun run index.ts --web-password mytoken # Use specific token
  bun run index.ts --no-web               # Use terminal UI instead
  bun run index.ts --show-proxy-output    # Show mitmproxy logs

Workflow:
  1. Run this script - proxy starts automatically
  2. Environment variables are copied to clipboard
  3. Open another terminal and paste them
  4. Run: claude
  5. Keep this terminal open (proxy keeps running)
  6. Press Ctrl+C here when done to stop the proxy
`);
        process.exit(0);
      default:
        console.error(`Unknown option: ${args[i]}`);
        console.error("Run with --help for usage information");
        process.exit(1);
    }
  }

  const manager = new ClaudeProxyManager({
    port,
    webPort,
    webPassword,
    useWebUI,
    showProxyOutput
  });
  await manager.run();
}