#!/usr/bin/env -S bun run

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface VisualRegressionOptions {
  url: string;
  createBaseline: boolean;
  baselineDir: string;
  breakpoints: number[];
  reportFile: string;
  threshold: number;
}

function printHelp(): void {
  console.log(`
📸 Chrome Visual Regression Tester

Usage:
  bun run agents/chrome-visual-regression-tester.ts <url> [options]

Arguments:
  url                     Website URL to test

Options:
  --create-baseline       Create new baseline images
  --baseline-dir <dir>    Baseline directory (default: ./visual-regression-baselines)
  --breakpoints <list>    Comma-separated widths (default: 375,768,1280,1920)
  --report <file>         Report file (default: visual-regression-report.md)
  --threshold <num>       Difference threshold 0-1 (default: 0.1)
  --help, -h              Show this help
  `);
}

function parseOptions(): VisualRegressionOptions | null {
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

  const createBaseline = values["create-baseline"] === true;
  const baselineDir = typeof values["baseline-dir"] === "string" ? values["baseline-dir"] : "./visual-regression-baselines";
  const breakpoints = typeof values.breakpoints === "string"
    ? values.breakpoints.split(',').map(Number)
    : [375, 768, 1280, 1920];
  const reportFile = typeof values.report === "string" ? values.report : "visual-regression-report.md";
  const threshold = typeof values.threshold === "string" ? parseFloat(values.threshold) : 0.1;

  return { url, createBaseline, baselineDir, breakpoints, reportFile, threshold };
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["create-baseline", "baseline-dir", "breakpoints", "report", "threshold", "help", "h"] as const;
  for (const key of agentKeys) {
    if (key in values) delete values[key];
  }
}

const options = parseOptions();
if (!options) process.exit(0);

console.log('📸 Chrome Visual Regression Tester\n');
console.log(`URL: ${options.url}`);
console.log(`Mode: ${options.createBaseline ? 'Creating Baseline' : 'Testing Changes'}`);
console.log(`Breakpoints: ${options.breakpoints.join(', ')}px\n`);

const prompt = `You are a visual regression testing expert. Target URL: ${options.url}. Mode: ${options.createBaseline ? 'CREATE BASELINE' : 'TEST FOR CHANGES'}. Breakpoints: ${options.breakpoints.join(', ')}px. ${options.createBaseline ? `Take screenshots at each breakpoint and save to ${options.baselineDir}.` : `Take screenshots, compare against baselines in ${options.baselineDir}, detect differences (threshold ${options.threshold}), generate visual diff report to "${options.reportFile}".`}`;

const settings: Settings = {};
const allowedTools = ["mcp__chrome-devtools__navigate_page", "mcp__chrome-devtools__new_page", "mcp__chrome-devtools__take_screenshot", "mcp__chrome-devtools__resize_page", "Bash", "Read", "Write", "TodoWrite"];
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
    if (options.createBaseline) {
      console.log('\n✨ Baseline created!');
      console.log(`📁 Directory: ${options.baselineDir}`);
    } else {
      console.log('\n✨ Visual regression test complete!');
      console.log(`📄 Report: ${options.reportFile}`);
    }
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
