#!/usr/bin/env bun

/**
 * Chrome Performance Analysis Agent
 *
 * This agent uses Chrome DevTools MCP to analyze website performance:
 * - Runs performance traces with Core Web Vitals (LCP, CLS, FID)
 * - Analyzes render delays and JavaScript execution bottlenecks
 * - Identifies third-party script impact
 * - Examines network waterfall and resource loading
 * - Generates actionable optimization recommendations
 *
 * Usage:
 *   bun run agents/chrome-perf-agent.ts <url> [options]
 *
 * Examples:
 *   # Basic performance analysis
 *   bun run agents/chrome-perf-agent.ts https://example.com
 *
 *   # With network throttling
 *   bun run agents/chrome-perf-agent.ts https://example.com --throttle slow3g
 *
 *   # Generate optimization plan
 *   bun run agents/chrome-perf-agent.ts https://example.com --generate-plan
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface ChromePerfOptions {
  url: string;
  throttle?: 'slow3g' | 'fast3g' | 'slow4g' | 'fast4g' | 'none';
  cpuThrottle?: number; // 1-20x slowdown
  mobile?: boolean;
  generatePlan?: boolean;
  outputFile?: string;
}

async function analyzePerformance(options: ChromePerfOptions) {
  const {
    url,
    throttle = 'none',
    cpuThrottle,
    mobile = false,
    generatePlan = false,
    outputFile,
  } = options;

  console.log('🚀 Chrome Performance Analysis Agent\n');
  console.log(`URL: ${url}`);
  if (throttle !== 'none') console.log(`Network Throttling: ${throttle}`);
  if (cpuThrottle) console.log(`CPU Throttling: ${cpuThrottle}x slowdown`);
  if (mobile) console.log(`Device: Mobile simulation`);
  console.log('');

  const prompt = `
You are a web performance expert using Chrome DevTools MCP to analyze website performance.

Target URL: ${url}

Your tasks:
1. Open the URL in Chrome using the Chrome DevTools MCP
2. ${throttle !== 'none' ? `Apply ${throttle} network throttling` : ''}
3. ${cpuThrottle ? `Apply ${cpuThrottle}x CPU throttling` : ''}
4. ${mobile ? 'Resize to mobile viewport (375x667)' : ''}
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
14. ${outputFile ? `Save the plan to "${outputFile}"` : 'Save the plan to "perf-optimization-plan.md"'}
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

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      // Use Chrome DevTools MCP with isolated mode
      mcpServers: {
        'chrome-devtools': {
          type: 'stdio',
          command: 'npx',
          args: ['chrome-devtools-mcp@latest', '--isolated'],
        },
      },
      // Allow necessary tools
      allowedTools: [
        // Chrome DevTools MCP tools
        'mcp__chrome-devtools__navigate_page',
        'mcp__chrome-devtools__new_page',
        'mcp__chrome-devtools__list_pages',
        'mcp__chrome-devtools__performance_start_trace',
        'mcp__chrome-devtools__performance_stop_trace',
        'mcp__chrome-devtools__performance_analyze_insight',
        'mcp__chrome-devtools__list_network_requests',
        'mcp__chrome-devtools__get_network_request',
        'mcp__chrome-devtools__take_snapshot',
        'mcp__chrome-devtools__resize_page',
        'mcp__chrome-devtools__emulate_network',
        'mcp__chrome-devtools__emulate_cpu',
        'mcp__chrome-devtools__list_console_messages',
        // File tools for saving reports
        'Write',
        'Read',
        'TodoWrite',
      ],
      // Auto-accept file writes for report generation
      permissionMode: 'acceptEdits',
      // Add hooks to track progress
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  const toolName = input.tool_name;
                  if (toolName === 'mcp__chrome-devtools__performance_start_trace') {
                    console.log('🔄 Starting performance trace...');
                  } else if (toolName === 'mcp__chrome-devtools__performance_analyze_insight') {
                    const insightName = (input.tool_input as any).insightName;
                    console.log(`📊 Analyzing insight: ${insightName}`);
                  } else if (toolName === 'mcp__chrome-devtools__list_network_requests') {
                    console.log('🌐 Fetching network requests...');
                  } else if (toolName === 'Write') {
                    const filePath = (input.tool_input as any).file_path;
                    console.log(`💾 Saving report to: ${filePath}`);
                  }
                }
                return { continue: true };
              },
            ],
          },
        ],
        PostToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PostToolUse') {
                  const toolName = input.tool_name;
                  if (toolName === 'mcp__chrome-devtools__performance_stop_trace') {
                    console.log('✅ Performance trace complete');
                  } else if (toolName === 'Write') {
                    console.log('✅ Report saved successfully');
                  }
                }
                return { continue: true };
              },
            ],
          },
        ],
        SessionEnd: [
          {
            hooks: [
              async () => {
                console.log('\n✨ Performance analysis complete!');
                if (generatePlan) {
                  console.log(`\n📄 Optimization plan saved to: ${outputFile || 'perf-optimization-plan.md'}`);
                }
                console.log('\nNext steps:');
                console.log('1. Review the performance bottlenecks identified');
                console.log('2. Prioritize fixes based on impact and effort');
                console.log('3. Implement quick wins first');
                console.log('4. Re-run this analysis after optimizations');
                return { continue: true };
              },
            ],
          },
        ],
      },
      // Configure max turns to prevent infinite loops
      maxTurns: 30,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  // Stream results
  let finalReport = '';
  for await (const message of result) {
    if (message.type === 'assistant') {
      const textContent = message.message.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        // Only show analysis output, not tool responses
        const text = textContent.text;
        if (
          !text.includes('tool_use') &&
          !text.includes('function_calls') &&
          text.trim().length > 0
        ) {
          console.log('\n💡', text);
          finalReport += text + '\n';
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('\n' + '='.repeat(60));
        console.log('📊 Analysis Statistics');
        console.log('='.repeat(60));
        console.log(`\nDuration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`API calls: ${(message.duration_api_ms / 1000).toFixed(2)}s`);
        console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`Turns: ${message.num_turns}`);
        console.log(
          `Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`
        );

        if (message.usage.cache_read_input_tokens) {
          console.log(`Cache hits: ${message.usage.cache_read_input_tokens} tokens`);
        }

        // Show final summary
        if (message.result) {
          console.log('\n' + '='.repeat(60));
          console.log('📝 Final Summary');
          console.log('='.repeat(60));
          console.log('\n' + message.result);
        }
      } else {
        console.error('\n❌ Error during performance analysis:', message.subtype);
      }
    }
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
🚀 Chrome Performance Analysis Agent

Usage:
  bun run agents/chrome-perf-agent.ts <url> [options]

Arguments:
  url                     Website URL to analyze

Options:
  --throttle <type>       Network throttling (slow3g|fast3g|slow4g|fast4g|none)
  --cpu <multiplier>      CPU throttling (1-20x slowdown, default: none)
  --mobile                Simulate mobile device viewport
  --generate-plan         Generate comprehensive optimization plan
  --output <file>         Output file for optimization plan (default: perf-optimization-plan.md)
  --help                  Show this help message

Examples:
  # Basic performance analysis
  bun run agents/chrome-perf-agent.ts https://example.com

  # Simulate slow mobile connection
  bun run agents/chrome-perf-agent.ts https://example.com --throttle slow3g --mobile

  # Generate full optimization plan
  bun run agents/chrome-perf-agent.ts https://example.com --generate-plan

  # Analyze with CPU throttling (4x slowdown)
  bun run agents/chrome-perf-agent.ts https://example.com --cpu 4

  # Save plan to custom file
  bun run agents/chrome-perf-agent.ts https://example.com --generate-plan --output my-perf-plan.md

Core Web Vitals Targets:
  LCP (Largest Contentful Paint): < 2.5s (Good), < 4.0s (Needs Improvement)
  CLS (Cumulative Layout Shift):  < 0.1 (Good), < 0.25 (Needs Improvement)
  FID (First Input Delay):        < 100ms (Good), < 300ms (Needs Improvement)
  `);
  process.exit(0);
}

const url = args[0];

if (!url) {
  console.error('❌ Error: URL is required');
  process.exit(1);
}

// Validate URL
try {
  new URL(url);
} catch (error) {
  console.error('❌ Error: Invalid URL format');
  process.exit(1);
}

// Parse CLI options
const options: ChromePerfOptions = {
  url,
  throttle: 'none',
  mobile: false,
  generatePlan: false,
};

for (let i = 1; i < args.length; i++) {
  switch (args[i]) {
    case '--throttle':
      options.throttle = args[++i] as any;
      break;
    case '--cpu':
      options.cpuThrottle = parseInt(args[++i] || '1', 10);
      break;
    case '--mobile':
      options.mobile = true;
      break;
    case '--generate-plan':
      options.generatePlan = true;
      break;
    case '--output':
      options.outputFile = args[++i];
      break;
  }
}

// Validate throttle option
const validThrottles = ['slow3g', 'fast3g', 'slow4g', 'fast4g', 'none'];
if (options.throttle && !validThrottles.includes(options.throttle)) {
  console.error(
    `❌ Error: Invalid throttle option. Must be one of: ${validThrottles.join(', ')}`
  );
  process.exit(1);
}

// Validate CPU throttle
if (options.cpuThrottle && (options.cpuThrottle < 1 || options.cpuThrottle > 20)) {
  console.error('❌ Error: CPU throttle must be between 1 and 20');
  process.exit(1);
}

// Run the performance analysis
analyzePerformance(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
