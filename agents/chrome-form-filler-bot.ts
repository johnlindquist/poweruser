#!/usr/bin/env -S bun run

import { resolve } from "node:path";
import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface FormFillerOptions {
  url: string;
  dataFile?: string;
  submit: boolean;
}

function printHelp(): void {
  console.log(`
📝 Chrome Form Filler Bot

Usage:
  bun run agents/chrome-form-filler-bot.ts <url> [options]

Arguments:
  url                  URL with form to fill

Options:
  --data <file>        JSON file with form data
  --submit             Submit form after filling
  --help, -h           Show this help
  `);
}

function parseOptions(): FormFillerOptions | null {
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

  const dataFile = typeof values.data === "string" ? resolve(values.data) : undefined;
  const submit = values.submit === true;

  return { url, dataFile, submit };
}



const options = parseOptions();
if (!options) process.exit(0);

console.log('📝 Chrome Form Filler Bot\n');
console.log(`URL: ${options.url}`);
if (options.dataFile) console.log(`Data file: ${options.dataFile}`);
console.log(`Auto-submit: ${options.submit}\n`);

const prompt = `Fill out the form at ${options.url} with realistic test data. Open page, take snapshot, identify all form fields (text inputs, emails, passwords, dates, selects, checkboxes, radios, textareas). ${options.dataFile ? `Use data from ${options.dataFile}.` : 'Generate realistic test data: names (John Doe), emails (test@example.com), phones ((555) 123-4567), addresses, dates, passwords (meeting requirements).'} Use fill_form to fill all fields at once. ${options.submit ? 'After filling, click submit button.' : 'Do not submit, just fill fields.'} Report which fields were filled and with what data.`;

const settings: Settings = {};
const allowedTools = ["mcp__chrome-devtools__navigate_page", "mcp__chrome-devtools__new_page", "mcp__chrome-devtools__take_snapshot", "mcp__chrome-devtools__fill", "mcp__chrome-devtools__fill_form", "mcp__chrome-devtools__click", "mcp__chrome-devtools__evaluate_script", ...(options.dataFile ? ["Read"] : []), "TodoWrite"];
const mcpConfig = { mcpServers: { "chrome-devtools": { command: "npx", args: ["chrome-devtools-mcp@latest", "--isolated"] }}};

removeAgentFlags([
    "data", "submit", "help", "h"
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
    console.log('\n✨ Form filling complete!');
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
