#!/usr/bin/env bun

/**
 * Chrome Visual Regression Tester Agent
 *
 * Uses Chrome DevTools MCP to detect visual changes:
 * - Takes screenshots of pages at multiple breakpoints
 * - Compares against baseline images
 * - Detects visual differences (layout shifts, color changes, missing elements)
 * - Highlights areas that changed
 * - Generates visual diff report
 * - Can be used in CI/CD for pre-deployment checks
 *
 * Usage:
 *   bun run agents/chrome-visual-regression-tester.ts <url> [options]
 *
 * Examples:
 *   # Create baseline
 *   bun run agents/chrome-visual-regression-tester.ts https://example.com --create-baseline
 *
 *   # Compare against baseline
 *   bun run agents/chrome-visual-regression-tester.ts https://example.com
 *
 *   # Test multiple breakpoints
 *   bun run agents/chrome-visual-regression-tester.ts https://example.com --breakpoints 375,768,1920
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface VisualRegressionOptions {
  url: string;
  createBaseline?: boolean;
  baselineDir?: string;
  breakpoints?: number[];
  reportFile?: string;
  threshold?: number;
}

async function testVisualRegression(options: VisualRegressionOptions) {
  const {
    url,
    createBaseline = false,
    baselineDir = './visual-regression-baselines',
    breakpoints = [375, 768, 1280, 1920],
    reportFile = 'visual-regression-report.md',
    threshold = 0.1,
  } = options;

  console.log('📸 Chrome Visual Regression Tester\n');
  console.log(`URL: ${url}`);
  console.log(`Mode: ${createBaseline ? 'Creating Baseline' : 'Testing Changes'}`);
  console.log(`Breakpoints: ${breakpoints.join(', ')}px`);
  console.log(`Baseline Dir: ${baselineDir}`);
  console.log('');

  const prompt = `
You are a visual regression testing expert using Chrome DevTools MCP.

Target URL: ${url}
Mode: ${createBaseline ? 'CREATE BASELINE' : 'TEST FOR CHANGES'}
Breakpoints: ${breakpoints.join(', ')} pixels wide
Baseline Directory: ${baselineDir}
Diff Threshold: ${threshold}% (report changes larger than this)

Your tasks:

${
  createBaseline
    ? `
## CREATING BASELINE MODE

For each breakpoint (${breakpoints.join(', ')}px):

1. Open the URL in Chrome
2. Resize the page to [width]x800 viewport
3. Wait for page to fully load (network idle)
4. Take a full-page screenshot
5. Save screenshot to ${baselineDir}/baseline-[width]px.png
6. Also take a snapshot to save DOM structure

After capturing all breakpoints:
- Create a baseline manifest file: ${baselineDir}/manifest.json
  Include: URL, date, breakpoints, viewport dimensions
- Generate a baseline report

Generate baseline report and save to "${reportFile}":

## Visual Regression Baseline Created
**URL**: ${url}
**Date**: [timestamp]
**Breakpoints**: ${breakpoints.length}

### Screenshots Captured
- ${breakpoints.map((bp) => `${bp}px: ✅ Saved to baseline-${bp}px.png`).join('\n- ')}

### Baseline Manifest
\`\`\`json
{
  "url": "${url}",
  "created": "[timestamp]",
  "breakpoints": ${JSON.stringify(breakpoints)},
  "screenshots": [...]
}
\`\`\`

## Next Steps
Run without --create-baseline to test for visual changes against this baseline.
`
    : `
## TESTING FOR CHANGES MODE

For each breakpoint (${breakpoints.join(', ')}px):

1. Open the URL in Chrome
2. Resize to [width]x800
3. Wait for page load
4. Take full-page screenshot (current-[width]px.png)
5. Read baseline screenshot from ${baselineDir}/baseline-[width]px.png
6. Compare images:
   - Use visual comparison to identify differences
   - Calculate percentage of pixels changed
   - Identify areas with changes (top, middle, bottom of page)
   - Classify changes: layout shift, color change, added/removed elements, text change
7. If differences > ${threshold}%, report them

After testing all breakpoints, analyze patterns:
- Which breakpoints have changes?
- Are changes consistent across breakpoints?
- Are changes intentional (new features) or bugs (regressions)?

Generate visual regression report and save to "${reportFile}":

## Visual Regression Test Report
**URL**: ${url}
**Date**: [timestamp]
**Baseline**: ${baselineDir}

### Overall Results
- ✅ Passed: [count] breakpoints
- ⚠️  Changes Detected: [count] breakpoints
- ❌ Major Changes: [count] breakpoints
- Total Diff Score: [percentage]%

### Changes by Breakpoint

#### 📱 Mobile (375px)
- Status: ✅/⚠️/❌
- Diff Percentage: [X]%
- Changes Detected:
  1. [Area of page]: [Description of change]
  2. [Next change]

#### 💻 Tablet (768px)
- Status: ✅/⚠️/❌
- Diff Percentage: [X]%
- Changes Detected: [list or "None"]

#### 🖥️  Desktop (1280px)
[Similar format]

#### 🖥️  Large Desktop (1920px)
[Similar format]

### Detailed Change Analysis

#### Change #1: [Description]
- Breakpoints Affected: [list]
- Location: [top/middle/bottom of page]
- Type: [Layout shift/Color change/Element added/Element removed/Text change]
- Impact: [High/Medium/Low]
- Screenshots:
  - Baseline: baseline-[width]px.png
  - Current: current-[width]px.png
  - Diff: diff-[width]px.png (if generated)

#### Change #2: [Description]
[Similar format]

### Possible Causes
1. [Most likely cause of changes]
2. [Next possible cause]
3. [Alternative explanation]

### Recommendations
${threshold <= 0.1 ? `
- Changes exceed ${threshold}% threshold
- Review changes to determine if intentional or bugs
- If intentional: Update baseline with --create-baseline
- If bugs: Fix the visual regressions
` : ''}

### Action Items
- [ ] Review all detected changes
- [ ] Investigate high-impact changes first
- [ ] Fix unintentional regressions
- [ ] Update baseline if changes are approved
- [ ] Re-run test to verify fixes
`
}
`.trim();

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: {
        'chrome-devtools': {
          type: 'stdio',
          command: 'npx',
          args: ['chrome-devtools-mcp@latest', '--isolated'],
        },
      },
      allowedTools: [
        'mcp__chrome-devtools__navigate_page',
        'mcp__chrome-devtools__new_page',
        'mcp__chrome-devtools__take_screenshot',
        'mcp__chrome-devtools__resize_page',
        'mcp__chrome-devtools__wait_for',
        'Read',
        'Write',
        'Bash',
        'TodoWrite',
      ],
      permissionMode: 'acceptEdits',
      maxTurns: 40,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  for await (const message of result) {
    if (message.type === 'assistant') {
      const textContent = message.message.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        const text = textContent.text;
        if (!text.includes('tool_use') && text.trim().length > 0) {
          console.log('\n💡', text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('\n' + '='.repeat(60));
        console.log('📊 Visual Regression Test Complete');
        console.log('='.repeat(60));
        console.log(`\nDuration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`\n📄 Report: ${reportFile}`);

        if (message.result) {
          console.log('\n' + message.result);
        }
      }
    }
  }
}

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
📸 Chrome Visual Regression Tester

Usage:
  bun run agents/chrome-visual-regression-tester.ts <url> [options]

Arguments:
  url                     Website URL to test

Options:
  --create-baseline       Create baseline screenshots (first run)
  --baseline-dir <dir>    Baseline directory (default: ./visual-regression-baselines)
  --breakpoints <list>    Comma-separated widths (default: 375,768,1280,1920)
  --threshold <percent>   Diff threshold % (default: 0.1)
  --report <file>         Output file (default: visual-regression-report.md)
  --help                  Show this help

Examples:
  # First run: create baseline
  bun run agents/chrome-visual-regression-tester.ts https://example.com --create-baseline

  # Test for changes
  bun run agents/chrome-visual-regression-tester.ts https://example.com

  # Custom breakpoints
  bun run agents/chrome-visual-regression-tester.ts https://example.com --breakpoints 320,768,1440

  # Custom threshold
  bun run agents/chrome-visual-regression-tester.ts https://example.com --threshold 1.0
  `);
  process.exit(0);
}

const url = args[0];
if (!url) {
  console.error('❌ Error: URL is required');
  process.exit(1);
}

try {
  new URL(url);
} catch (error) {
  console.error('❌ Error: Invalid URL');
  process.exit(1);
}

const options: VisualRegressionOptions = {
  url,
  createBaseline: args.includes('--create-baseline'),
};

for (let i = 1; i < args.length; i++) {
  switch (args[i]) {
    case '--baseline-dir':
      options.baselineDir = args[++i];
      break;
    case '--breakpoints':
      const bpArg = args[++i];
      if (bpArg) options.breakpoints = bpArg.split(',').map(Number);
      break;
    case '--threshold':
      const thresholdArg = args[++i];
      if (thresholdArg) options.threshold = parseFloat(thresholdArg);
      break;
    case '--report':
      options.reportFile = args[++i];
      break;
  }
}

testVisualRegression(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
