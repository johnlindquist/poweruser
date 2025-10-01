#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';

interface PrefetchAuditorOptions { url: string; reportFile?: string; }

async function auditPrefetchPreload(options: PrefetchAuditorOptions) {
  const { url, reportFile = 'prefetch-preload-audit-report.md' } = options;
  console.log('🔮 Chrome Prefetch/Preload Auditor\n');
  console.log(`URL: ${url}\n`);

  const prompt = `Audit resource hints for ${url}. Use JS to check existing hints: <link rel="preload">, <link rel="prefetch">, <link rel="preconnect">, <link rel="dns-prefetch">. List network requests to identify: critical resources not preloaded (fonts, hero images, critical CSS/JS), third-party origins not preconnected, future navigation targets not prefetched. Validate existing hints: check if preload resources actually used, verify correct "as" attribute, ensure crossorigin for fonts. Generate "${reportFile}" with: current resource hints inventory, missing preload opportunities, incorrect/unused hints to remove, preconnect recommendations for third-parties, implementation examples with estimated performance gains.`;

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args: ['chrome-devtools-mcp@latest', '--isolated'] }},
      allowedTools: ['mcp__chrome-devtools__navigate_page', 'mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__list_network_requests', 'mcp__chrome-devtools__evaluate_script', 'Write', 'TodoWrite'],
      permissionMode: 'bypassPermissions',
      maxTurns: 25,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  for await (const message of result) {
    if (message.type === 'result' && message.subtype === 'success') console.log(`\n📄 Report: ${reportFile}`);
  }
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log('\n🔮 Chrome Prefetch/Preload Auditor\n\nUsage:\n  bun run agents/chrome-prefetch-preload-auditor.ts <url> [--report <file>]\n');
  process.exit(0);
}

const options: PrefetchAuditorOptions = { url: args[0]! };
const reportIndex = args.indexOf('--report');
if (reportIndex !== -1 && args[reportIndex + 1]) options.reportFile = args[reportIndex + 1];

auditPrefetchPreload(options).catch((err) => { console.error('❌ Fatal error:', err); process.exit(1); });
