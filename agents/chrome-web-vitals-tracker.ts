#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';

interface VitalsTrackerOptions { url: string; runs?: number; reportFile?: string; }

async function trackWebVitals(options: VitalsTrackerOptions) {
  const { url, runs = 5, reportFile = 'web-vitals-tracking-report.md' } = options;
  console.log('📈 Chrome Web Vitals Tracker\n');
  console.log(`URL: ${url}`);
  console.log(`Test Runs: ${runs}\n`);

  const prompt = `Track Core Web Vitals for ${url} over ${runs} test runs. For each run: open fresh page, run performance trace, measure LCP, CLS, INP/FID, TTFB. Collect all measurements. Calculate statistics: mean, median, p75, p95, min, max for each metric. Identify variability and outliers. Generate "${reportFile}" with: statistical analysis, trends, pass/fail for each metric, consistency assessment, recommendations to improve reliability and reduce variance.`;

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args: ['chrome-devtools-mcp@latest', '--isolated'] }},
      allowedTools: ['mcp__chrome-devtools__navigate_page', 'mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__performance_start_trace', 'mcp__chrome-devtools__performance_stop_trace', 'mcp__chrome-devtools__performance_analyze_insight', 'mcp__chrome-devtools__close_page', 'Write', 'TodoWrite'],
      permissionMode: 'bypassPermissions',
      maxTurns: 40,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  for await (const message of result) {
    if (message.type === 'result' && message.subtype === 'success') console.log(`\n📄 Report: ${reportFile}`);
  }
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log('\n📈 Chrome Web Vitals Tracker\n\nUsage:\n  bun run agents/chrome-web-vitals-tracker.ts <url> [--runs <number>] [--report <file>]\n');
  process.exit(0);
}

const options: VitalsTrackerOptions = { url: args[0]! };
const runsIndex = args.indexOf('--runs');
if (runsIndex !== -1 && args[runsIndex + 1]) options.runs = parseInt(args[runsIndex + 1]!);
const reportIndex = args.indexOf('--report');
if (reportIndex !== -1 && args[reportIndex + 1]) options.reportFile = args[reportIndex + 1];

trackWebVitals(options).catch((err) => { console.error('❌ Fatal error:', err); process.exit(1); });
