#!/usr/bin/env -S bun run

/**
 * Chrome Third-Party Bloat Analyzer Agent
 */

import { claude, getPositionals, parsedArgs, readStringFlag } from './lib';
import type { ClaudeFlags, Settings } from './lib';

interface ThirdPartyAnalyzerOptions {
  url: string;
  reportFile: string;
}

const DEFAULT_REPORT_FILE = 'third-party-bloat-report.md';

function printHelp(): void {
  console.log(`
🎯 Chrome Third-Party Bloat Analyzer

Usage:
  bun run agents/chrome-third-party-bloat-analyzer.ts <url> [options]

Options:
  --report <file>         Output file (default: ${DEFAULT_REPORT_FILE})
  --help, -h              Show this help message
`);
}

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

const urlCandidate = positionals[0]!;

try {
  new URL(urlCandidate);
} catch {
  console.error('❌ Error: Invalid URL');
  process.exit(1);
}

const options: ThirdPartyAnalyzerOptions = {
  url: urlCandidate,
  reportFile: readStringFlag('report') ?? DEFAULT_REPORT_FILE,
};

console.log('🎯 Chrome Third-Party Bloat Analyzer\n');
console.log(`URL: ${options.url}\n`);

function buildPrompt(opts: ThirdPartyAnalyzerOptions): string {
  const { url, reportFile } = opts;

  return `
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
}

const prompt = buildPrompt(options);

const claudeSettings: Settings = {};

const allowedTools = [
  'mcp__chrome-devtools__navigate_page',
  'mcp__chrome-devtools__new_page',
  'mcp__chrome-devtools__performance_start_trace',
  'mcp__chrome-devtools__performance_stop_trace',
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
