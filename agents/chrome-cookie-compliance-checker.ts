#!/usr/bin/env -S bun run

/**
 * Chrome Cookie Compliance Checker Agent
 *
 * Uses Chrome DevTools MCP to audit cookie usage for GDPR/CCPA compliance:
 * - Lists all cookies set by the site
 * - Categorizes cookies (essential, functional, analytics, advertising)
 * - Checks consent banner implementation
 * - Verifies cookie attributes (Secure, HttpOnly, SameSite)
 * - Tests if non-essential cookies set before consent
 * - Generates compliance report
 *
 * Usage:
 *   bun run agents/chrome-cookie-compliance-checker.ts <url> [options]
 */

import { claude, getPositionals, parsedArgs } from './lib';
import type { ClaudeFlags, Settings } from './lib';

const DEFAULT_REPORT_FILE = 'cookie-compliance-report.md';

interface CookieComplianceOptions {
  url: string;
  reportFile: string;
}

function printHelp(): void {
  console.log(`
🍪 Chrome Cookie Compliance Checker

Usage:
  bun run agents/chrome-cookie-compliance-checker.ts <url> [options]

Options:
  --report <file>         Output file (default: ${DEFAULT_REPORT_FILE})
  --help, -h              Show this help message
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

const options: CookieComplianceOptions = {
  url: positionals[0]!,
  reportFile: readStringFlag('report') ?? DEFAULT_REPORT_FILE,
};

function buildPrompt(opts: CookieComplianceOptions): string {
  const { url, reportFile } = opts;

  return `
You are a privacy compliance expert using Chrome DevTools MCP to audit cookie usage.

Target URL: ${url}

Tasks:
1. Open URL in Chrome
2. Immediately list all network requests to see cookies set BEFORE any interaction
3. Check for consent banner/modal
4. Take snapshot to see banner UI
5. Use JavaScript to analyze cookies:
   \`\`\`javascript
   () => {
     const cookies = document.cookie.split(';').map(c => {
       const [name, value] = c.trim().split('=');
       return { name, value: value?.substring(0, 20) };
     });
     
     return {
       count: cookies.length,
       cookies,
       hasConsentBanner: !!(
         document.querySelector('[class*="cookie"]') ||
         document.querySelector('[id*="cookie"]') ||
         document.querySelector('[class*="consent"]') ||
         document.querySelector('[id*="consent"]')
       )
     };
   }
   \`\`\`

6. Analyze network requests for third-party cookies
7. Check cookie attributes from network headers

Generate report "${reportFile}":

## Cookie Compliance Report
**URL**: ${url}
**Regulation**: GDPR/CCPA
**Compliance Score**: [0-100]/100

### Summary
- Total Cookies: [count]
- First-Party: [count]
- Third-Party: [count]
- Set Before Consent: [count] ⚠️
- Consent Banner: ✅/❌

### Critical Issues
1. **Non-Essential Cookies Set Before Consent**
   - Count: [X]
   - Violates: GDPR Article 7
   - Fix: Implement proper consent management

### Cookie Inventory

| Name | Domain | Category | Secure | HttpOnly | SameSite | Expiry |
|------|--------|----------|--------|----------|----------|--------|
| [name] | [domain] | [type] | ✅/❌ | ✅/❌ | [value] | [days] |

### Consent Implementation
- Banner Present: ✅/❌
- Granular Choices: ✅/❌
- Reject All Option: ✅/❌
- Cookie Policy Link: ✅/❌

### Recommendations
1. Implement consent before setting non-essential cookies
2. Add cookie banner with granular controls
3. Update cookie policy
4. Add Secure flag to all cookies
5. Consider cookie-less analytics alternatives

### Compliant Cookie Banner Example
\`\`\`javascript
// Only set essential cookies initially
// Set others only after explicit consent
\`\`\`
`.trim();
}

console.log('🍪 Chrome Cookie Compliance Checker\n');
console.log(`URL: ${options.url}\n`);

const prompt = buildPrompt(options);

const claudeSettings: Settings = {};

const allowedTools = [
  'mcp__chrome-devtools__navigate_page',
  'mcp__chrome-devtools__new_page',
  'mcp__chrome-devtools__take_snapshot',
  'mcp__chrome-devtools__evaluate_script',
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
