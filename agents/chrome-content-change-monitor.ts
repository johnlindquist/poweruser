#!/usr/bin/env -S bun run

import { claude, getPositionals, parsedArgs } from './lib';
import type { ClaudeFlags, Settings } from './lib';

interface MonitorOptions {
  url: string;
  intervalSeconds: number;
  selector?: string;
  reportFile: string;
}

const DEFAULT_INTERVAL = 60;
const DEFAULT_REPORT_FILE = 'content-changes.md';

function printHelp(): void {
  console.log(`
👁️  Chrome Content Change Monitor

Usage:
  bun run agents/chrome-content-change-monitor.ts <url> [--interval <seconds>] [--selector <css>] [--report <file>]

Options:
  --interval <seconds>    Check interval (default: ${DEFAULT_INTERVAL})
  --selector <css>        CSS selector to monitor
  --report <file>         Report file (default: ${DEFAULT_REPORT_FILE})
  --help, -h              Show this help message
`);
}

const argv = process.argv.slice(2);
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
  console.error('❌ Error: Invalid URL');
  process.exit(1);
}

function readStringFlag(name: string): string | undefined {
  const raw = values[name];
  if (typeof raw === 'string' && raw.length > 0) {
    return raw;
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg === `--${name}`) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        return next;
      }
    }
    if (arg.startsWith(`--${name}=`)) {
      const [, value] = arg.split('=', 2);
      if (value && value.length > 0) {
        return value;
      }
    }
  }

  return undefined;
}

function readNumberFlag(name: string, defaultValue: number): number {
  const raw = readStringFlag(name);
  if (!raw) {
    return defaultValue;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(`❌ Error: --${name} must be a positive number`);
    process.exit(1);
  }

  return parsed;
}

const options: MonitorOptions = {
  url: urlCandidate,
  intervalSeconds: readNumberFlag('interval', DEFAULT_INTERVAL),
  selector: readStringFlag('selector'),
  reportFile: readStringFlag('report') ?? DEFAULT_REPORT_FILE,
};

console.log('👁️  Chrome Content Change Monitor\n');
console.log(`URL: ${options.url}`);
console.log(`Check interval: ${options.intervalSeconds}s`);
if (options.selector) {
  console.log(`Watching: ${options.selector}`);
}
console.log(`Report: ${options.reportFile}\n`);

function buildPrompt(opts: MonitorOptions): string {
  const { url, intervalSeconds, selector, reportFile } = opts;

  return `Monitor ${url} for content changes. ${selector ? `Focus on element matching selector "${selector}".` : 'Monitor entire page content.'} Take initial snapshot/screenshot as baseline. Wait ${intervalSeconds} seconds, refresh page, take new snapshot/screenshot. Use evaluate_script to extract ${selector ? 'targeted element' : 'page'} content and compare with baseline. Detect: text changes, element additions/removals, attribute changes, style changes. Generate ${reportFile} with: timestamp of changes, what changed (before/after), visual diff screenshots, change summary. If no changes detected, report "No changes detected".`;
}

const prompt = buildPrompt(options);

const claudeSettings: Settings = {};

const allowedTools = [
  'mcp__chrome-devtools__navigate_page',
  'mcp__chrome-devtools__take_snapshot',
  'mcp__chrome-devtools__take_screenshot',
  'mcp__chrome-devtools__evaluate_script',
  'mcp__chrome-devtools__wait_for',
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
  'permission-mode': 'acceptEdits',
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
