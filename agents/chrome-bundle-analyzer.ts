#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';

interface BundleAnalyzerOptions { url: string; reportFile?: string; }

async function analyzeBundle(options: BundleAnalyzerOptions) {
  const { url, reportFile = 'bundle-analysis-report.md' } = options;
  console.log('📦 Chrome Bundle Analyzer\n');
  console.log(`URL: ${url}\n`);

  const prompt = `Analyze JavaScript bundles for ${url}. List network requests filtered by scripts. For each JS file: measure size (raw vs gzipped), analyze loading priority, identify if render-blocking. Use JS to check for: duplicate dependencies (e.g., multiple lodash versions), unused code opportunities, large libraries that could be replaced with smaller alternatives. Suggest code-splitting opportunities. Generate "${reportFile}" with: bundle inventory (sizes, load order), duplicate dependencies to deduplicate, large libraries to replace, code-splitting recommendations, tree-shaking opportunities, estimated savings from optimizations.`;

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args: ['chrome-devtools-mcp@latest', '--isolated'] }},
      allowedTools: ['mcp__chrome-devtools__navigate_page', 'mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__list_network_requests', 'mcp__chrome-devtools__get_network_request', 'mcp__chrome-devtools__evaluate_script', 'Write', 'TodoWrite'],
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
  console.log('\n📦 Chrome Bundle Analyzer\n\nUsage:\n  bun run agents/chrome-bundle-analyzer.ts <url> [--report <file>]\n');
  process.exit(0);
}

const options: BundleAnalyzerOptions = { url: args[0]! };
const reportIndex = args.indexOf('--report');
if (reportIndex !== -1 && args[reportIndex + 1]) options.reportFile = args[reportIndex + 1];

analyzeBundle(options).catch((err) => { console.error('❌ Fatal error:', err); process.exit(1); });
