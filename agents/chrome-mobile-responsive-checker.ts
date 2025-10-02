#!/usr/bin/env -S bun run

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface ResponsiveOptions {
  url: string;
  breakpoints: number[];
  reportFile: string;
  testDevices: boolean;
}

function printHelp(): void {
  console.log(`
📱 Chrome Mobile Responsive Checker

Usage:
  bun run agents/chrome-mobile-responsive-checker.ts <url> [options]

Arguments:
  url                     Website URL to test

Options:
  --breakpoints <list>    Comma-separated widths (default: 320,375,414,768,1024,1280,1920)
  --devices               Test specific device configurations
  --report <file>         Output file (default: responsive-check-report.md)
  --help, -h              Show this help
  `);
}

function parseOptions(): ResponsiveOptions | null {
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

  const breakpoints = typeof values.breakpoints === "string"
    ? values.breakpoints.split(',').map(Number)
    : [320, 375, 414, 768, 1024, 1280, 1920];
  const reportFile = typeof values.report === "string" ? values.report : "responsive-check-report.md";
  const testDevices = values.devices === true;

  return { url, breakpoints, reportFile, testDevices };
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["breakpoints", "devices", "report", "help", "h"] as const;
  for (const key of agentKeys) {
    if (key in values) delete values[key];
  }
}

const options = parseOptions();
if (!options) process.exit(0);

console.log('📱 Chrome Mobile Responsive Checker\n');
console.log(`URL: ${options.url}`);
console.log(`Breakpoints: ${options.breakpoints.join(', ')}px\n`);

const deviceConfigs = options.testDevices
  ? [
      { name: 'iPhone SE', width: 375, height: 667 },
      { name: 'iPhone 12 Pro', width: 390, height: 844 },
      { name: 'iPad', width: 768, height: 1024 },
      { name: 'iPad Pro', width: 1024, height: 1366 },
    ]
  : [];

const prompt = `You are a responsive design expert using Chrome DevTools MCP to test mobile responsiveness. Target URL: ${options.url}. Breakpoints: ${options.breakpoints.join(', ')} pixels${options.testDevices ? `. Test Devices: ${deviceConfigs.map((d) => d.name).join(', ')}` : ''}. Test each breakpoint by resizing viewport, checking for overflow, small touch targets, and responsive issues. ${options.testDevices ? 'Also test on specific device configurations.' : ''} Generate comprehensive report and save to "${options.reportFile}".`;

const settings: Settings = {};
const allowedTools = ["mcp__chrome-devtools__navigate_page", "mcp__chrome-devtools__new_page", "mcp__chrome-devtools__take_screenshot", "mcp__chrome-devtools__take_snapshot", "mcp__chrome-devtools__resize_page", "mcp__chrome-devtools__evaluate_script", "mcp__chrome-devtools__wait_for", "Write", "TodoWrite"];
const mcpConfig = { mcpServers: { "chrome-devtools": { command: "npx", args: ["chrome-devtools-mcp@latest", "--isolated"] }}};

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  "mcp-config": JSON.stringify(mcpConfig),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "acceptEdits",
  "strict-mcp-config": true,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log('\n✨ Responsive check complete!');
    console.log(`📄 Report: ${options.reportFile}`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
