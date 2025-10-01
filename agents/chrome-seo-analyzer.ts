#!/usr/bin/env bun

/**
 * Chrome SEO Analyzer Agent
 *
 * Uses Chrome DevTools MCP to analyze on-page SEO:
 * - Meta tags (title, description, keywords, OG tags)
 * - Structured data (JSON-LD, microdata)
 * - Heading hierarchy and keyword optimization
 * - Image optimization (alt text, file size, format)
 * - Internal linking structure
 * - Page speed metrics (Core Web Vitals)
 * - Mobile-friendliness
 * - Canonical URLs and hreflang
 *
 * Usage:
 *   bun run agents/chrome-seo-analyzer.ts <url> [options]
 *
 * Examples:
 *   bun run agents/chrome-seo-analyzer.ts https://example.com
 *   bun run agents/chrome-seo-analyzer.ts https://example.com --keyword "web design"
 *   bun run agents/chrome-seo-analyzer.ts https://example.com --report seo.md
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface SEOAnalyzerOptions {
  url: string;
  keyword?: string;
  reportFile?: string;
  checkPerformance?: boolean;
}

async function analyzeSEO(options: SEOAnalyzerOptions) {
  const { url, keyword, reportFile = 'seo-analysis.md', checkPerformance = true } = options;

  console.log('🔍 Chrome SEO Analyzer\n');
  console.log(`URL: ${url}`);
  if (keyword) console.log(`Target Keyword: "${keyword}"`);
  console.log('');

  const prompt = `
You are an SEO expert using Chrome DevTools MCP to analyze on-page SEO factors.

Target URL: ${url}
${keyword ? `Target Keyword: "${keyword}"` : ''}

Your tasks:
1. Open the URL in Chrome using Chrome DevTools MCP
2. Take a snapshot of the page
3. Extract SEO metadata using JavaScript:
   \`\`\`javascript
   () => {
     const seo = {
       title: document.title,
       metaTags: {},
       headings: { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] },
       images: [],
       links: { internal: 0, external: 0, nofollow: 0 },
       structuredData: [],
       canonical: null,
       hreflang: [],
       openGraph: {},
       twitter: {},
       robots: null
     };

     // Extract meta tags
     document.querySelectorAll('meta').forEach(meta => {
       const name = meta.getAttribute('name') || meta.getAttribute('property');
       const content = meta.getAttribute('content');
       if (name && content) {
         seo.metaTags[name] = content;

         // Parse Open Graph
         if (name.startsWith('og:')) {
           seo.openGraph[name.replace('og:', '')] = content;
         }

         // Parse Twitter cards
         if (name.startsWith('twitter:')) {
           seo.twitter[name.replace('twitter:', '')] = content;
         }

         // Robots meta
         if (name === 'robots') {
           seo.robots = content;
         }
       }
     });

     // Extract headings
     ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
       document.querySelectorAll(tag).forEach(heading => {
         seo.headings[tag].push(heading.textContent?.trim() || '');
       });
     });

     // Extract images
     document.querySelectorAll('img').forEach(img => {
       seo.images.push({
         src: img.src,
         alt: img.alt || null,
         width: img.width,
         height: img.height,
         loading: img.loading || 'eager'
       });
     });

     // Count links
     document.querySelectorAll('a[href]').forEach(link => {
       const href = link.href;
       const rel = link.rel;

       if (href.startsWith(window.location.origin)) {
         seo.links.internal++;
       } else if (href.startsWith('http')) {
         seo.links.external++;
       }

       if (rel && rel.includes('nofollow')) {
         seo.links.nofollow++;
       }
     });

     // Extract structured data
     document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
       try {
         const data = JSON.parse(script.textContent || '');
         seo.structuredData.push(data);
       } catch (e) {
         // Invalid JSON
       }
     });

     // Canonical URL
     const canonical = document.querySelector('link[rel="canonical"]');
     if (canonical) {
       seo.canonical = canonical.getAttribute('href');
     }

     // Hreflang tags
     document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(link => {
       seo.hreflang.push({
         lang: link.getAttribute('hreflang'),
         href: link.getAttribute('href')
       });
     });

     // Word count
     const bodyText = document.body.textContent || '';
     seo.wordCount = bodyText.trim().split(/\\s+/).length;

     return seo;
   }
   \`\`\`

4. Analyze the SEO data:
   - Title tag: Length (50-60 chars ideal), keyword presence, uniqueness
   - Meta description: Length (150-160 chars ideal), keyword presence, call-to-action
   - H1 tag: Should be one, should include keyword
   - Heading hierarchy: Logical structure, no skipped levels
   - Images: Alt text presence, file size, lazy loading
   - Internal links: Adequate quantity, relevant anchor text
   - Structured data: Presence and validity
   - Open Graph tags: Complete for social sharing
   - Canonical URL: Set correctly to avoid duplicate content

${keyword ? `
5. Keyword optimization analysis for "${keyword}":
   - Title tag includes keyword: Yes/No
   - Meta description includes keyword: Yes/No
   - H1 includes keyword: Yes/No
   - Keyword density in content: [percentage]
   - Keyword in first paragraph: Yes/No
   - Keyword in image alt text: Yes/No
   - Related keywords found: [list]
` : ''}

${checkPerformance ? `
6. Run performance trace to check Core Web Vitals:
   - LCP (Largest Contentful Paint): Target < 2.5s
   - CLS (Cumulative Layout Shift): Target < 0.1
   - FID/INP (First Input Delay/Interaction to Next Paint)
` : ''}

7. Check mobile-friendliness:
   - Viewport meta tag present
   - Text readable without zooming
   - Touch targets appropriately sized
   - No horizontal scrolling

8. Analyze page content:
   - Word count (300+ words for content pages)
   - Content uniqueness indicators
   - Keyword distribution
   - Readability

Generate a comprehensive SEO report and save to "${reportFile}" with:

## SEO Analysis Report
**URL**: ${url}
**Date**: [timestamp]
${keyword ? `**Target Keyword**: "${keyword}"` : ''}

## SEO Score: [0-100]

### Critical Issues 🔴
1. [Issue] - Impact: High
   - Current: [value]
   - Recommended: [value]
   - Fix: [solution]

### Warnings 🟡
1. [Issue] - Impact: Medium
   - Current: [value]
   - Recommended: [value]

### Passed ✅
- [List of passed checks]

## Meta Tags Analysis
- **Title**: "[title]" ([length] chars)
  - ✅/❌ Length appropriate (50-60 chars)
  - ✅/❌ Keyword present
  - Score: [0-10]

- **Meta Description**: "[description]" ([length] chars)
  - ✅/❌ Length appropriate (150-160 chars)
  - ✅/❌ Keyword present
  - ✅/❌ Contains CTA
  - Score: [0-10]

## Heading Structure
- H1: [count] - "[text]"
  - ✅/❌ Only one H1
  - ✅/❌ Keyword present
- H2: [count] - [list first 3]
- H3: [count]

## Content Analysis
- Word Count: [count] words
- ${keyword ? `Keyword Density: [percentage]%` : ''}
- Readability: [score]

## Images
- Total: [count]
- Missing Alt Text: [count]
- Not Optimized: [count] (> 100KB)
- Lazy Loading: [count] images use lazy loading

## Links
- Internal: [count]
- External: [count]
- Nofollow: [count]
- Broken: [count]

## Structured Data
- Types Found: [Schema.org types]
- Validation: ✅/❌

## Open Graph Tags
- og:title: [value]
- og:description: [value]
- og:image: [value]
- og:url: [value]

${checkPerformance ? `
## Core Web Vitals
- LCP: [value]ms - [Good/Needs Improvement/Poor]
- CLS: [value] - [Good/Needs Improvement/Poor]
- FID: [value]ms - [Good/Needs Improvement/Poor]
` : ''}

## Mobile-Friendliness
- Viewport Meta Tag: ✅/❌
- Text Readable: ✅/❌
- Touch Targets: ✅/❌

## Recommendations (Priority Order)
1. [Most important SEO improvement]
2. [Next improvement]
3. [Next improvement]

## Quick Wins
- [Easy fixes that will have immediate impact]

## Action Items
1. Fix critical issues immediately
2. Optimize meta tags
3. Improve content quality
4. Add/fix structured data
5. Optimize images
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
        'mcp__chrome-devtools__take_snapshot',
        'mcp__chrome-devtools__evaluate_script',
        'mcp__chrome-devtools__list_network_requests',
        ...(checkPerformance
          ? [
              'mcp__chrome-devtools__performance_start_trace',
              'mcp__chrome-devtools__performance_stop_trace',
              'mcp__chrome-devtools__performance_analyze_insight',
            ]
          : []),
        'Write',
        'TodoWrite',
      ],
      permissionMode: 'bypassPermissions',
      maxTurns: 30,
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
        console.log('📊 Analysis Complete');
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
🔍 Chrome SEO Analyzer

Usage:
  bun run agents/chrome-seo-analyzer.ts <url> [options]

Arguments:
  url                     Website URL to analyze

Options:
  --keyword <keyword>     Target keyword to optimize for
  --report <file>         Output file (default: seo-analysis.md)
  --no-performance        Skip performance metrics
  --help                  Show this help

Examples:
  bun run agents/chrome-seo-analyzer.ts https://example.com
  bun run agents/chrome-seo-analyzer.ts https://example.com --keyword "web design"
  bun run agents/chrome-seo-analyzer.ts https://example.com --report my-seo.md
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

const options: SEOAnalyzerOptions = {
  url,
  checkPerformance: !args.includes('--no-performance'),
};

for (let i = 1; i < args.length; i++) {
  switch (args[i]) {
    case '--keyword':
      options.keyword = args[++i];
      break;
    case '--report':
      options.reportFile = args[++i];
      break;
  }
}

analyzeSEO(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
