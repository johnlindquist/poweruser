#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';

interface FormFillerOptions { url: string; dataFile?: string; submit?: boolean; }

async function fillForm(options: FormFillerOptions) {
  const { url, dataFile, submit = false } = options;
  console.log('📝 Chrome Form Filler Bot\n');
  console.log(`URL: ${url}`);
  console.log(`Auto-submit: ${submit}\n`);

  const prompt = `Fill out the form at ${url} with realistic test data. Open page, take snapshot, identify all form fields (text inputs, emails, passwords, dates, selects, checkboxes, radios, textareas). ${dataFile ? `Use data from ${dataFile}.` : 'Generate realistic test data: names (John Doe), emails (test@example.com), phones ((555) 123-4567), addresses, dates, passwords (meeting requirements).'} Use fill_form to fill all fields at once. ${submit ? 'After filling, click submit button.' : 'Do not submit, just fill fields.'} Report which fields were filled and with what data.`;

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args: ['chrome-devtools-mcp@latest', '--isolated'] }},
      allowedTools: ['mcp__chrome-devtools__navigate_page', 'mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__take_snapshot', 'mcp__chrome-devtools__fill', 'mcp__chrome-devtools__fill_form', 'mcp__chrome-devtools__click', 'mcp__chrome-devtools__evaluate_script', ...(dataFile ? ['Read'] : []), 'TodoWrite'],
      permissionMode: 'bypassPermissions',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  const toolName = input.tool_name;
                  if (toolName === 'mcp__chrome-devtools__navigate_page') {
                    console.log('🌐 Navigating to page...');
                  } else if (toolName === 'mcp__chrome-devtools__take_snapshot') {
                    console.log('📸 Taking page snapshot...');
                  } else if (toolName === 'mcp__chrome-devtools__fill_form') {
                    console.log('✍️  Filling form fields...');
                  } else if (toolName === 'mcp__chrome-devtools__click') {
                    console.log('🖱️  Clicking submit button...');
                  } else if (toolName === 'Read') {
                    console.log('📄 Reading data file...');
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
                  if (toolName === 'mcp__chrome-devtools__fill_form') {
                    console.log('✅ Form fields filled');
                  } else if (toolName === 'mcp__chrome-devtools__click') {
                    console.log('✅ Form submitted');
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
                console.log('\n✨ Form filling complete!');
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
      console.log('\n✅ Form filled successfully');
      if (message.result) console.log('\n' + message.result);
    }
  }
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log('\n📝 Chrome Form Filler Bot\n\nUsage:\n  bun run agents/chrome-form-filler-bot.ts <url> [--data <file>] [--submit]\n\nOptions:\n  --data <file>    JSON file with form data\n  --submit         Submit form after filling\n');
  process.exit(0);
}

const options: FormFillerOptions = { url: args[0]!, submit: args.includes('--submit') };
const dataIndex = args.indexOf('--data');
if (dataIndex !== -1 && args[dataIndex + 1]) options.dataFile = args[dataIndex + 1];

fillForm(options).catch((err) => { console.error('❌ Fatal error:', err); process.exit(1); });
