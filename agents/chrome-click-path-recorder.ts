#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';

interface ClickRecorderOptions { url: string; outputFile?: string; format?: 'markdown' | 'json'; }

async function recordClickPath(options: ClickRecorderOptions) {
  const { url, outputFile, format = 'markdown' } = options;
  const output = outputFile || `click-path.${format === 'json' ? 'json' : 'md'}`;
  console.log('🖱️  Chrome Click Path Recorder\n');
  console.log(`URL: ${url}`);
  console.log(`Output: ${output}\n`);

  const prompt = `Record user interaction click path on ${url}. Open page, take initial snapshot. Set up JavaScript event listeners using evaluate_script to track: all click events with element details (tag, id, class, text content, xpath), timestamps, page navigation events, form submissions. Let page run for 30 seconds to capture interactions (or use wait_for). Collect all click events. Generate ${output} with: chronological list of clicks, element identifiers, screenshots at each step, visual flow diagram. Format as ${format === 'json' ? 'structured JSON' : 'markdown with emojis and clear steps'}.`;

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args: ['chrome-devtools-mcp@latest', '--isolated'] }},
      allowedTools: ['mcp__chrome-devtools__navigate_page', 'mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__take_snapshot', 'mcp__chrome-devtools__evaluate_script', 'mcp__chrome-devtools__wait_for', 'mcp__chrome-devtools__take_screenshot', 'Write', 'TodoWrite'],
      permissionMode: 'acceptEdits',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  const toolName = input.tool_name;
                  if (toolName === 'mcp__chrome-devtools__navigate_page') {
                    console.log('🌐 Loading page...');
                  } else if (toolName === 'mcp__chrome-devtools__evaluate_script') {
                    console.log('👂 Setting up click event listeners...');
                  } else if (toolName === 'mcp__chrome-devtools__take_screenshot') {
                    console.log('📸 Capturing interaction...');
                  } else if (toolName === 'Write') {
                    console.log('💾 Saving click path report...');
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
                    console.log('✅ Event listeners active');
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
                console.log('\n✨ Click path recording complete!');
                return { continue: true };
              },
            ],
          },
        ],
      },
      maxTurns: 25,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  for await (const message of result) {
    if (message.type === 'result' && message.subtype === 'success') {
      console.log(`\n✅ Click path recorded: ${output}`);
      if (message.result) console.log('\n' + message.result);
    }
  }
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log('\n🖱️  Chrome Click Path Recorder\n\nUsage:\n  bun run agents/chrome-click-path-recorder.ts <url> [--output <file>] [--format markdown|json]\n\nOptions:\n  --output <file>      Output file\n  --format <type>      Output format (default: markdown)\n');
  process.exit(0);
}

const options: ClickRecorderOptions = { url: args[0]! };
const outputIndex = args.indexOf('--output');
if (outputIndex !== -1 && args[outputIndex + 1]) options.outputFile = args[outputIndex + 1];
const formatIndex = args.indexOf('--format');
if (formatIndex !== -1 && args[formatIndex + 1]) options.format = args[formatIndex + 1] as any;

recordClickPath(options).catch((err) => { console.error('❌ Fatal error:', err); process.exit(1); });
