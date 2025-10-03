#!/usr/bin/env -S bun run

import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface SEOAnalyzerOptions {
  url: string;
  keyword?: string;
  reportFile: string;
  checkPerformance: boolean;
}

function printHelp(): void {
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
  --help, -h              Show this help
  `);
}

function parseOptions(): SEOAnalyzerOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const url = positionals[0];
  if (!url) {
    console.error('❌ Error: URL is required');
    printHelp();
    process.exit(1);
  }

  try {
    new URL(url);
  } catch (error) {
    console.error('❌ Error: Invalid URL');
    process.exit(1);
  }

  const keyword = typeof values.keyword === "string" ? values.keyword : undefined;
  const reportFile = typeof values.report === "string" ? values.report : "seo-analysis.md";
  const checkPerformance = values["no-performance"] !== true;

  return { url, keyword, reportFile, checkPerformance };
}



const options = parseOptions();
if (!options) process.exit(0);

console.log('🔍 Chrome SEO Analyzer\n');
console.log(`URL: ${options.url}`);
if (options.keyword) console.log(`Target Keyword: "${options.keyword}"`);
console.log('');

const prompt = `You are an SEO expert using Chrome DevTools MCP to analyze on-page SEO. Target URL: ${options.url}${options.keyword ? `. Target Keyword: "${options.keyword}"` : ''}. Open page, extract SEO metadata (title, meta tags, headings, images, links, structured data, canonical, Open Graph, etc.), analyze content quality, check mobile-friendliness${options.checkPerformance ? ', run performance trace for Core Web Vitals' : ''}. ${options.keyword ? `Analyze keyword optimization: presence in title, description, H1, content density, image alt text.` : ''} Generate comprehensive SEO report and save to "${options.reportFile}" with scores, issues, warnings, passed checks, and prioritized recommendations.`;

const settings: Settings = {};
const performanceTools = options.checkPerformance
  ? ["mcp__chrome-devtools__performance_start_trace", "mcp__chrome-devtools__performance_stop_trace", "mcp__chrome-devtools__performance_analyze_insight"]
  : [];
const allowedTools = ["mcp__chrome-devtools__navigate_page", "mcp__chrome-devtools__new_page", "mcp__chrome-devtools__take_snapshot", "mcp__chrome-devtools__evaluate_script", "mcp__chrome-devtools__list_network_requests", ...performanceTools, "Write", "TodoWrite"];
const mcpConfig = { mcpServers: { "chrome-devtools": { command: "npx", args: ["chrome-devtools-mcp@latest", "--isolated"] }}};

removeAgentFlags([
    "keyword", "report", "no-performance", "help", "h"
  ]);

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
    console.log('\n✨ SEO analysis complete!');
    console.log(`📄 Report: ${options.reportFile}`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
