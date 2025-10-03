#!/usr/bin/env -S bun run

import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface PDFGeneratorOptions {
  urls: string[];
  outputFile: string;
}

function printHelp(): void {
  console.log(`
📄 Chrome Multi-Page PDF Generator

Usage:
  bun run agents/chrome-multi-page-pdf-generator.ts <url1> <url2> [...] [options]

Arguments:
  urls                 One or more URLs to include in PDF

Options:
  --output <file>      Output PDF file (default: combined-pages.pdf)
  --help, -h           Show this help
  `);
}

function parseOptions(): PDFGeneratorOptions | null {
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

  const outputFile = typeof values.output === "string" ? values.output : "combined-pages.pdf";
  return { urls: positionals, outputFile };
}



const options = parseOptions();
if (!options) process.exit(0);

console.log('📄 Chrome Multi-Page PDF Generator\n');
console.log(`Pages: ${options.urls.length}`);
console.log(`Output: ${options.outputFile}\n`);

const prompt = `Generate a combined PDF from these URLs: ${options.urls.join(', ')}. For each URL: open page, wait for page load (wait for network idle and DOM content loaded), take full-page screenshot. After collecting all screenshots, use JavaScript or Bash tools to combine screenshots into single PDF file: ${options.outputFile}. Each URL should be a separate page in the PDF. Include page numbers and URL labels. Report total pages and file size.`;

const settings: Settings = {};
const allowedTools = ["mcp__chrome-devtools__navigate_page", "mcp__chrome-devtools__new_page", "mcp__chrome-devtools__take_screenshot", "mcp__chrome-devtools__wait_for", "mcp__chrome-devtools__close_page", "Bash", "TodoWrite"];
const mcpConfig = { mcpServers: { "chrome-devtools": { command: "npx", args: ["chrome-devtools-mcp@latest", "--isolated"] }}};

removeAgentFlags([
    "output", "help", "h"
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
    console.log('\n✨ Multi-page PDF generation complete!');
    console.log(`📄 PDF: ${options.outputFile}`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
