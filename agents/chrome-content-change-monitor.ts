#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';

interface MonitorOptions { url: string; interval?: number; selector?: string; reportFile?: string; }

async function monitorContent(options: MonitorOptions) {
  const { url, interval = 60, selector, reportFile = 'content-changes.md' } = options;
  console.log('👁️  Chrome Content Change Monitor\n');
  console.log(`URL: ${url}`);
  console.log(`Check interval: ${interval}s`);
  if (selector) console.log(`Watching: ${selector}`);
  console.log(`Report: ${reportFile}\n`);

  const prompt = `Monitor ${url} for content changes. ${selector ? `Focus on element matching selector "${selector}".` : 'Monitor entire page content.'} Take initial snapshot/screenshot as baseline. Wait ${interval} seconds, refresh page, take new snapshot/screenshot. Use evaluate_script to extract ${selector ? 'targeted element' : 'page'} content and compare with baseline. Detect: text changes, element additions/removals, attribute changes, style changes. Generate ${reportFile} with: timestamp of changes, what changed (before/after), visual diff screenshots, change summary. If no changes detected, report "No changes detected".`;

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args: ['chrome-devtools-mcp@latest', '--isolated'] }},
      allowedTools: ['mcp__chrome-devtools__navigate_page', 'mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__take_snapshot', 'mcp__chrome-devtools__take_screenshot', 'mcp__chrome-devtools__evaluate_script', 'mcp__chrome-devtools__wait_for', 'mcp__chrome-devtools__navigate_page_history', 'Write', 'TodoWrite'],
      permissionMode: 'acceptEdits',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  const toolName = input.tool_name;
                  if (toolName === 'mcp__chrome-devtools__navigate_page') {
                    console.log('🌐 Loading page for monitoring...');
                  } else if (toolName === 'mcp__chrome-devtools__take_snapshot') {
                    console.log('📸 Taking baseline snapshot...');
                  } else if (toolName === 'mcp__chrome-devtools__wait_for') {
                    console.log(`⏱️  Waiting ${interval}s for changes...`);
                  } else if (toolName === 'mcp__chrome-devtools__evaluate_script') {
                    console.log('🔍 Analyzing content changes...');
                  } else if (toolName === 'Write') {
                    console.log('📝 Writing change report...');
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
                  if (toolName === 'mcp__chrome-devtools__evaluate_script') {
                    console.log('✅ Change detection complete');
                  } else if (toolName === 'Write') {
                    console.log('✅ Report saved');
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
                console.log('\n✨ Content monitoring complete!');
                return { continue: true };
              },
            ],
          },
        ],
      },
      maxTurns: 30,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  for await (const message of result) {
    if (message.type === 'result' && message.subtype === 'success') {
      console.log(`\n📄 Report: ${reportFile}`);
      if (message.result) console.log('\n' + message.result);
    }
  }
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log('\n👁️  Chrome Content Change Monitor\n\nUsage:\n  bun run agents/chrome-content-change-monitor.ts <url> [--interval <seconds>] [--selector <css>] [--report <file>]\n\nOptions:\n  --interval <seconds>    Check interval (default: 60)\n  --selector <css>        CSS selector to monitor\n  --report <file>         Report file (default: content-changes.md)\n');
  process.exit(0);
}

const options: MonitorOptions = { url: args[0]! };
const intervalIndex = args.indexOf('--interval');
if (intervalIndex !== -1 && args[intervalIndex + 1]) options.interval = parseInt(args[intervalIndex + 1]!);
const selectorIndex = args.indexOf('--selector');
if (selectorIndex !== -1 && args[selectorIndex + 1]) options.selector = args[selectorIndex + 1];
const reportIndex = args.indexOf('--report');
if (reportIndex !== -1 && args[reportIndex + 1]) options.reportFile = args[reportIndex + 1];

monitorContent(options).catch((err) => { console.error('❌ Fatal error:', err); process.exit(1); });
