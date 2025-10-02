#!/usr/bin/env -S bun run

import { claude, getPositionals, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type TaskKind = 'screenshot' | 'scrape' | 'test';

interface BatchProcessorOptions {
  urlFile: string;
  task: TaskKind;
  outputDir: string;
  selector?: string;
}

function printHelp(): void {
  console.log(`\n⚡ Chrome Batch URL Processor\n\nUsage:\n  bun run agents/chrome-batch-url-processor.ts <url-file> <task> [--output <dir>] [--selector <css>]\n\nTasks:\n  screenshot    Take screenshots of all URLs\n  scrape        Scrape data from all URLs\n  test          Test all URLs for errors and performance\n\nOptions:\n  --output <dir>       Output directory (default: ./batch-output)\n  --selector <css>     CSS selector for scraping (default: body)\n  --help, -h           Show this help message\n`);
}

const argv = process.argv.slice(2);
const positionals = getPositionals();
const values = parsedArgs.values as Record<string, unknown>;

const help = values.help === true || values.h === true;

if (help) {
  printHelp();
  process.exit(0);
}

if (positionals.length < 2) {
  console.error('❌ Error: URL file and task are required');
  printHelp();
  process.exit(1);
}

const taskValue = positionals[1] as TaskKind;
const validTasks: TaskKind[] = ['screenshot', 'scrape', 'test'];
if (!validTasks.includes(taskValue)) {
  console.error(`❌ Error: task must be one of ${validTasks.join(', ')}`);
  process.exit(1);
}

function readStringFlag(name: string): string | undefined {
  const raw = values[name];
  if (typeof raw === 'string' && raw.length > 0) {
    return raw;
  }

  const index = argv.indexOf(`--${name}`);
  if (index !== -1 && argv[index + 1] && !argv[index + 1]!.startsWith('--')) {
    return argv[index + 1]!;
  }

  const equalsForm = argv.find((arg) => arg.startsWith(`--${name}=`));
  if (equalsForm) {
    const [, value] = equalsForm.split('=', 2);
    if (value && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

const batchOptions: BatchProcessorOptions = {
  urlFile: positionals[0]!,
  task: taskValue,
  outputDir: readStringFlag('output') ?? './batch-output',
  selector: readStringFlag('selector'),
};

function buildPrompt(options: BatchProcessorOptions): string {
  const taskPrompts: Record<TaskKind, string> = {
    screenshot: `For each URL: mcp__chrome-devtools__navigate_page, wait for load, take full-page screenshot saved to ${options.outputDir}/[sanitized-url].png. Generate summary report with all URLs and their screenshot paths.`,
    scrape: `For each URL: mcp__chrome-devtools__navigate_page, extract data matching selector "${options.selector || 'body'}" using evaluate_script, save to ${options.outputDir}/[sanitized-url].json. Generate summary with items scraped per URL.`,
    test: `For each URL: mcp__chrome-devtools__navigate_page, check for console errors, measure load time, verify page loads successfully (status 200), take screenshot. Generate test report in ${options.outputDir}/test-results.md with pass/fail status, load times, and error counts.`,
  };

  return `mcp__chrome-devtools__navigate_page to Read URLs from ${options.urlFile} (one URL per line). Process all URLs in batch. ${taskPrompts[options.task]} Handle errors gracefully, continue processing remaining URLs if one fails. Report total URLs processed, successes, failures.`;
}

console.log('⚡ Chrome Batch URL Processor\n');
console.log(`URL file: ${batchOptions.urlFile}`);
console.log(`Task: ${batchOptions.task}`);
console.log(`Output: ${batchOptions.outputDir}`);
if (batchOptions.selector) {
  console.log(`Selector: ${batchOptions.selector}`);
}
console.log('');

const prompt = buildPrompt(batchOptions);
const claudeSettings: Settings = {};

const allowedTools = [
  'mcp__chrome-devtools__list_pages',
  'mcp__chrome-devtools__navigate_page',
  'mcp__chrome-devtools__new_page',
  'mcp__chrome-devtools__take_screenshot',
  'mcp__chrome-devtools__take_snapshot',
  'mcp__chrome-devtools__evaluate_script',
  'mcp__chrome-devtools__wait_for',
  'mcp__chrome-devtools__list_console_messages',
  'mcp__chrome-devtools__close_page',
  'Read',
  'Write',
  'Bash',
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

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
  console.log(`\n✅ Batch processing complete: ${batchOptions.outputDir}`);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
