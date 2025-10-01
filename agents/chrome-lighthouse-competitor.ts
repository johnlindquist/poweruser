#!/usr/bin/env bun

/**
 * Chrome Lighthouse Competitor Agent
 *
 * Uses Chrome DevTools MCP to compare your site against competitors:
 * - Runs Lighthouse audits on multiple sites
 * - Compares performance, accessibility, SEO, best practices
 * - Identifies areas where competitors excel
 * - Generates competitive analysis report
 * - Suggests improvements to beat competitors
 *
 * Usage:
 *   bun run agents/chrome-lighthouse-competitor.ts <your-url> <competitor-url> [more-urls...] [options]
 *
 * Examples:
 *   bun run agents/chrome-lighthouse-competitor.ts https://mysite.com https://competitor1.com
 *   bun run agents/chrome-lighthouse-competitor.ts https://mysite.com https://comp1.com https://comp2.com --report comparison.md
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface CompetitorOptions {
  yourUrl: string;
  competitorUrls: string[];
  reportFile?: string;
  mobile?: boolean;
}

async function compareWithCompetitors(options: CompetitorOptions) {
  const { yourUrl, competitorUrls, reportFile = 'competitor-analysis.md', mobile = false } =
    options;

  console.log('🏆 Chrome Lighthouse Competitor Analyzer\n');
  console.log(`Your Site: ${yourUrl}`);
  console.log(`Competitors: ${competitorUrls.length}`);
  competitorUrls.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));
  if (mobile) console.log('Device: Mobile');
  console.log('');

  const allUrls = [yourUrl, ...competitorUrls];

  const prompt = `
You are a competitive analysis expert using Chrome DevTools MCP to benchmark sites.

Your Site: ${yourUrl}
Competitors: ${competitorUrls.join(', ')}
${mobile ? 'Device: Mobile (375x667)' : 'Device: Desktop'}

Your tasks:
For each site (${allUrls.length} total), perform these steps:

1. Open the URL in Chrome
${mobile ? '2. Resize to mobile viewport (375x667)' : ''}
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

Generate a comprehensive competitive analysis and save to "${reportFile}" with:

## Lighthouse Competitor Analysis
**Your Site**: ${yourUrl}
**Competitors**: ${competitorUrls.length}
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
| ${yourUrl} | [X]ms | [X] | [X]ms | [Pass/Fail] |
${competitorUrls.map((url) => `| ${url} | [X]ms | [X] | [X]ms | [Pass/Fail] |`).join('\n')}

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
        'mcp__chrome-devtools__performance_start_trace',
        'mcp__chrome-devtools__performance_stop_trace',
        'mcp__chrome-devtools__performance_analyze_insight',
        'mcp__chrome-devtools__list_network_requests',
        'Write',
        'TodoWrite',
      ],
      permissionMode: 'bypassPermissions',
      maxTurns: 50,
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
        console.log('📊 Competitive Analysis Complete');
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

if (args.length < 2 || args.includes('--help')) {
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
  --help                  Show this help

Examples:
  bun run agents/chrome-lighthouse-competitor.ts https://mysite.com https://competitor.com
  bun run agents/chrome-lighthouse-competitor.ts https://mysite.com https://comp1.com https://comp2.com
  bun run agents/chrome-lighthouse-competitor.ts https://mysite.com https://competitor.com --mobile
  bun run agents/chrome-lighthouse-competitor.ts https://mysite.com https://competitor.com --report comparison.md
  `);
  process.exit(0);
}

const urls = args.filter((arg) => !arg.startsWith('--'));
if (urls.length < 2) {
  console.error('❌ Error: Need at least 2 URLs (your site + 1 competitor)');
  process.exit(1);
}

urls.forEach((url) => {
  try {
    new URL(url);
  } catch (error) {
    console.error(`❌ Error: Invalid URL: ${url}`);
    process.exit(1);
  }
});

const options: CompetitorOptions = {
  yourUrl: urls[0]!,
  competitorUrls: urls.slice(1),
  mobile: args.includes('--mobile'),
};

const reportIndex = args.indexOf('--report');
if (reportIndex !== -1 && args[reportIndex + 1]) {
  options.reportFile = args[reportIndex + 1];
}

compareWithCompetitors(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
