#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';

interface CDNOptions { url: string; reportFile?: string; }

async function optimizeCDN(options: CDNOptions) {
  const { url, reportFile = 'cdn-optimization-report.md' } = options;
  console.log('🌐 Chrome CDN Optimizer\n');
  console.log(`URL: ${url}\n`);

  const prompt = `Analyze CDN usage for ${url}. List network requests, identify resources loaded from CDNs vs origin. Check: cache headers (Cache-Control, Expires, ETag), compression (gzip/brotli), HTTP/2 support, geographic distribution. For each resource: check if CDN-eligible but loading from origin, verify cache headers are optimal, identify missing compression. Generate "${reportFile}" with recommendations: resources to move to CDN, cache header improvements, compression opportunities, CDN configuration best practices.`;

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args: ['chrome-devtools-mcp@latest', '--isolated'] }},
      allowedTools: ['mcp__chrome-devtools__navigate_page', 'mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__list_network_requests', 'mcp__chrome-devtools__get_network_request', 'Write', 'TodoWrite'],
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
  console.log('\n🌐 Chrome CDN Optimizer\n\nUsage:\n  bun run agents/chrome-cdn-optimizer.ts <url> [--report <file>]\n');
  process.exit(0);
}

const options: CDNOptions = { url: args[0]! };
const reportIndex = args.indexOf('--report');
if (reportIndex !== -1 && args[reportIndex + 1]) options.reportFile = args[reportIndex + 1];

optimizeCDN(options).catch((err) => { console.error('❌ Fatal error:', err); process.exit(1); });
