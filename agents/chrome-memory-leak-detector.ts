#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';

interface MemoryLeakOptions { url: string; duration?: number; reportFile?: string; }

async function detectMemoryLeaks(options: MemoryLeakOptions) {
  const { url, duration = 30, reportFile = 'memory-leak-report.md' } = options;
  console.log('🧠 Chrome Memory Leak Detector\n');
  console.log(`URL: ${url}`);
  console.log(`Monitoring Duration: ${duration}s\n`);

  const prompt = `Monitor ${url} for memory leaks over ${duration} seconds. Open page, use JavaScript to monitor memory over time: check performance.memory, count detached DOM nodes, identify event listeners not cleaned up. Interact with page (open/close modals, navigate). Take multiple memory snapshots. Generate "${reportFile}" identifying: memory growth patterns, detached nodes, event listener leaks, potential closure leaks, and fixes.`;

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args: ['chrome-devtools-mcp@latest', '--isolated'] }},
      allowedTools: ['mcp__chrome-devtools__navigate_page', 'mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__evaluate_script', 'mcp__chrome-devtools__click', 'mcp__chrome-devtools__wait_for', 'Write', 'TodoWrite'],
      permissionMode: 'bypassPermissions',
      maxTurns: 35,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  for await (const message of result) {
    if (message.type === 'result' && message.subtype === 'success') console.log(`\n📄 Report: ${reportFile}`);
  }
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log('\n🧠 Chrome Memory Leak Detector\n\nUsage:\n  bun run agents/chrome-memory-leak-detector.ts <url> [--duration <seconds>] [--report <file>]\n');
  process.exit(0);
}

const options: MemoryLeakOptions = { url: args[0]! };
const durationIndex = args.indexOf('--duration');
if (durationIndex !== -1 && args[durationIndex + 1]) options.duration = parseInt(args[durationIndex + 1]!);
const reportIndex = args.indexOf('--report');
if (reportIndex !== -1 && args[reportIndex + 1]) options.reportFile = args[reportIndex + 1];

detectMemoryLeaks(options).catch((err) => { console.error('❌ Fatal error:', err); process.exit(1); });
