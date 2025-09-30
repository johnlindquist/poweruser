#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';

interface BatchProcessorOptions { urlFile: string; task: 'screenshot' | 'scrape' | 'test'; outputDir?: string; selector?: string; }

async function processBatch(options: BatchProcessorOptions) {
  const { urlFile, task, outputDir = './batch-output', selector } = options;
  console.log('⚡ Chrome Batch URL Processor\n');
  console.log(`URL file: ${urlFile}`);
  console.log(`Task: ${task}`);
  console.log(`Output: ${outputDir}\n`);

  const taskPrompts = {
    screenshot: `For each URL: open page, wait for load, take full-page screenshot saved to ${outputDir}/[sanitized-url].png. Generate summary report with all URLs and their screenshot paths.`,
    scrape: `For each URL: open page, extract data matching selector "${selector || 'body'}" using evaluate_script, save to ${outputDir}/[sanitized-url].json. Generate summary with items scraped per URL.`,
    test: `For each URL: open page, check for console errors, measure load time, verify page loads successfully (status 200), take screenshot. Generate test report in ${outputDir}/test-results.md with pass/fail status, load times, and error counts.`
  };

  const prompt = `Read URLs from ${urlFile} (one URL per line). Process all URLs in batch. ${taskPrompts[task]} Handle errors gracefully, continue processing remaining URLs if one fails. Report total URLs processed, successes, failures.`;

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args: ['chrome-devtools-mcp@latest', '--isolated'] }},
      allowedTools: ['mcp__chrome-devtools__navigate_page', 'mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__take_screenshot', 'mcp__chrome-devtools__evaluate_script', 'mcp__chrome-devtools__wait_for', 'mcp__chrome-devtools__list_console_messages', 'mcp__chrome-devtools__close_page', 'Read', 'Write', 'Bash', 'TodoWrite'],
      permissionMode: 'acceptEdits',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  const toolName = input.tool_name;
                  if (toolName === 'Read' && (input.tool_input as any).file_path === urlFile) {
                    console.log('📄 Reading URL list...');
                  } else if (toolName === 'mcp__chrome-devtools__navigate_page') {
                    const url = (input.tool_input as any).url;
                    console.log(`🌐 Processing: ${url}`);
                  } else if (toolName === 'mcp__chrome-devtools__take_screenshot') {
                    console.log('📸 Taking screenshot...');
                  } else if (toolName === 'mcp__chrome-devtools__evaluate_script') {
                    console.log('🕷️  Scraping data...');
                  } else if (toolName === 'mcp__chrome-devtools__list_console_messages') {
                    console.log('🔍 Checking console errors...');
                  } else if (toolName === 'Write' && (input.tool_input as any).file_path?.includes('test-results')) {
                    console.log('📝 Generating test report...');
                  } else if (toolName === 'Bash') {
                    console.log('📁 Setting up output directory...');
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
                  if (toolName === 'Write' && (input.tool_input as any).file_path?.includes('test-results')) {
                    console.log('✅ Test report complete');
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
                console.log('\n✨ Batch processing complete!');
                return { continue: true };
              },
            ],
          },
        ],
      },
      maxTurns: 50,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  for await (const message of result) {
    if (message.type === 'result' && message.subtype === 'success') {
      console.log(`\n✅ Batch processing complete: ${outputDir}`);
      if (message.result) console.log('\n' + message.result);
    }
  }
}

const args = process.argv.slice(2);
if (args.length < 2 || args.includes('--help')) {
  console.log('\n⚡ Chrome Batch URL Processor\n\nUsage:\n  bun run agents/chrome-batch-url-processor.ts <url-file> <task> [--output <dir>] [--selector <css>]\n\nTasks:\n  screenshot    Take screenshots of all URLs\n  scrape        Scrape data from all URLs\n  test          Test all URLs for errors and performance\n\nOptions:\n  --output <dir>       Output directory (default: ./batch-output)\n  --selector <css>     CSS selector for scraping (default: body)\n');
  process.exit(0);
}

const options: BatchProcessorOptions = { urlFile: args[0]!, task: args[1] as any };
const outputIndex = args.indexOf('--output');
if (outputIndex !== -1 && args[outputIndex + 1]) options.outputDir = args[outputIndex + 1];
const selectorIndex = args.indexOf('--selector');
if (selectorIndex !== -1 && args[selectorIndex + 1]) options.selector = args[selectorIndex + 1];

processBatch(options).catch((err) => { console.error('❌ Fatal error:', err); process.exit(1); });
