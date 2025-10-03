#!/usr/bin/env -S bun run

import { claude, getPositionals, parsedArgs, readStringFlag, readNumberFlag } from './lib';
import type { ClaudeFlags, Settings } from './lib';

interface VitalsTrackerOptions {
  url: string;
  runs: number;
  reportFile: string;
}

const DEFAULT_RUNS = 5;
const DEFAULT_REPORT_FILE = 'web-vitals-tracking-report.md';

function printHelp(): void {
  console.log(`
📈 Chrome Web Vitals Tracker

Usage:
  bun run agents/chrome-web-vitals-tracker.ts <url> [--runs <number>] [--report <file>]

Options:
  --runs <number>    Number of test runs (default: ${DEFAULT_RUNS})
  --report <file>    Report filename (default: ${DEFAULT_REPORT_FILE})
  --help, -h         Show this help message
`);
}

const positionals = getPositionals();
const values = parsedArgs.values as Record<string, unknown>;

const help = values.help === true || values.h === true;
if (help) {
  printHelp();
  process.exit(0);
}

if (positionals.length === 0) {
  console.error('❌ Error: URL required');
  printHelp();
  process.exit(1);
}

const urlCandidate = positionals[0]!;
try {
  new URL(urlCandidate);
} catch {
  console.error('❌ Error: Invalid URL format');
  process.exit(1);
}

const options: VitalsTrackerOptions = {
  url: urlCandidate,
  runs: readNumberFlag('runs', DEFAULT_RUNS),
  reportFile: readStringFlag('report') ?? DEFAULT_REPORT_FILE,
};

console.log('📈 Chrome Web Vitals Tracker\n');
console.log(`URL: ${options.url}`);
console.log(`Test Runs: ${options.runs}\n`);

function buildPrompt(opts: VitalsTrackerOptions): string {
  const { url, runs, reportFile } = opts;

  return `Track Core Web Vitals for ${url} over ${runs} test runs. For each run: open fresh page, run performance trace, measure LCP, CLS, INP/FID, TTFB. Collect all measurements. Calculate statistics: mean, median, p75, p95, min, max for each metric. Identify variability and outliers. Generate "${reportFile}" with: statistical analysis, trends, pass/fail for each metric, consistency assessment, recommendations to improve reliability and reduce variance.`;
}

const prompt = buildPrompt(options);

const claudeSettings: Settings = {};

const allowedTools = [
  'mcp__chrome-devtools__navigate_page',
  'mcp__chrome-devtools__new_page',
  'mcp__chrome-devtools__performance_start_trace',
  'mcp__chrome-devtools__performance_stop_trace',
  'mcp__chrome-devtools__performance_analyze_insight',
  'mcp__chrome-devtools__close_page',
  'Write',
  'TodoWrite',
];

const mcpConfig = {
  mcpServers: {
    'chrome-devtools': {
      command: 'npx',
      args: ['chrome-devtools-mcp@latest', '--isolated'],
    },
  },
};

const defaultFlags: ClaudeFlags = {
  model: 'claude-sonnet-4-5-20250929',
  settings: JSON.stringify(claudeSettings),
  allowedTools: allowedTools.join(' '),
  'permission-mode': 'bypassPermissions',
  'mcp-config': JSON.stringify(mcpConfig),
  'strict-mcp-config': true,
};

claude(prompt, defaultFlags)
  .then((exitCode) => {
    if (exitCode === 0) {
      console.log(`\n📄 Report: ${options.reportFile}`);
    }
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
