#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';

interface APITesterOptions { url: string; reportFile?: string; }

async function testAPIEndpoints(options: APITesterOptions) {
  const { url, reportFile = 'api-endpoint-test-report.md' } = options;
  console.log('🔌 Chrome API Endpoint Tester\n');
  console.log(`URL: ${url}\n`);

  const prompt = `Test all API endpoints called by ${url}. Open page, list network requests filtered by XHR/fetch. For each API endpoint: measure response time, check status codes, identify slow endpoints (>500ms), test error handling, analyze payload sizes. Generate "${reportFile}" with endpoint inventory showing: URL, method, response time, status, size, and performance recommendations.`;

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args: ['chrome-devtools-mcp@latest', '--isolated'] }},
      allowedTools: ['mcp__chrome-devtools__navigate_page', 'mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__list_network_requests', 'mcp__chrome-devtools__get_network_request', 'mcp__chrome-devtools__evaluate_script', 'Write', 'TodoWrite'],
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
  console.log('\n🔌 Chrome API Endpoint Tester\n\nUsage:\n  bun run agents/chrome-api-endpoint-tester.ts <url> [--report <file>]\n');
  process.exit(0);
}

const options: APITesterOptions = { url: args[0]! };
const reportIndex = args.indexOf('--report');
if (reportIndex !== -1 && args[reportIndex + 1]) options.reportFile = args[reportIndex + 1];

testAPIEndpoints(options).catch((err) => { console.error('❌ Fatal error:', err); process.exit(1); });
