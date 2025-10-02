#!/usr/bin/env -S bun run

import { claude, getPositionals, parsedArgs } from './lib';
import type { ClaudeFlags, Settings } from './lib';

interface OptimizerOptions {
  url: string;
  reportFile: string;
}

const DEFAULT_REPORT_FILE = 'page-speed-optimization-plan.md';

function printHelp(): void {
  console.log(`
⚡ Chrome Page Speed Optimizer

Usage:
  bun run agents/chrome-page-speed-optimizer.ts <url> [--report <file>]

Options:
  --report <file>    Output report filename (default: ${DEFAULT_REPORT_FILE})
  --help, -h         Show this help message
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
  console.error('❌ Error: Invalid URL format');
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

const options: OptimizerOptions = {
  url: urlCandidate,
  reportFile: readStringFlag('report') ?? DEFAULT_REPORT_FILE,
};

console.log('⚡ Chrome Page Speed Optimizer\n');
console.log(`URL: ${options.url}\n`);

function buildPrompt(opts: OptimizerOptions): string {
  const { url, reportFile } = opts;

  return `Analyze ${url} for all performance bottlenecks. Run performance trace, analyze insights (LCP, TBT, CLS), list network requests. Identify: render-blocking resources, large images, slow third-parties, unoptimized CSS/JS. Generate "${reportFile}" with prioritized action plan showing estimated speed improvements for each fix.`;
}

const prompt = buildPrompt(options);

const claudeSettings: Settings = {};

const allowedTools = [
  'mcp__chrome-devtools__navigate_page',
  'mcp__chrome-devtools__new_page',
  'mcp__chrome-devtools__performance_start_trace',
  'mcp__chrome-devtools__performance_stop_trace',
  'mcp__chrome-devtools__performance_analyze_insight',
  'mcp__chrome-devtools__list_network_requests',
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
