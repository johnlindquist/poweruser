#!/usr/bin/env bun

/**
 * Chrome Third-Party Bloat Analyzer Agent
 *
 * Uses Chrome DevTools MCP to identify bloated third-party scripts:
 * - Measures size and load time of third-party resources
 * - Identifies tracking pixels, analytics, ads
 * - Calculates performance impact
 * - Suggests alternatives or removal
 * - Analyzes render-blocking scripts
 *
 * Usage:
 *   bun run agents/chrome-third-party-bloat-analyzer.ts <url> [options]
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface ThirdPartyAnalyzerOptions {
  url: string;
  reportFile?: string;
}

async function analyzeThirdPartyBloat(options: ThirdPartyAnalyzerOptions) {
  const { url, reportFile = 'third-party-bloat-report.md' } = options;

  console.log('🎯 Chrome Third-Party Bloat Analyzer\n');
  console.log(`URL: ${url}\n`);

  const prompt = `
You are a performance optimization expert analyzing third-party script bloat.

Target URL: ${url}

Tasks:
1. Open URL and run performance trace
2. List all network requests
3. Filter for third-party domains (not same origin)
4. Categorize third-party resources:
   - Analytics (Google Analytics, etc.)
   - Advertising (DoubleClick, etc.)
   - Social Media (Facebook, Twitter widgets)
   - Tag Managers (GTM, etc.)
   - CDNs
   - Fonts
   - Other

5. Analyze each third-party script:
   - Size (KB)
   - Load time (ms)
   - Blocking behavior
   - Initiator (who loaded it)
   - Purpose

6. Calculate total impact:
   - Total third-party bytes
   - Total load time
   - Render-blocking count
   - Performance score impact

Generate report "${reportFile}":

## Third-Party Bloat Analysis
**URL**: ${url}
**Bloat Score**: [0-100] (0 = lean, 100 = bloated)

### Summary
- Total Third-Party Requests: [count]
- Total Size: [X] MB
- Total Load Time: [X]s
- Render-Blocking: [count]
- Performance Impact: -[X] points

### Bloat by Category

| Category | Count | Size (KB) | Load Time | Impact |
|----------|-------|-----------|-----------|--------|
| Analytics | [X] | [size] | [time] | High/Med/Low |
| Advertising | [X] | [size] | [time] | [impact] |
| Social Media | [X] | [size] | [time] | [impact] |

### Top 10 Heaviest Third-Party Resources

1. **[domain/script.js]** - [size] KB
   - Type: Analytics/Ads/Social
   - Load Time: [X]ms
   - Render-Blocking: Yes/No
   - Purpose: [what it does]
   - Recommendation: [Replace with lighter alternative / Remove / Lazy load]

### Recommendations
1. **Remove unused scripts**: [list]
2. **Replace bloated scripts**: [Google Analytics → Plausible]
3. **Lazy load**: [social media widgets]
4. **Self-host**: [fonts, libraries]

### Potential Savings
- Remove [X] unused scripts: -[Y] KB, +[Z]ms faster
- Replace analytics: -[Y] KB
- Lazy load widgets: +[Z]ms faster LCP

### Implementation
\`\`\`javascript
// Lazy load third-party scripts
const script = document.createElement('script');
script.src = 'third-party.js';
script.defer = true;
document.body.appendChild(script);
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
        'mcp__chrome-devtools__performance_start_trace',
        'mcp__chrome-devtools__performance_stop_trace',
        'mcp__chrome-devtools__list_network_requests',
        'Write',
        'TodoWrite',
      ],
      permissionMode: 'bypassPermissions',
      maxTurns: 25,
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
🎯 Chrome Third-Party Bloat Analyzer

Usage:
  bun run agents/chrome-third-party-bloat-analyzer.ts <url> [options]

Options:
  --report <file>         Output file (default: third-party-bloat-report.md)
  --help                  Show this help
  `);
  process.exit(0);
}

const url = args[0];
if (!url) {
  console.error('❌ Error: URL required');
  process.exit(1);
}

const options: ThirdPartyAnalyzerOptions = { url };
const reportIndex = args.indexOf('--report');
if (reportIndex !== -1) options.reportFile = args[reportIndex + 1];

analyzeThirdPartyBloat(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
