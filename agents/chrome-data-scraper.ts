#!/usr/bin/env -S bun run

import { claude, getPositionals, parsedArgs, readStringFlag, readNumberFlag } from './lib';
import type { ClaudeFlags, Settings } from './lib';

type OutputFormat = 'json' | 'csv' | 'markdown';

interface ScraperOptions {
  url: string;
  prompt: string;
  outputFile: string;
  format: OutputFormat;
  maxItems: number;
}

const DEFAULT_FORMAT: OutputFormat = 'json';
const DEFAULT_MAX_ITEMS = 100;

function printHelp(): void {
  console.log(`\n🕷️  Chrome Data Scraper\n\nUsage:\n  bun run agents/chrome-data-scraper.ts <url> "<data description>" [--output <file>] [--format json|csv|markdown] [--max-items <number>]\n\nExamples:\n  bun run agents/chrome-data-scraper.ts https://example.com "extract all product names and prices"\n  bun run agents/chrome-data-scraper.ts https://news.example.com "get headlines and publication dates" --format csv\n  bun run agents/chrome-data-scraper.ts https://shop.example.com "scrape product information with prices and ratings" --output products.json --max-items 50\n  bun run agents/chrome-data-scraper.ts https://blog.example.com "extract article titles and author names" --format markdown\n`);
}

const positionals = getPositionals();
const values = parsedArgs.values as Record<string, unknown>;

const help = values.help === true || values.h === true;
if (help) {
  printHelp();
  process.exit(0);
}

function parseOptions(): ScraperOptions {
  const url = positionals[0];
  const dataPrompt = positionals[1];

  if (!url || !dataPrompt) {
    printHelp();
    process.exit(1);
  }

  const outputFile = readStringFlag('output');
  const formatRaw = readStringFlag('format');
  const format = formatRaw && ['json', 'csv', 'markdown'].includes(formatRaw)
    ? (formatRaw as OutputFormat)
    : DEFAULT_FORMAT;

  const maxItems = readNumberFlag('max-items', DEFAULT_MAX_ITEMS);

  const resolvedOutput = outputFile ?? `scraped-data.${format}`;

  return {
    url,
    prompt: dataPrompt,
    outputFile: resolvedOutput,
    format,
    maxItems,
  };
}

function buildPrompt(options: ScraperOptions): string {
  const { url, prompt: dataPrompt, outputFile, format, maxItems } = options;

  const systemPrompt = `You are an expert web scraping assistant. Use Chrome DevTools to analyze the page structure and extract the requested data.

Follow this process:
1. Navigate to the target URL and take a snapshot to understand the page structure
2. Identify the best selectors or extraction strategy based on the user's data request
3. Use evaluate_script to extract structured data from the page
4. If the initial approach doesn't work well, try alternative selectors or methods
5. Format the extracted data according to the requested output format
6. Save the results to the specified output file

Data extraction strategies:
- For tables: Use table rows and cells to extract structured data
- For lists/cards: Use repeated container elements with consistent structure
- For product information: Look for price, title, description patterns
- For articles: Extract headings, content, metadata
- For forms: Get field names, types, and current values

Always include:
- Total count of items extracted
- Data validation and cleaning
- Preview of first few items
- Any extraction challenges or limitations encountered`;

  return `${systemPrompt}

User request: Extract the following data from ${url}: ${dataPrompt}

Please extract the data and save it as ${format} to ${outputFile}. Limit extraction to ${maxItems} items to avoid overwhelming the output.

Start by navigating to the page and analyzing its structure to determine the best extraction approach.`;
}

const options = parseOptions();

console.log('🕷️  Chrome Data Scraper\n');
console.log(`URL: ${options.url}`);
console.log(`Data request: ${options.prompt}`);
console.log(`Output: ${options.outputFile}`);
console.log(`Format: ${options.format}`);
console.log(`Max items: ${options.maxItems}\n`);

const prompt = buildPrompt(options);
const claudeSettings: Settings = {};

const allowedTools = [
  'mcp__chrome-devtools__navigate_page',
  'mcp__chrome-devtools__new_page',
  'mcp__chrome-devtools__evaluate_script',
  'mcp__chrome-devtools__wait_for',
  'mcp__chrome-devtools__take_snapshot',
  'mcp__chrome-devtools__take_screenshot',
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
  'permission-mode': 'acceptEdits',
  'mcp-config': JSON.stringify(mcpConfig),
  'strict-mcp-config': true,
};

claude(prompt, defaultFlags)
  .then((exitCode) => {
    if (exitCode === 0) {
      console.log(`\n✅ Data scraped: ${options.outputFile}`);
    }
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
