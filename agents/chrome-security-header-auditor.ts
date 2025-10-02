#!/usr/bin/env -S bun run

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface SecurityAuditOptions {
  url: string;
  reportFile: string;
}

function printHelp(): void {
  console.log(`
🔒 Chrome Security Header Auditor

Usage:
  bun run agents/chrome-security-header-auditor.ts <url> [options]

Arguments:
  url                     Website URL to audit

Options:
  --report <file>         Output file (default: security-audit-report.md)
  --help, -h              Show this help
  `);
}

function parseOptions(): SecurityAuditOptions | null {
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

  try {
    new URL(url);
  } catch (error) {
    console.error('❌ Error: Invalid URL');
    process.exit(1);
  }

  const reportFile = typeof values.report === "string" ? values.report : "security-audit-report.md";
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

console.log('🔒 Chrome Security Header Auditor\n');
console.log(`URL: ${options.url}\n`);

const prompt = `You are a web security expert using Chrome DevTools MCP to audit security headers. Target URL: ${options.url}. Open the page, analyze network requests, extract and check security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). Check for missing headers, weak policies, mixed content, insecure cookies. Generate security audit report and save to "${options.reportFile}" with findings, recommendations, and implementation examples.`;

const settings: Settings = {};
const allowedTools = ["mcp__chrome-devtools__navigate_page", "mcp__chrome-devtools__new_page", "mcp__chrome-devtools__list_network_requests", "mcp__chrome-devtools__get_network_request", "mcp__chrome-devtools__evaluate_script", "Write", "TodoWrite"];
const mcpConfig = { mcpServers: { "chrome-devtools": { command: "npx", args: ["chrome-devtools-mcp@latest", "--isolated"] }}};

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
    console.log('\n✅ Security audit complete!');
    console.log(`📄 Report: ${options.reportFile}`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
