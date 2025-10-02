#!/usr/bin/env -S bun run

import { claude, getPositionals, parsedArgs } from './lib';
import type { ClaudeFlags, Settings } from './lib';

interface LoginOptions {
  url: string;
  username: string;
  password: string;
  saveCookies: boolean;
  cookieFile: string;
}

const DEFAULT_COOKIE_FILE = './session-cookies.json';

function printHelp(): void {
  console.log(`
🔐 Chrome Login Session Manager

Usage:
  bun run agents/chrome-login-session-manager.ts <url> <username> <password> [--cookies <file>] [--no-save]

Options:
  --cookies <file>    Cookie file path (default: ${DEFAULT_COOKIE_FILE})
  --no-save           Do not save cookies after login
  --help, -h          Show this help message
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

if (positionals.length < 3) {
  console.error('❌ Error: URL, username, and password are required');
  printHelp();
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

function hasFlag(name: string): boolean {
  if (values[name] === true) return true;
  if (values[name] === false) return false;
  return argv.includes(`--${name}`);
}

const saveCookies = !hasFlag('no-save');

const options: LoginOptions = {
  url: positionals[0]!,
  username: positionals[1]!,
  password: positionals[2]!,
  saveCookies,
  cookieFile: readStringFlag('cookies') ?? DEFAULT_COOKIE_FILE,
};

console.log('🔐 Chrome Login Session Manager\n');
console.log(`URL: ${options.url}`);
console.log(`User: ${options.username}`);
console.log(`Save cookies: ${options.saveCookies ? 'yes' : 'no'}`);
console.log(`Cookie file: ${options.cookieFile}\n`);

function buildPrompt(opts: LoginOptions): string {
  const { url, username, password, saveCookies: shouldSaveCookies, cookieFile } = opts;

  return `Automate login to ${url} with username "${username}" and password "${password}". Take snapshot, identify login form fields (username/email field, password field), fill them using fill_form, click login/submit button. Wait for login to complete (check for redirect or success indicator). ${shouldSaveCookies ? `Extract cookies using JavaScript (document.cookie) and save to ${cookieFile}.` : 'Do not save cookies.'} Report login success/failure and any errors.`;
}

const prompt = buildPrompt(options);

const claudeSettings: Settings = {};

const allowedTools = [
  'mcp__chrome-devtools__navigate_page',
  'mcp__chrome-devtools__new_page',
  'mcp__chrome-devtools__take_snapshot',
  'mcp__chrome-devtools__fill_form',
  'mcp__chrome-devtools__click',
  'mcp__chrome-devtools__wait_for',
  'mcp__chrome-devtools__evaluate_script',
  ...(options.saveCookies ? ['Write'] : []),
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
  'permission-mode': options.saveCookies ? 'acceptEdits' : 'bypassPermissions',
  'mcp-config': JSON.stringify(mcpConfig),
  'strict-mcp-config': true,
};

claude(prompt, defaultFlags)
  .then((exitCode) => {
    if (exitCode === 0) {
      console.log('\n✅ Login completed');
      if (options.saveCookies) {
        console.log(`📄 Cookies saved: ${options.cookieFile}`);
      }
    }
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
