#!/usr/bin/env -S bun run

/**
 * Chrome Animation Profiler Agent
 *
 * This agent uses Chrome DevTools MCP to profile and analyze animations on web pages:
 * - Runs performance traces to measure animation frame rates
 * - Detects CSS transitions, CSS animations, and JS-based animations
 * - Identifies janky animations (dropped frames)
 * - Checks if animations are GPU-accelerated
 * - Detects layout thrashing
 * - Generates detailed reports with optimization recommendations
 *
 * Usage:
 *   bun run agents/chrome-animation-profiler.ts <url> [options]
 *
 * Examples:
 *   # Basic animation profiling
 *   bun run agents/chrome-animation-profiler.ts https://example.com
 *
 *   # Custom report file
 *   bun run agents/chrome-animation-profiler.ts https://example.com --report my-report.md
 */

import { claude, getPositionals, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface AnimationProfileOptions {
  url: string;
  reportFile: string;
}

const DEFAULT_REPORT_FILE = "animation-profile-report.md";

function printHelp(): void {
  console.log(`
🎬 Chrome Animation Profiler

Usage:
  bun run agents/chrome-animation-profiler.ts <url> [options]

Arguments:
  url                     Website URL to profile

Options:
  --report <file>         Output file (default: ${DEFAULT_REPORT_FILE})
  --help, -h              Show this help

Examples:
  bun run agents/chrome-animation-profiler.ts https://example.com
  bun run agents/chrome-animation-profiler.ts https://example.com --report animations.md
  `);
}

function parseOptions(): AnimationProfileOptions | null {
  const values = parsedArgs.values as Record<string, unknown>;
  const positionals = getPositionals();
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const url = positionals[0];
  if (!url) {
    console.error("❌ Error: URL is required");
    printHelp();
    process.exit(1);
  }

  try {
    new URL(url);
  } catch (error) {
    console.error("❌ Error: Invalid URL format");
    process.exit(1);
  }

  const rawReport = values.report;
  const reportFile = typeof rawReport === "string" && rawReport.length > 0
    ? rawReport
    : DEFAULT_REPORT_FILE;

  return {
    url,
    reportFile,
  };
}

function buildPrompt(options: AnimationProfileOptions): string {
  const { url, reportFile } = options;

  return `
You are a performance expert using Chrome DevTools MCP to profile animations on web pages.

Target URL: ${url}

Your tasks:
1. Open the URL in Chrome using Chrome DevTools MCP
2. Start a performance trace recording
3. Navigate and interact with the page to capture animations
4. Stop the trace and analyze results
5. Use JavaScript evaluation to detect animations:
   - CSS transitions (getComputedStyle, transitionDuration)
   - CSS animations (@keyframes, animationName)
   - JS-based animations (requestAnimationFrame usage)
   - Scroll-triggered animations

6. For each animation detected, measure:
   - Frame rate (target is 60fps / 16.67ms per frame)
   - Identify dropped frames (jank)
   - Check if GPU-accelerated:
     * GPU-accelerated: transform, opacity
     * Not GPU-accelerated: top, left, width, height, margin
   - Detect layout thrashing (forced synchronous layout)

7. Generate a comprehensive animation profile report and save to "${reportFile}" with:
   - Animation inventory (list all animations found)
   - Performance metrics for each animation
   - Janky animations with specific causes
   - Recommendations for GPU acceleration
   - Suggestions to optimize animation performance

Format your report as:
## Animation Profile Summary
- Total Animations: [count]
- GPU-Accelerated: [count]
- Non-GPU: [count]
- Janky Animations: [count]
- Average FPS: [value]

## Animation Inventory
1. [Animation name/selector]
   - Type: [CSS transition/CSS animation/JS]
   - Properties: [transform, opacity, etc.]
   - FPS: [value]
   - GPU-Accelerated: [Yes/No]
   - Status: [Smooth/Janky]

## Performance Issues
1. [Issue description]
   - Animation: [name/selector]
   - Cause: [specific reason - e.g., animating width instead of transform]
   - Impact: [FPS drop, layout thrashing, etc.]
   - Fix: [Recommended solution with code example]

## Optimization Recommendations
1. [Use transform instead of top/left for movement]
2. [Use will-change sparingly]
3. [Reduce paint complexity]
4. [Avoid layout thrashing]

## Next Steps
- [Actionable item 1]
- [Actionable item 2]
`.trim();
}

const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🎬 Chrome Animation Profiler\n");
console.log(`URL: ${options.url}`);
console.log(`Report: ${options.reportFile}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "mcp__chrome-devtools__navigate_page",
  "mcp__chrome-devtools__new_page",
  "mcp__chrome-devtools__performance_start_trace",
  "mcp__chrome-devtools__performance_stop_trace",
  "mcp__chrome-devtools__evaluate_script",
  "Write",
  "TodoWrite",
];

const mcpConfig = {
  mcpServers: {
    "chrome-devtools": {
      command: "npx",
      args: ["chrome-devtools-mcp@latest", "--isolated"],
    },
  },
};

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  'mcp-config': JSON.stringify(mcpConfig),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
  'strict-mcp-config': true,
  'dangerously-skip-permissions': true,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Animation profiling complete!\n");
    console.log(`📄 Full report: ${options.reportFile}`);
    console.log("\nNext steps:");
    console.log("1. Review the animation profile report");
    console.log("2. Prioritize janky animations");
    console.log("3. Apply GPU acceleration recommendations");
    console.log("4. Re-profile to verify improvements");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
