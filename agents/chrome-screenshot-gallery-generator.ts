#!/usr/bin/env -S bun run

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface GalleryOptions {
  urls: string[];
  outputDir: string;
}

function printHelp(): void {
  console.log(`
📸 Chrome Screenshot Gallery Generator

Usage:
  bun run agents/chrome-screenshot-gallery-generator.ts <url1> <url2> [...] [options]

Arguments:
  urls                 One or more URLs to screenshot

Options:
  --output <dir>       Output directory (default: ./screenshots)
  --help, -h           Show this help
  `);
}

function parseOptions(): GalleryOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  if (positionals.length === 0) {
    console.error('❌ Error: At least one URL is required');
    printHelp();
    process.exit(1);
  }

  const outputDir = typeof values.output === "string" ? values.output : "./screenshots";
  return { urls: positionals, outputDir };
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["output", "help", "h"] as const;
  for (const key of agentKeys) {
    if (key in values) delete values[key];
  }
}

const options = parseOptions();
if (!options) process.exit(0);

console.log('📸 Chrome Screenshot Gallery Generator\n');
console.log(`Pages: ${options.urls.length}`);
console.log(`Output: ${options.outputDir}\n`);

const prompt = `Generate screenshot gallery for these URLs: ${options.urls.join(', ')}. For each URL: open page, wait for load, take full-page screenshot saved to ${options.outputDir}/[sanitized-url].png. After all screenshots: generate ${options.outputDir}/index.html gallery page showing all screenshots in a grid with URL labels and links. Make gallery responsive and visually appealing with CSS.`;

const settings: Settings = {};
const allowedTools = ["mcp__chrome-devtools__navigate_page", "mcp__chrome-devtools__new_page", "mcp__chrome-devtools__take_screenshot", "mcp__chrome-devtools__wait_for", "Write", "Bash", "TodoWrite"];
const mcpConfig = { mcpServers: { "chrome-devtools": { command: "npx", args: ["chrome-devtools-mcp@latest", "--isolated"] }}};

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  "mcp-config": JSON.stringify(mcpConfig),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "acceptEdits",
  "strict-mcp-config": true,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log('\n✨ Gallery generation complete!');
    console.log(`📄 Gallery: ${options.outputDir}/index.html`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
