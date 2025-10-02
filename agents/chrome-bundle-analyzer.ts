#!/usr/bin/env -S bun run

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface BundleAnalyzerOptions {
  url: string;
  reportFile: string;
}

function printHelp(): void {
  console.log(`
📦 Chrome Bundle Analyzer

Usage:
  bun run agents/chrome-bundle-analyzer.ts <url> [options]

Arguments:
  url                  URL to analyze

Options:
  --report <file>      Report output file (default: bundle-analysis-report.md)
  --help, -h           Show this help

Description:
  Analyzes JavaScript bundles using Chrome DevTools to identify:
  - Bundle sizes (raw vs gzipped)
  - Duplicate dependencies
  - Large libraries that could be replaced
  - Code-splitting opportunities
  - Tree-shaking opportunities
  `);
}

function parseOptions(): BundleAnalyzerOptions | null {
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

  const reportFile = typeof values.report === "string" ? values.report : "bundle-analysis-report.md";

  return { url, reportFile };
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["report", "help", "h"] as const;

  for (const key of agentKeys) {
    if (key in values) {
      delete values[key];
    }
  }
}

const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log('📦 Chrome Bundle Analyzer\n');
console.log(`URL: ${options.url}`);
console.log(`Report: ${options.reportFile}\n`);

const prompt = `Analyze JavaScript bundles for ${options.url}. List network requests filtered by scripts. For each JS file: measure size (raw vs gzipped), analyze loading priority, identify if render-blocking. Use JS to check for: duplicate dependencies (e.g., multiple lodash versions), unused code opportunities, large libraries that could be replaced with smaller alternatives. Suggest code-splitting opportunities. Generate "${options.reportFile}" with: bundle inventory (sizes, load order), duplicate dependencies to deduplicate, large libraries to replace, code-splitting recommendations, tree-shaking opportunities, estimated savings from optimizations.`;

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
    console.log(`\n✅ Bundle analysis complete!`);
    console.log(`📄 Report: ${options.reportFile}`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
