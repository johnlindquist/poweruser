#!/usr/bin/env bun

/**
 * Chrome Security Header Auditor Agent
 *
 * Uses Chrome DevTools MCP to audit security headers:
 * - Checks Content Security Policy (CSP)
 * - Verifies HSTS (Strict-Transport-Security)
 * - Tests X-Frame-Options, X-Content-Type-Options
 * - Validates TLS/SSL configuration
 * - Checks for mixed content
 * - Tests for security vulnerabilities
 *
 * Usage:
 *   bun run agents/chrome-security-header-auditor.ts <url> [options]
 *
 * Examples:
 *   bun run agents/chrome-security-header-auditor.ts https://example.com
 *   bun run agents/chrome-security-header-auditor.ts https://example.com --report security.md
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface SecurityAuditOptions {
  url: string;
  reportFile?: string;
}

async function auditSecurityHeaders(options: SecurityAuditOptions) {
  const { url, reportFile = 'security-audit-report.md' } = options;

  console.log('🔒 Chrome Security Header Auditor\n');
  console.log(`URL: ${url}`);
  console.log('');

  const prompt = `
You are a web security expert using Chrome DevTools MCP to audit security headers.

Target URL: ${url}

Your tasks:
1. Open the URL in Chrome
2. List all network requests
3. Get the main document request
4. Extract and analyze response headers:
   - Content-Security-Policy
   - Strict-Transport-Security (HSTS)
   - X-Frame-Options
   - X-Content-Type-Options
   - Referrer-Policy
   - Permissions-Policy
   - X-XSS-Protection

4. Check for security issues:
   - Missing security headers
   - Weak CSP policies
   - Mixed content (HTTP on HTTPS)
   - Insecure cookies
   - TLS/SSL issues

5. Use JavaScript to check additional security:
   \`\`\`javascript
   () => {
     return {
       protocol: window.location.protocol,
       hasServiceWorker: !!navigator.serviceWorker?.controller,
       cookies: document.cookie.split(';').map(c => {
         const [name] = c.trim().split('=');
         return name;
       }),
       mixedContent: {
         scripts: Array.from(document.querySelectorAll('script[src]'))
           .filter(s => s.src.startsWith('http:'))
           .map(s => s.src),
         images: Array.from(document.querySelectorAll('img[src]'))
           .filter(img => img.src.startsWith('http:'))
           .map(img => img.src)
       }
     };
   }
   \`\`\`

Generate security audit report and save to "${reportFile}":

## Security Header Audit Report
**URL**: ${url}
**Date**: [timestamp]
**Security Score**: [0-100]/100

### Summary
- 🟢 Passed: [count] checks
- 🟡 Warnings: [count] issues
- 🔴 Critical: [count] vulnerabilities

### Security Headers Status

#### Content-Security-Policy (CSP)
- Status: ✅ Present / ❌ Missing / ⚠️ Weak
- Current Policy: \`[policy]\`
- Issues:
  - [ ] unsafe-inline detected
  - [ ] unsafe-eval detected
  - [ ] Wildcard (*) domains
- Recommendation: [specific CSP improvements]

#### Strict-Transport-Security (HSTS)
- Status: ✅ / ❌
- Current: \`[header value]\`
- Max-Age: [seconds]
- includeSubDomains: Yes/No
- preload: Yes/No
- Recommendation: \`Strict-Transport-Security: max-age=31536000; includeSubDomains; preload\`

#### X-Frame-Options
- Status: ✅ / ❌
- Current: [DENY/SAMEORIGIN/ALLOW-FROM]
- Protects Against: Clickjacking
- Recommendation: \`X-Frame-Options: DENY\` or use CSP frame-ancestors

#### X-Content-Type-Options
- Status: ✅ / ❌
- Protects Against: MIME-sniffing attacks
- Recommendation: \`X-Content-Type-Options: nosniff\`

#### Referrer-Policy
- Status: ✅ / ❌
- Current: [policy]
- Privacy Level: [assessment]
- Recommendation: \`Referrer-Policy: strict-origin-when-cross-origin\`

### Critical Security Issues 🔴

1. **[Issue Name]** - OWASP Top 10: [Category]
   - Risk: High
   - Impact: [description]
   - Fix: [specific solution]

### Warnings ⚠️

1. **[Issue]**
   - Risk: Medium
   - Fix: [solution]

### Mixed Content Issues
- HTTP Scripts: [count]
- HTTP Images: [count]
- Fix: Update all resources to HTTPS

### Cookie Security
- Total Cookies: [count]
- Secure Flag: [count/total]
- HttpOnly Flag: [count/total]
- SameSite: [count/total]

### TLS/SSL Configuration
- Protocol: [TLS version]
- Certificate: ✅ Valid / ❌ Invalid / ⚠️ Expiring soon

### Recommendations (Priority Order)
1. [Most critical fix]
2. [Next fix]

### Implementation Guide

#### Add Missing Headers (Nginx)
\`\`\`nginx
add_header Content-Security-Policy "default-src 'self'";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
add_header X-Frame-Options "DENY";
add_header X-Content-Type-Options "nosniff";
\`\`\`

#### Add Missing Headers (Apache)
\`\`\`apache
Header always set Content-Security-Policy "default-src 'self'"
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
\`\`\`

### Security Best Practices Checklist
- [ ] All pages served over HTTPS
- [ ] HSTS enabled with long max-age
- [ ] Strong CSP policy
- [ ] No mixed content
- [ ] Secure cookies (Secure, HttpOnly, SameSite)
- [ ] Regular security audits
- [ ] Keep dependencies updated
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
        'mcp__chrome-devtools__list_network_requests',
        'mcp__chrome-devtools__get_network_request',
        'mcp__chrome-devtools__evaluate_script',
        'Write',
        'TodoWrite',
      ],
      permissionMode: 'bypassPermissions',
      maxTurns: 25,
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
        console.log('📊 Security Audit Complete');
        console.log('='.repeat(60));
        console.log(`\nDuration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`\n📄 Report: ${reportFile}`);
      }
    }
  }
}

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
🔒 Chrome Security Header Auditor

Usage:
  bun run agents/chrome-security-header-auditor.ts <url> [options]

Arguments:
  url                     Website URL to audit

Options:
  --report <file>         Output file (default: security-audit-report.md)
  --help                  Show this help

Examples:
  bun run agents/chrome-security-header-auditor.ts https://example.com
  bun run agents/chrome-security-header-auditor.ts https://example.com --report my-security.md
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

const options: SecurityAuditOptions = { url };
const reportIndex = args.indexOf('--report');
if (reportIndex !== -1) options.reportFile = args[reportIndex + 1];

auditSecurityHeaders(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
