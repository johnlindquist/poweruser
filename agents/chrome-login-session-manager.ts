#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';

interface LoginOptions { url: string; username: string; password: string; saveCookies?: boolean; cookieFile?: string; }

async function manageLogin(options: LoginOptions) {
  const { url, username, password, saveCookies = true, cookieFile = './session-cookies.json' } = options;
  console.log('🔐 Chrome Login Session Manager\n');
  console.log(`URL: ${url}`);
  console.log(`User: ${username}\n`);

  const prompt = `Automate login to ${url} with username "${username}" and password "${password}". Take snapshot, identify login form fields (username/email field, password field), fill them using fill_form, click login/submit button. Wait for login to complete (check for redirect or success indicator). ${saveCookies ? `Extract cookies using JavaScript (document.cookie) and save to ${cookieFile}.` : 'Do not save cookies.'} Report login success/failure and any errors.`;

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args: ['chrome-devtools-mcp@latest', '--isolated'] }},
      allowedTools: ['mcp__chrome-devtools__navigate_page', 'mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__take_snapshot', 'mcp__chrome-devtools__fill_form', 'mcp__chrome-devtools__click', 'mcp__chrome-devtools__wait_for', 'mcp__chrome-devtools__evaluate_script', ...(saveCookies ? ['Write'] : []), 'TodoWrite'],
      permissionMode: saveCookies ? 'acceptEdits' : 'bypassPermissions',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  const toolName = input.tool_name;
                  if (toolName === 'mcp__chrome-devtools__navigate_page') {
                    console.log('🌐 Navigating to login page...');
                  } else if (toolName === 'mcp__chrome-devtools__take_snapshot') {
                    console.log('📸 Analyzing login form...');
                  } else if (toolName === 'mcp__chrome-devtools__fill_form') {
                    console.log('✍️  Filling credentials...');
                  } else if (toolName === 'mcp__chrome-devtools__click') {
                    console.log('🖱️  Clicking login button...');
                  } else if (toolName === 'mcp__chrome-devtools__evaluate_script') {
                    console.log('🍪 Extracting cookies...');
                  } else if (toolName === 'Write') {
                    console.log('💾 Saving session cookies...');
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
                  if (toolName === 'mcp__chrome-devtools__click') {
                    console.log('✅ Login submitted');
                  } else if (toolName === 'Write') {
                    console.log('✅ Cookies saved');
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
                console.log('\n✨ Login session management complete!');
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
      console.log('\n✅ Login completed');
      if (saveCookies) console.log(`📄 Cookies saved: ${cookieFile}`);
    }
  }
}

const args = process.argv.slice(2);
if (args.length < 3 || args.includes('--help')) {
  console.log('\n🔐 Chrome Login Session Manager\n\nUsage:\n  bun run agents/chrome-login-session-manager.ts <url> <username> <password> [--cookies <file>] [--no-save]\n\nOptions:\n  --cookies <file>    Cookie file path (default: ./session-cookies.json)\n  --no-save          Don\'t save cookies\n');
  process.exit(0);
}

const options: LoginOptions = { url: args[0]!, username: args[1]!, password: args[2]!, saveCookies: !args.includes('--no-save') };
const cookieIndex = args.indexOf('--cookies');
if (cookieIndex !== -1 && args[cookieIndex + 1]) options.cookieFile = args[cookieIndex + 1];

manageLogin(options).catch((err) => { console.error('❌ Fatal error:', err); process.exit(1); });
