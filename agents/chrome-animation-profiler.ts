#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';

interface AnimationOptions { url: string; reportFile?: string; }

async function profileAnimations(options: AnimationOptions) {
  const { url, reportFile = 'animation-profile-report.md' } = options;
  console.log('🎬 Chrome Animation Profiler\n');
  console.log(`URL: ${url}\n`);

  const prompt = `Profile animations on ${url}. Run performance trace, use JS to detect animations: CSS transitions, CSS animations, JS-based animations (requestAnimationFrame). For each animation: measure frame rate (target 60fps), identify jank (dropped frames), check if GPU-accelerated (transform/opacity vs other properties). Detect layout thrashing. Generate "${reportFile}" with: animation inventory, janky animations with specific causes, recommendations for GPU acceleration (use transform instead of top/left), suggestions to optimize animation performance.`;

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args: ['chrome-devtools-mcp@latest', '--isolated'] }},
      allowedTools: ['mcp__chrome-devtools__navigate_page', 'mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__performance_start_trace', 'mcp__chrome-devtools__performance_stop_trace', 'mcp__chrome-devtools__evaluate_script', 'Write', 'TodoWrite'],
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
  console.log('\n🎬 Chrome Animation Profiler\n\nUsage:\n  bun run agents/chrome-animation-profiler.ts <url> [--report <file>]\n');
  process.exit(0);
}

const options: AnimationOptions = { url: args[0]! };
const reportIndex = args.indexOf('--report');
if (reportIndex !== -1 && args[reportIndex + 1]) options.reportFile = args[reportIndex + 1];

profileAnimations(options).catch((err) => { console.error('❌ Fatal error:', err); process.exit(1); });
