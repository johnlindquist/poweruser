#!/usr/bin/env -S bun run

/**
 * Link Rot Detector Agent
 *
 * This agent uses Chrome DevTools MCP to find broken links and dead resources:
 * - Blazingly fast crawl of your entire site
 * - Checks for 404 errors, broken anchor links, redirect chains
 * - Identifies slow-loading external resources
 * - Detects mixed content warnings (HTTP on HTTPS)
 * - Validates that all image sources exist and load correctly
 * - Lists suspicious links: shortened URLs, expired domains
 * - Generates markdown report with file:line references
 * - Can run as pre-deployment check in CI/CD
 *
 * Usage:
 *   bun run agents/link-rot-detector.ts <url> [options]
 *
 * Examples:
 *   # Check all links on a page
 *   bun run agents/link-rot-detector.ts https://example.com
 *
 *   # Deep crawl (follow internal links)
 *   bun run agents/link-rot-detector.ts https://example.com --depth 2
 *
 *   # Generate report
 *   bun run agents/link-rot-detector.ts https://example.com --report links.md
 */

import { claude, parsedArgs, removeAgentFlags } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface LinkRotOptions {
  url: string;
  depth: number;
  reportFile: string;
  checkImages: boolean;
  checkExternal: boolean;
}

const DEFAULT_DEPTH = 1;
const DEFAULT_REPORT_FILE = "link-rot-report.md";

function printHelp(): void {
  console.log(`
🔗 Link Rot Detector

Usage:
  bun run agents/link-rot-detector.ts <url> [options]

Arguments:
  url                     Website URL to scan

Options:
  --depth <number>        Crawl depth for internal links (default: ${DEFAULT_DEPTH})
  --report <file>         Output file (default: ${DEFAULT_REPORT_FILE})
  --no-images             Skip image validation
  --no-external           Skip external link checking
  --help, -h              Show this help

Examples:
  bun run agents/link-rot-detector.ts https://example.com
  bun run agents/link-rot-detector.ts https://example.com --depth 2
  bun run agents/link-rot-detector.ts https://example.com --no-external
  bun run agents/link-rot-detector.ts https://example.com --report my-links.md

Issues Detected:
  - 404 broken links
  - Broken anchor links
  - Redirect chains
  - Slow-loading resources
  - Mixed content (HTTP on HTTPS)
  - Broken images
  - Expired domains
  - Shortened URLs
  `);
}

function parseOptions(): LinkRotOptions | null {
  const { values, positionals } = parsedArgs;
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

  const rawDepth = values.depth;
  const rawReport = values.report;
  const checkImages = values["no-images"] !== true;
  const checkExternal = values["no-external"] !== true;

  const depth = typeof rawDepth === "string" && rawDepth.length > 0
    ? parseInt(rawDepth, 10)
    : DEFAULT_DEPTH;

  const reportFile = typeof rawReport === "string" && rawReport.length > 0
    ? rawReport
    : DEFAULT_REPORT_FILE;

  if (isNaN(depth) || depth < 1) {
    console.error("❌ Error: Depth must be a positive number");
    process.exit(1);
  }

  return {
    url,
    depth,
    reportFile,
    checkImages,
    checkExternal,
  };
}

function buildPrompt(options: LinkRotOptions): string {
  const { url, depth, reportFile, checkImages, checkExternal } = options;

  return `
You are a link integrity specialist using Chrome DevTools MCP to find broken links and dead resources.

Target URL: ${url}
Crawl Depth: ${depth} level(s)
Check Images: ${checkImages}
Check External Links: ${checkExternal}

Your tasks:
1. Open the URL in Chrome using Chrome DevTools MCP
2. Take a snapshot of the page
3. Extract all links and resources using JavaScript:
   \`\`\`javascript
   () => {
     const results = {
       internalLinks: [],
       externalLinks: [],
       images: [],
       anchors: [],
       scripts: [],
       stylesheets: []
     };

     // Get base URL
     const baseUrl = window.location.origin;

     // Extract links
     document.querySelectorAll('a[href]').forEach((link, index) => {
       const href = link.href;
       const text = link.textContent?.trim() || '(no text)';

       // Check for anchor links
       if (href.includes('#')) {
         const anchor = href.split('#')[1];
         if (anchor) {
           const targetExists = document.getElementById(anchor) !== null;
           results.anchors.push({
             href,
             anchor,
             exists: targetExists,
             text,
             ref: 'link_' + index
           });
         }
       }

       // Categorize links
       if (href.startsWith(baseUrl)) {
         results.internalLinks.push({ href, text, ref: 'link_' + index });
       } else if (href.startsWith('http')) {
         results.externalLinks.push({ href, text, ref: 'link_' + index });
       }
     });

     // Extract images
     document.querySelectorAll('img[src]').forEach((img, index) => {
       results.images.push({
         src: img.src,
         alt: img.alt || '(no alt)',
         ref: 'img_' + index
       });
     });

     // Extract scripts
     document.querySelectorAll('script[src]').forEach((script, index) => {
       results.scripts.push({
         src: script.src,
         ref: 'script_' + index
       });
     });

     // Extract stylesheets
     document.querySelectorAll('link[rel="stylesheet"]').forEach((link, index) => {
       results.stylesheets.push({
         href: link.href,
         ref: 'style_' + index
       });
     });

     return {
       baseUrl,
       totalLinks: results.internalLinks.length + results.externalLinks.length,
       ...results
     };
   }
   \`\`\`

4. Check network requests for each resource:
   - Use list_network_requests to see all loaded resources
   - Filter by resource type: document, image, script, stylesheet
   - Identify failed requests (status 404, 500, etc.)
   - Note slow-loading resources (> 3 seconds)
   - Detect redirect chains (multiple 301/302)
   - Check for mixed content (HTTP on HTTPS page)

5. Test internal links:
   ${depth > 1 ? `- Navigate to each internal link up to depth ${depth}` : ''}
   - Check if pages load successfully
   - Verify no 404 or 500 errors
   - Note redirect chains

6. Test anchor links:
   - Verify target element exists on page
   - Check if anchor scrolls correctly

${checkImages ? `
7. Validate images:
   - Check all image sources load successfully
   - Identify broken image links (404)
   - Note images without alt text (accessibility issue)
   - Check for overly large images (> 1MB)
` : ''}

${checkExternal ? `
8. Check external links:
   - Navigate to external links
   - Check for 404 errors
   - Identify redirect chains
   - Flag suspicious domains (bit.ly, tinyurl, etc.)
   - Note slow-loading external resources
   - Check for expired domains
` : ''}

9. Analyze findings and categorize:
   - Critical: Broken internal links, 404s, dead images
   - High: Redirect chains, slow resources, broken anchors
   - Medium: Mixed content warnings, large images
   - Low: Missing alt text, shortened URLs

Generate a comprehensive link integrity report and save to "${reportFile}" with:

## Link Rot Report
**Site**: ${url}
**Scan Date**: [timestamp]
**Total Links Checked**: [count]

## Summary
- ✅ Valid Links: [count]
- ❌ Broken Links: [count]
- ⚠️  Redirects: [count]
- 🐌 Slow Resources: [count]
- 🔒 Mixed Content: [count]

## Critical Issues (Fix Immediately)
### Broken Links (404)
1. [URL]
   - Found on: [page URL]
   - Link text: "[text]"
   - Status: 404 Not Found

### Broken Images
1. [Image URL]
   - Found on: [page URL]
   - Alt text: "[alt]"

## High Priority Issues
### Redirect Chains
1. [URL]
   - Redirects: [URL1] → [URL2] → [final URL]
   - Total redirects: [count]
   - Fix: Update link to final destination

### Broken Anchors
1. [Anchor link]
   - Target: #[anchor]
   - Issue: Element does not exist
   - Page: [URL]

## Medium Priority Issues
### Slow-Loading Resources
1. [Resource URL]
   - Load time: [time]s
   - Type: [script/image/stylesheet]
   - Recommendation: Optimize or use CDN

### Mixed Content Warnings
1. [HTTP resource on HTTPS page]
   - Fix: Update to HTTPS

## Low Priority Issues
### Suspicious Links
1. [Shortened URL]
   - Type: URL shortener
   - Recommendation: Use direct links

${checkExternal ? `
## External Links Status
- Total: [count]
- Valid: [count]
- Broken: [count]
- Redirects: [count]
` : ''}

## Recommendations
1. Fix all 404 errors immediately
2. Update redirected links to final destinations
3. Replace broken images
4. Fix broken anchor links
5. Update HTTP resources to HTTPS
6. Consider adding automated link checking to CI/CD

## Next Steps
1. Review and fix critical issues
2. Update internal links
3. Contact external site owners for broken links
4. Re-run detector after fixes
`.trim();
}


const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🔗 Link Rot Detector\n");
console.log(`URL: ${options.url}`);
console.log(`Crawl Depth: ${options.depth}`);
if (options.checkImages) console.log("Image Check: Enabled");
if (options.checkExternal) console.log("External Links: Enabled");
console.log(`Report: ${options.reportFile}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "mcp__chrome-devtools__navigate_page",
  "mcp__chrome-devtools__new_page",
  "mcp__chrome-devtools__take_snapshot",
  "mcp__chrome-devtools__evaluate_script",
  "mcp__chrome-devtools__list_network_requests",
  "mcp__chrome-devtools__get_network_request",
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

removeAgentFlags(["depth", "report", "no-images", "no-external", "help", "h"]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  'mcp-config': JSON.stringify(mcpConfig),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
  'strict-mcp-config': true,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Link rot detection complete!\n");
    console.log(`📄 Full report: ${options.reportFile}`);
    console.log("\nNext steps:");
    console.log("1. Fix broken links (404s)");
    console.log("2. Update redirected links");
    console.log("3. Replace broken images");
    console.log("4. Re-run detector to verify");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
