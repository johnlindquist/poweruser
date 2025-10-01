#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';

interface ScraperOptions {
  url: string;
  prompt: string;
  outputFile?: string;
  format?: 'json' | 'csv' | 'markdown';
  maxItems?: number;
}

async function scrapeData(options: ScraperOptions) {
  const { url, prompt: dataPrompt, outputFile, format = 'json', maxItems = 100 } = options;
  const output = outputFile || `scraped-data.${format}`;
  console.log('🕷️  Chrome Data Scraper\n');
  console.log(`URL: ${url}`);
  console.log(`Data request: ${dataPrompt}`);
  console.log(`Output: ${output}`);
  console.log(`Format: ${format}\n`);

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

  const fullPrompt = `${systemPrompt}

User request: Extract the following data from ${url}: ${dataPrompt}

Please extract the data and save it as ${format} to ${output}. Limit extraction to ${maxItems} items to avoid overwhelming the output.

Start by navigating to the page and analyzing its structure to determine the best extraction approach.`;

  const result = query({
    prompt: fullPrompt,
    options: {
      cwd: process.cwd(),
      mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args: ['chrome-devtools-mcp@latest', '--isolated'] }},
      allowedTools: [
        'mcp__chrome-devtools__navigate_page',
        'mcp__chrome-devtools__new_page',
        'mcp__chrome-devtools__evaluate_script',
        'mcp__chrome-devtools__wait_for',
        'mcp__chrome-devtools__take_snapshot',
        'mcp__chrome-devtools__take_screenshot',
        'mcp__chrome-devtools__list_network_requests',
        'Write',
        'TodoWrite'
      ],
      permissionMode: 'acceptEdits',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  const toolName = input.tool_name;
                  if (toolName === 'mcp__chrome-devtools__navigate_page') {
                    console.log('🌐 Loading target page...');
                  } else if (toolName === 'mcp__chrome-devtools__take_snapshot') {
                    console.log('🔍 Analyzing page structure...');
                  } else if (toolName === 'mcp__chrome-devtools__evaluate_script') {
                    console.log('🕷️  Extracting data...');
                  } else if (toolName === 'mcp__chrome-devtools__take_screenshot') {
                    console.log('📸 Taking screenshot for reference...');
                  } else if (toolName === 'Write') {
                    const filePath = (input.tool_input as any).file_path;
                    console.log(`💾 Saving to: ${filePath}`);
                  }
                }
                return { continue: true };
              },
            ],
          },
        ],
        PostToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PostToolUse') {
                  const toolName = input.tool_name;
                  if (toolName === 'mcp__chrome-devtools__take_snapshot') {
                    console.log('✅ Page structure analyzed');
                  } else if (toolName === 'mcp__chrome-devtools__evaluate_script') {
                    console.log('✅ Data extracted');
                  } else if (toolName === 'Write') {
                    console.log('✅ Data saved');
                  }
                }
                return { continue: true };
              },
            ],
          },
        ],
        SessionEnd: [
          {
            hooks: [
              async () => {
                console.log('\n✨ Data scraping complete!');
                return { continue: true };
              },
            ],
          },
        ],
      },
      maxTurns: 20,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  for await (const message of result) {
    if (message.type === 'result' && message.subtype === 'success') {
      console.log(`\n✅ Data scraped: ${output}`);
      if (message.result) console.log('\n' + message.result);
    }
  }
}

const args = process.argv.slice(2);
if (args.length < 2 || args.includes('--help')) {
  console.log('\n🕷️  Chrome Data Scraper\n\nUsage:\n  bun run agents/chrome-data-scraper.ts <url> "<data description>" [--output <file>] [--format json|csv|markdown] [--max-items <number>]\n\nExamples:\n  bun run agents/chrome-data-scraper.ts https://example.com "extract all product names and prices"\n  bun run agents/chrome-data-scraper.ts https://news.example.com "get headlines and publication dates" --format csv\n  bun run agents/chrome-data-scraper.ts https://shop.example.com "scrape product information with prices and ratings" --output products.json --max-items 50\n  bun run agents/chrome-data-scraper.ts https://blog.example.com "extract article titles and author names" --format markdown\n');
  process.exit(0);
}

const options: ScraperOptions = { url: args[0]!, prompt: args[1]! };
const outputIndex = args.indexOf('--output');
if (outputIndex !== -1 && args[outputIndex + 1]) options.outputFile = args[outputIndex + 1];
const formatIndex = args.indexOf('--format');
if (formatIndex !== -1 && args[formatIndex + 1]) options.format = args[formatIndex + 1] as any;
const maxItemsIndex = args.indexOf('--max-items');
if (maxItemsIndex !== -1 && args[maxItemsIndex + 1]) options.maxItems = parseInt(args[maxItemsIndex + 1]!, 10);

scrapeData(options).catch((err) => { console.error('❌ Fatal error:', err); process.exit(1); });
