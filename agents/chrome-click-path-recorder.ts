#!/usr/bin/env -S bun run

import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type OutputFormat = 'markdown' | 'json';

interface ClickRecorderOptions {
  url: string;
  outputFile: string;
  format: OutputFormat;
}

function printHelp(): void {
  console.log(`
🖱️  Chrome Click Path Recorder

Usage:
  bun run agents/chrome-click-path-recorder.ts <url> [options]

Arguments:
  url                  URL to record

Options:
  --output <file>      Output file (default: click-path.md or click-path.json)
  --format <type>      Output format: markdown, json (default: markdown)
  --help, -h           Show this help
  `);
}

function parseOptions(): ClickRecorderOptions | null {
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

  const format = (typeof values.format === "string" ? values.format : "markdown") as OutputFormat;
  const outputFile = typeof values.output === "string" ? values.output : `click-path.${format === 'json' ? 'json' : 'md'}`;

  return { url, outputFile, format };
}



const options = parseOptions();
if (!options) process.exit(0);

console.log('🖱️  Chrome Click Path Recorder\n');
console.log(`URL: ${options.url}`);
console.log(`Output: ${options.outputFile}`);
console.log(`Format: ${options.format}\n`);

const prompt = `Record user interaction click path on ${options.url}. Open page, take initial snapshot. Set up JavaScript event listeners using evaluate_script to track: all click events with element details (tag, id, class, text content, xpath), timestamps, page navigation events, form submissions. Let page run for 30 seconds to capture interactions (or use wait_for). Collect all click events. Generate ${options.outputFile} with: chronological list of clicks, element identifiers, screenshots at each step, visual flow diagram. Format as ${options.format === 'json' ? 'structured JSON' : 'markdown with emojis and clear steps'}.`;

const settings: Settings = {};
const allowedTools = ["mcp__chrome-devtools__navigate_page", "mcp__chrome-devtools__new_page", "mcp__chrome-devtools__take_snapshot", "mcp__chrome-devtools__evaluate_script", "mcp__chrome-devtools__wait_for", "mcp__chrome-devtools__take_screenshot", "Write", "TodoWrite"];
const mcpConfig = { mcpServers: { "chrome-devtools": { command: "npx", args: ["chrome-devtools-mcp@latest", "--isolated"] }}};

removeAgentFlags([
    "output", "format", "help", "h"
  ]);

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
    console.log(`\n✨ Click path recording complete!`);
    console.log(`📄 Output: ${options.outputFile}`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
