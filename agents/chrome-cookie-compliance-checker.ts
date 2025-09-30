#!/usr/bin/env bun

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

import { query } from '@anthropic-ai/claude-agent-sdk';

interface CookieComplianceOptions {
  url: string;
  reportFile?: string;
}

async function checkCookieCompliance(options: CookieComplianceOptions) {
  const { url, reportFile = 'cookie-compliance-report.md' } = options;

  console.log('🍪 Chrome Cookie Compliance Checker\n');
  console.log(`URL: ${url}\n`);

  const prompt = `
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

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: {
        'chrome-devtools': {
          type: 'stdio',
          command: 'npx',
          args: ['chrome-devtools-mcp@latest', '--isolated'],
        },
      },
      allowedTools: [
        'mcp__chrome-devtools__navigate_page',
        'mcp__chrome-devtools__new_page',
        'mcp__chrome-devtools__take_snapshot',
        'mcp__chrome-devtools__evaluate_script',
        'mcp__chrome-devtools__list_network_requests',
        'Write',
        'TodoWrite',
      ],
      permissionMode: 'bypassPermissions',
      maxTurns: 20,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  for await (const message of result) {
    if (message.type === 'result' && message.subtype === 'success') {
      console.log(`\n📄 Report: ${reportFile}`);
    }
  }
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log(`
🍪 Chrome Cookie Compliance Checker

Usage:
  bun run agents/chrome-cookie-compliance-checker.ts <url> [options]

Options:
  --report <file>         Output file (default: cookie-compliance-report.md)
  --help                  Show this help
  `);
  process.exit(0);
}

const url = args[0];
if (!url) {
  console.error('❌ Error: URL required');
  process.exit(1);
}

const options: CookieComplianceOptions = { url };
const reportIndex = args.indexOf('--report');
if (reportIndex !== -1) options.reportFile = args[reportIndex + 1];

checkCookieCompliance(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
