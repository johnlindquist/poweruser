#!/usr/bin/env -S bun run

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface CompetitorOptions {
  yourUrl: string;
  competitorUrls: string[];
  reportFile: string;
  mobile: boolean;
}

function printHelp(): void {
  console.log(`
🏆 Chrome Lighthouse Competitor Analyzer

Usage:
  bun run agents/chrome-lighthouse-competitor.ts <your-url> <competitor-url> [more-urls...] [options]

Arguments:
  your-url                Your website URL
  competitor-url(s)       One or more competitor URLs

Options:
  --report <file>         Output file (default: competitor-analysis.md)
  --mobile                Test on mobile viewport
  --help, -h              Show this help
  `);
}

function parseOptions(): CompetitorOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  if (positionals.length < 2) {
    console.error('❌ Error: Need at least 2 URLs (your site + 1 competitor)');
    printHelp();
    process.exit(1);
  }

  positionals.forEach((url) => {
    try {
      new URL(url);
    } catch (error) {
      console.error(`❌ Error: Invalid URL: ${url}`);
      process.exit(1);
    }
  });

  const reportFile = typeof values.report === "string" ? values.report : "competitor-analysis.md";
  const mobile = values.mobile === true;

  return {
    yourUrl: positionals[0]!,
    competitorUrls: positionals.slice(1),
    reportFile,
    mobile
  };
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["report", "mobile", "help", "h"] as const;
  for (const key of agentKeys) {
    if (key in values) delete values[key];
  }
}

const options = parseOptions();
if (!options) process.exit(0);

console.log('🏆 Chrome Lighthouse Competitor Analyzer\n');
console.log(`Your Site: ${options.yourUrl}`);
console.log(`Competitors: ${options.competitorUrls.length}`);
options.competitorUrls.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));
if (options.mobile) console.log('Device: Mobile');
console.log('');

const allUrls = [options.yourUrl, ...options.competitorUrls];

const prompt = `
You are a competitive analysis expert using Chrome DevTools MCP to benchmark sites.

Your Site: ${options.yourUrl}
Competitors: ${options.competitorUrls.join(', ')}
${options.mobile ? 'Device: Mobile (375x667)' : 'Device: Desktop'}

Your tasks:
For each site (${allUrls.length} total), perform these steps:

1. Open the URL in Chrome
${options.mobile ? '2. Resize to mobile viewport (375x667)' : ''}
3. Run a performance trace with auto-reload
4. Analyze performance insights:
   - LCP (Largest Contentful Paint)
   - CLS (Cumulative Layout Shift)
   - TTFB (Time to First Byte)
   - Total Blocking Time
   - Speed Index

5. Check Core Web Vitals:
   - LCP threshold: < 2.5s (Good), < 4.0s (Needs Improvement)
   - CLS threshold: < 0.1 (Good), < 0.25 (Needs Improvement)

6. Analyze page characteristics:
   - Total page weight
   - Number of requests
   - JavaScript bundle size
   - CSS size
   - Image count and total size
   - Font loading strategy

7. Check network requests:
   - Third-party scripts count
   - Render-blocking resources
   - Largest resources by size

8. Take a screenshot of each site

After analyzing all sites, create a comparison table and generate report.

Generate a comprehensive competitive analysis and save to "${options.reportFile}" with:

## Lighthouse Competitor Analysis
**Your Site**: ${options.yourUrl}
**Competitors**: ${options.competitorUrls.length}
**Date**: [timestamp]

## Overall Ranking

| Rank | Site | Performance | Accessibility | SEO | Best Practices | Overall |
|------|------|-------------|---------------|-----|----------------|---------|
| 🥇 | [Site] | [score] | [score] | [score] | [score] | [average] |
| 🥈 | [Site] | [score] | [score] | [score] | [score] | [average] |
| 🥉 | [Site] | [score] | [score] | [score] | [score] | [average] |

## Core Web Vitals Comparison

| Site | LCP | CLS | TTFB | Status |
|------|-----|-----|------|--------|
| ${options.yourUrl} | [X]ms | [X] | [X]ms | [Pass/Fail] |
${options.competitorUrls.map((url) => `| ${url} | [X]ms | [X] | [X]ms | [Pass/Fail] |`).join('\n')}

## Performance Metrics Comparison

### Page Weight
- 🏆 Lightest: [Site] ([X] KB)
- Your Site: [X] KB ([rank])
- 📊 Average: [X] KB

### JavaScript
- 🏆 Smallest: [Site] ([X] KB)
- Your Site: [X] KB ([rank])
- 📊 Average: [X] KB

### Images
- 🏆 Most Optimized: [Site] ([X] KB, [Y] images)
- Your Site: [X] KB, [Y] images ([rank])

### Request Count
- 🏆 Fewest: [Site] ([X] requests)
- Your Site: [X] requests ([rank])
- 📊 Average: [X] requests

## Where Competitors Excel

### [Competitor 1] Beats You In:
1. **[Metric]** - They: [value], You: [value]
   - What they're doing: [analysis]
   - How to catch up: [recommendation]

2. **[Metric]** - They: [value], You: [value]
   - What they're doing: [analysis]
   - How to catch up: [recommendation]

### [Competitor 2] Beats You In:
[Similar format]

## Where You Excel 💪

1. **[Metric]** - You: [value], Best Competitor: [value]
   - Keep doing: [what you're doing right]

## Opportunities to Beat All Competitors

1. **[Opportunity]** - Potential Impact: High
   - Current: You rank [X] of [Y]
   - Gap to #1: [value]
   - Implementation: [steps to take]
   - Estimated time: [timeframe]

2. **[Next opportunity]**

## Quick Wins (Implement This Week)
1. [Easy improvement based on competitor analysis]
2. [Next quick win]
3. [Next quick win]

## Long-term Strategy (3-6 months)
1. [Major improvement initiative]
2. [Next initiative]

## Technology Stack Insights
- Competitor 1: [Technologies detected]
- Competitor 2: [Technologies detected]
- Recommendation: [Tech to consider adopting]

## Action Plan
**Week 1**: [Quick wins]
**Week 2-4**: [Medium-term improvements]
**Month 2-3**: [Long-term initiatives]

## Success Metrics
- Target LCP: [value] (beat best competitor by [X]ms)
- Target Page Weight: [value] (beat lightest by [X]KB)
- Target Score: [value] (beat top competitor)
`.trim();

const settings: Settings = {};
const allowedTools = ["mcp__chrome-devtools__navigate_page", "mcp__chrome-devtools__new_page", "mcp__chrome-devtools__take_screenshot", "mcp__chrome-devtools__resize_page", "mcp__chrome-devtools__performance_start_trace", "mcp__chrome-devtools__performance_stop_trace", "mcp__chrome-devtools__performance_analyze_insight", "mcp__chrome-devtools__list_network_requests", "Write", "TodoWrite"];
const mcpConfig = { mcpServers: { "chrome-devtools": { command: "npx", args: ["chrome-devtools-mcp@latest", "--isolated"] }}};

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  "mcp-config": JSON.stringify(mcpConfig),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
  "strict-mcp-config": true,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log('\n✨ Competitive analysis complete!');
    console.log(`📄 Report: ${options.reportFile}`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
