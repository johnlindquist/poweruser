#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';

interface OptimizerOptions { url: string; reportFile?: string; }

async function optimizePageSpeed(options: OptimizerOptions) {
  const { url, reportFile = 'page-speed-optimization-plan.md' } = options;
  console.log('⚡ Chrome Page Speed Optimizer\n');
  console.log(`URL: ${url}\n`);

  const prompt = `Analyze ${url} for all performance bottlenecks. Run performance trace, analyze insights (LCP, TBT, CLS), list network requests. Identify: render-blocking resources, large images, slow third-parties, unoptimized CSS/JS. Generate "${reportFile}" with prioritized action plan showing estimated speed improvements for each fix.`;

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args: ['chrome-devtools-mcp@latest', '--isolated'] }},
      allowedTools: ['mcp__chrome-devtools__navigate_page', 'mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__performance_start_trace', 'mcp__chrome-devtools__performance_stop_trace', 'mcp__chrome-devtools__performance_analyze_insight', 'mcp__chrome-devtools__list_network_requests', 'Write', 'TodoWrite'],
      permissionMode: 'bypassPermissions',
      maxTurns: 30,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  for await (const message of result) {
    if (message.type === 'result' && message.subtype === 'success') console.log(`\n📄 Report: ${reportFile}`);
  }
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log('\n⚡ Chrome Page Speed Optimizer\n\nUsage:\n  bun run agents/chrome-page-speed-optimizer.ts <url> [--report <file>]\n');
  process.exit(0);
}

const options: OptimizerOptions = { url: args[0]! };
const reportIndex = args.indexOf('--report');
if (reportIndex !== -1 && args[reportIndex + 1]) options.reportFile = args[reportIndex + 1];

optimizePageSpeed(options).catch((err) => { console.error('❌ Fatal error:', err); process.exit(1); });
