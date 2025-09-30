#!/usr/bin/env bun

/**
 * Chrome Console Error Hunter Agent
 *
 * Uses Chrome DevTools MCP to catch JavaScript errors:
 * - Monitors console for errors, warnings, and failed requests
 * - Tests multiple pages/routes automatically
 * - Categorizes issues by severity
 * - Identifies patterns in errors
 * - Provides stack traces and debugging info
 * - Can run as pre-deployment check
 *
 * Usage:
 *   bun run agents/chrome-console-error-hunter.ts <url> [options]
 *
 * Examples:
 *   bun run agents/chrome-console-error-hunter.ts https://example.com
 *   bun run agents/chrome-console-error-hunter.ts https://example.com --crawl-depth 2
 *   bun run agents/chrome-console-error-hunter.ts https://example.com --report errors.md
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface ErrorHunterOptions {
  url: string;
  crawlDepth?: number;
  reportFile?: string;
  includeWarnings?: boolean;
  checkNetworkErrors?: boolean;
}

async function huntConsoleErrors(options: ErrorHunterOptions) {
  const {
    url,
    crawlDepth = 1,
    reportFile = 'console-errors-report.md',
    includeWarnings = true,
    checkNetworkErrors = true,
  } = options;

  console.log('🐛 Chrome Console Error Hunter\n');
  console.log(`URL: ${url}`);
  console.log(`Crawl Depth: ${crawlDepth}`);
  console.log(`Include Warnings: ${includeWarnings}`);
  console.log(`Check Network Errors: ${checkNetworkErrors}`);
  console.log('');

  const prompt = `
You are a JavaScript debugging expert using Chrome DevTools MCP to find console errors.

Target URL: ${url}
Crawl Depth: ${crawlDepth} level(s)
Include Warnings: ${includeWarnings}
Check Network Errors: ${checkNetworkErrors}

Your tasks:

1. Open the URL in Chrome
2. Immediately after page load, capture console messages using list_console_messages
3. Extract all internal links for crawling (if depth > 1)
4. ${checkNetworkErrors ? 'List network requests to identify failed requests (404, 500, etc.)' : ''}

5. Categorize console messages:
   - **Errors** (error level): JavaScript exceptions, unhandled promises
   - **Warnings** (warning level): Deprecation warnings, potential issues
   - **Failed Requests** (from network): 404s, 500s, CORS errors
   - **CSP Violations**: Content Security Policy violations
   - **CORS Errors**: Cross-origin issues

6. For each error/warning:
   - Extract message text
   - Identify source file and line number
   - Get stack trace if available
   - Determine if error is from:
     - Your code
     - Third-party scripts
     - Browser extensions
   - Assess severity: Critical, High, Medium, Low

${crawlDepth > 1 ? `
7. Crawl internal links up to depth ${crawlDepth}:
   - Test each page for console errors
   - Track which pages have errors
   - Identify patterns (same error on multiple pages)
` : ''}

8. Analyze patterns:
   - Common error sources (which files/libraries)
   - Most frequent errors
   - Pages with most errors
   - Third-party script issues

Generate comprehensive error report and save to "${reportFile}":

## Console Error Hunt Report
**URL**: ${url}
**Crawl Depth**: ${crawlDepth}
**Date**: [timestamp]

### Executive Summary
- 🔴 Errors: [count]
- 🟡 Warnings: [count]
- 🌐 Network Failures: [count]
- 🚫 CORS Issues: [count]
- 📄 Pages Tested: [count]

### Error Severity Breakdown
- 🚨 Critical: [count] (breaks functionality)
- ⚠️  High: [count] (degrades experience)
- 💡 Medium: [count] (minor issues)
- 📝 Low: [count] (informational)

### Critical Errors (Fix Immediately)

#### Error #1: [Error Message]
- **Severity**: Critical
- **Type**: JavaScript Exception / Unhandled Promise / Network Error
- **Source**: [file.js:line:column]
- **Stack Trace**:
  \`\`\`
  [stack trace]
  \`\`\`
- **Affected Pages**:
  - ${url}
  ${crawlDepth > 1 ? '- [other pages if found on multiple]' : ''}
- **Frequency**: [X times / Y pages]
- **Likely Cause**: [analysis]
- **Fix Suggestion**: [specific recommendation]
- **Priority**: Immediate

#### Error #2: [Next error]
[Similar format]

### High Priority Warnings

#### Warning #1: [Warning Message]
- **Type**: Deprecation / Performance / Security
- **Source**: [file.js:line]
- **Message**: [full warning text]
- **Impact**: [potential consequences]
- **Fix**: [recommendation]

### Network Errors

#### Failed Request #1: [URL]
- **Status**: 404 / 500 / Failed
- **Type**: Script / Stylesheet / Image / XHR / Fetch
- **Loaded From**: [page URL]
- **Expected**: [what should load]
- **Fix**: [check file path, restore file, etc.]

### CORS Issues

#### CORS Error #1: [Resource URL]
- **Origin**: [origin]
- **Requested From**: [page URL]
- **Issue**: [missing headers, protocol mismatch, etc.]
- **Fix**: [configure CORS headers]

### Error Patterns

1. **[Pattern Name]** - Occurs [X] times across [Y] pages
   - Common Source: [file/library]
   - Example Error: [message]
   - Root Cause: [analysis]
   - Solution: [fix all instances]

2. **[Next pattern]**

### Third-Party Script Issues

- **Google Analytics**: [X errors]
- **Facebook Pixel**: [X errors]
- **[Other third-party]**: [X errors]

### Pages with Errors

| Page | Errors | Warnings | Network Fails | Status |
|------|--------|----------|---------------|--------|
| ${url} | [X] | [Y] | [Z] | 🔴/🟡/🟢 |
${crawlDepth > 1 ? '| [page 2] | [X] | [Y] | [Z] | 🔴/🟡/🟢 |' : ''}

### Recommendations (Priority Order)

1. **Fix Critical JavaScript Errors** - Immediate
   - [Specific error to fix]
   - [Next error]

2. **Resolve Network Failures** - This Week
   - [Failed resource to restore]
   - [Next resource]

3. **Address Warnings** - This Sprint
   - [Deprecation to update]
   - [Performance warning]

4. **Review Third-Party Scripts** - Next Sprint
   - Consider removing unused scripts
   - Update outdated libraries

### Browser Console Reproduction

To reproduce these errors locally:
1. Open ${url} in Chrome
2. Open DevTools (F12)
3. Go to Console tab
4. [Specific steps if needed]

### Action Items
- [ ] Fix all critical errors
- [ ] Restore failed network resources
- [ ] Address high-priority warnings
- [ ] Configure CORS for failing requests
- [ ] Add error monitoring (Sentry, Rollbar, etc.)
- [ ] Set up automated console error checking in CI/CD

### Automated Error Monitoring Suggestions
- Add Sentry/Rollbar for production error tracking
- Set up alerts for critical errors
- Monitor error rates and trends
- Add source maps for better debugging
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
        'mcp__chrome-devtools__list_console_messages',
        'mcp__chrome-devtools__list_network_requests',
        'mcp__chrome-devtools__evaluate_script',
        'mcp__chrome-devtools__wait_for',
        'Write',
        'TodoWrite',
      ],
      permissionMode: 'bypassPermissions',
      maxTurns: 40,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  for await (const message of result) {
    if (message.type === 'assistant') {
      const textContent = message.message.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        const text = textContent.text;
        if (!text.includes('tool_use') && text.trim().length > 0) {
          console.log('\n💡', text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('\n' + '='.repeat(60));
        console.log('📊 Error Hunt Complete');
        console.log('='.repeat(60));
        console.log(`\nDuration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`\n📄 Report: ${reportFile}`);

        if (message.result) {
          console.log('\n' + message.result);
        }
      }
    }
  }
}

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
🐛 Chrome Console Error Hunter

Usage:
  bun run agents/chrome-console-error-hunter.ts <url> [options]

Arguments:
  url                     Website URL to check

Options:
  --crawl-depth <number>  Pages to crawl (default: 1)
  --report <file>         Output file (default: console-errors-report.md)
  --no-warnings           Skip warnings, only report errors
  --no-network            Skip network error checking
  --help                  Show this help

Examples:
  bun run agents/chrome-console-error-hunter.ts https://example.com
  bun run agents/chrome-console-error-hunter.ts https://example.com --crawl-depth 3
  bun run agents/chrome-console-error-hunter.ts https://example.com --no-warnings
  bun run agents/chrome-console-error-hunter.ts https://example.com --report my-errors.md
  `);
  process.exit(0);
}

const url = args[0];
if (!url) {
  console.error('❌ Error: URL is required');
  process.exit(1);
}

try {
  new URL(url);
} catch (error) {
  console.error('❌ Error: Invalid URL');
  process.exit(1);
}

const options: ErrorHunterOptions = {
  url,
  includeWarnings: !args.includes('--no-warnings'),
  checkNetworkErrors: !args.includes('--no-network'),
};

for (let i = 1; i < args.length; i++) {
  switch (args[i]) {
    case '--crawl-depth':
      options.crawlDepth = parseInt(args[++i] || '1', 10);
      break;
    case '--report':
      options.reportFile = args[++i];
      break;
  }
}

huntConsoleErrors(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
