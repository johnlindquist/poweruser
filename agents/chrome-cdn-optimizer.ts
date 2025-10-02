#!/usr/bin/env -S bun run

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface CDNOptions {
  url: string;
  reportFile: string;
}

function printHelp(): void {
  console.log(`
🌐 Chrome CDN Optimizer

Usage:
  bun run agents/chrome-cdn-optimizer.ts <url> [options]

Arguments:
  url                  URL to analyze

Options:
  --report <file>      Report output file (default: cdn-optimization-report.md)
  --help, -h           Show this help
  `);
}

function parseOptions(): CDNOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const url = positionals[0];
  if (!url) {
    console.error('❌ Error: URL is required');
    printHelp();
    process.exit(1);
  }

  const reportFile = typeof values.report === "string" ? values.report : "cdn-optimization-report.md";
  return { url, reportFile };
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["report", "help", "h"] as const;
  for (const key of agentKeys) {
    if (key in values) delete values[key];
  }
}

const options = parseOptions();
if (!options) process.exit(0);

console.log('🌐 Chrome CDN Optimizer\n');
console.log(`URL: ${options.url}`);
console.log(`Report: ${options.reportFile}\n`);

const prompt = `Analyze CDN usage for ${options.url}. List network requests, identify resources loaded from CDNs vs origin. Check: cache headers (Cache-Control, Expires, ETag), compression (gzip/brotli), HTTP/2 support, geographic distribution. For each resource: check if CDN-eligible but loading from origin, verify cache headers are optimal, identify missing compression. Generate "${options.reportFile}" with recommendations: resources to move to CDN, cache header improvements, compression opportunities, CDN configuration best practices.`;

const settings: Settings = {};
const allowedTools = ["mcp__chrome-devtools__navigate_page", "mcp__chrome-devtools__new_page", "mcp__chrome-devtools__list_network_requests", "mcp__chrome-devtools__get_network_request", "Write", "TodoWrite"];
const mcpConfig = { mcpServers: { "chrome-devtools": { command: "npx", args: ["chrome-devtools-mcp@latest", "--isolated"] } } };

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  "mcp-config": JSON.stringify(mcpConfig),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
  "strict-mcp-config": true,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log(`\n✅ CDN optimization analysis complete!`);
    console.log(`📄 Report: ${options.reportFile}`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
