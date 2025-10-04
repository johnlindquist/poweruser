#!/usr/bin/env -S bun run

/**
 * Chrome Performance Analysis Agent
 */

import { claude, getPositionals, parsedArgs, readStringFlag, readBooleanFlag } from './lib';
import type { ClaudeFlags, Settings } from './lib';

type NetworkThrottle = 'slow3g' | 'fast3g' | 'slow4g' | 'fast4g' | 'none';

interface ChromePerfOptions {
  url: string;
  throttle: NetworkThrottle;
  cpuThrottle?: number;
  mobile: boolean;
  generatePlan: boolean;
  outputFile?: string;
}

const VALID_THROTTLES: NetworkThrottle[] = ['slow3g', 'fast3g', 'slow4g', 'fast4g', 'none'];
const DEFAULT_PLAN_FILE = 'perf-optimization-plan.md';

function printHelp(): void {
  console.log(`
🚀 Chrome Performance Analysis Agent

Usage:
  bun run agents/chrome-perf-agent.ts <url> [options]

Options:
  --throttle <type>       Network throttling (${VALID_THROTTLES.join('|')})
  --cpu <multiplier>      CPU throttling (1-20x slowdown)
  --mobile                Simulate mobile viewport (375x667)
  --generate-plan         Produce a detailed optimization plan
  --output <file>         Custom plan filename (default: ${DEFAULT_PLAN_FILE})
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
  console.error('❌ Error: URL is required');
  printHelp();
  process.exit(1);
}

const urlCandidate = positionals[0]!;
try {
  new URL(urlCandidate);
} catch {
  console.error('❌ Error: Invalid URL format');
  process.exit(1);
}

function parseOptions(): ChromePerfOptions {
  const throttleRaw = readStringFlag('throttle');
  const throttle = (throttleRaw ?? 'none') as NetworkThrottle;

  if (!VALID_THROTTLES.includes(throttle)) {
    console.error(`❌ Error: Invalid throttle option. Must be one of: ${VALID_THROTTLES.join(', ')}`);
    process.exit(1);
  }

  const cpuThrottleRaw = readStringFlag('cpu');
  const cpuThrottle = cpuThrottleRaw ? Number(cpuThrottleRaw) : undefined;
  if (cpuThrottle !== undefined && (!Number.isFinite(cpuThrottle) || cpuThrottle < 1 || cpuThrottle > 20)) {
    console.error('❌ Error: --cpu must be between 1 and 20');
    process.exit(1);
  }

  const generatePlan = readBooleanFlag('generate-plan', false);
  const outputFile = readStringFlag('output');

  return {
    url: urlCandidate,
    throttle,
    cpuThrottle,
    mobile: readBooleanFlag('mobile', false),
    generatePlan,
    outputFile,
  };
}

const options = parseOptions();
const planFile = options.outputFile ?? DEFAULT_PLAN_FILE;

console.log('🚀 Chrome Performance Analysis Agent\n');
console.log(`URL: ${options.url}`);
console.log(`Network throttling: ${options.throttle}`);
if (options.cpuThrottle) console.log(`CPU throttling: ${options.cpuThrottle}x slowdown`);
console.log(`Device: ${options.mobile ? 'Mobile' : 'Desktop'}`);
console.log(`Optimization plan: ${options.generatePlan ? 'enabled' : 'disabled'}`);
if (options.generatePlan) console.log(`Plan file: ${planFile}`);
console.log('');

function buildPrompt(opts: ChromePerfOptions): string {
  const { url, throttle, cpuThrottle, mobile, generatePlan } = opts;

  return `
You are a web performance expert using Chrome DevTools MCP to analyze website performance.

Target URL: ${url}

Your tasks:
1. Open the URL in Chrome using the Chrome DevTools MCP
2. ${throttle !== 'none' ? `Apply ${throttle} network throttling` : 'Use default network conditions'}
3. ${cpuThrottle ? `Apply ${cpuThrottle}x CPU throttling` : 'Keep CPU at baseline speed'}
4. ${mobile ? 'Resize viewport to 375x667 (mobile simulation)' : 'Keep default desktop viewport'}
5. Run a performance trace with auto-reload
6. Analyze the performance metrics:
   - LCP (Largest Contentful Paint)
   - CLS (Cumulative Layout Shift)
   - TTFB (Time to First Byte)
   - Render delays
7. Analyze the LCP Breakdown insight to identify render delays
8. Analyze the ThirdParties insight to identify third-party impact
9. Analyze the DocumentLatency insight for server response issues
10. List all network requests filtered by JavaScript and document types
11. Identify the top 5 performance bottlenecks with specific file names and sizes
12. Provide actionable recommendations for each bottleneck
${generatePlan ? `
13. Generate a comprehensive optimization plan markdown document with:
    - Executive summary with current metrics
    - Root cause analysis with specific file names, sizes, and timings
    - Prioritized optimization recommendations with code examples
    - Implementation timeline (Week 1: Quick wins, Week 2: Major optimizations, etc.)
    - Success metrics and testing checklist
14. Save the plan to "${planFile}"
` : ''}
Format your findings as:
## Performance Metrics
- LCP: [value]ms [status: Good/Needs Improvement/Poor]
- CLS: [value] [status]
- TTFB: [value]ms [status]
- Render Delay: [value]ms

## Top Performance Issues
1. [Issue name] - [Impact: High/Medium/Low]
   - File: [filename]
   - Size: [size]
   - Time: [timing]
   - Recommendation: [specific action]

2. [Next issue...]

## Quick Wins (Can implement in < 1 day)
- [Recommendation with estimated time savings]

## Major Optimizations (Require more effort)
- [Recommendation with estimated time savings]

${generatePlan ? '## Optimization Plan\n[Full markdown document saved to file]' : ''}
`.trim();
}

const prompt = buildPrompt(options);

const claudeSettings: Settings = {};

const allowedTools = [
  'mcp__chrome-devtools__get_network_request',
  'mcp__chrome-devtools__list_pages',
  'mcp__chrome-devtools__navigate_page',
  'mcp__chrome-devtools__performance_start_trace',
  'mcp__chrome-devtools__performance_stop_trace',
  'mcp__chrome-devtools__performance_analyze_insight',
  'mcp__chrome-devtools__list_network_requests',
  'mcp__chrome-devtools__resize_page',
  'mcp__chrome-devtools__emulate_network',
  'mcp__chrome-devtools__emulate_cpu',
  'Write',
  'Read',
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
  'permission-mode': 'acceptEdits',
  'mcp-config': JSON.stringify(mcpConfig),
  'strict-mcp-config': true,
};

claude(prompt, defaultFlags)
  .then((exitCode) => {
    if (exitCode === 0) {
      console.log('\n✨ Performance analysis complete!');
      if (options.generatePlan) {
        console.log(`📄 Optimization plan: ${planFile}`);
      }
    }
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
