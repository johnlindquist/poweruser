#!/usr/bin/env -S bun run

import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface APITesterOptions {
  url: string;
  reportFile: string;
}

function printHelp(): void {
  console.log(`
🔌 Chrome API Endpoint Tester

Usage:
  bun run agents/chrome-api-endpoint-tester.ts <url> [options]

Arguments:
  url                  URL to test

Options:
  --report <file>      Report output file (default: api-endpoint-test-report.md)
  --help, -h           Show this help

Description:
  Tests all API endpoints called by a web page using Chrome DevTools.
  Measures response times, checks status codes, identifies slow endpoints,
  and analyzes payload sizes.
  `);
}

function parseOptions(): APITesterOptions | null {
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

  const reportFile = typeof values.report === "string" ? values.report : "api-endpoint-test-report.md";

  return { url, reportFile };
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log('🔌 Chrome API Endpoint Tester\n');
console.log(`URL: ${options.url}`);
console.log(`Report: ${options.reportFile}\n`);

const prompt = `Test all API endpoints called by ${options.url}. Open page, list network requests filtered by XHR/fetch. For each API endpoint: measure response time, check status codes, identify slow endpoints (>500ms), test error handling, analyze payload sizes. Generate "${options.reportFile}" with endpoint inventory showing: URL, method, response time, status, size, and performance recommendations.`;

const settings: Settings = {};

const allowedTools = [
  "mcp__chrome-devtools__navigate_page",
  "mcp__chrome-devtools__new_page",
  "mcp__chrome-devtools__list_network_requests",
  "mcp__chrome-devtools__get_network_request",
  "mcp__chrome-devtools__evaluate_script",
  "Write",
  "TodoWrite",
];

const mcpConfig = {
  mcpServers: {
    "chrome-devtools": {
      command: "npx",
      args: ["chrome-devtools-mcp@latest", "--isolated"],
    },
  },
};

removeAgentFlags([
    "report", "help", "h"
  ]);

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
    console.log(`\n✅ API endpoint testing complete!`);
    console.log(`📄 Report: ${options.reportFile}`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
