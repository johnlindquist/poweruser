#!/usr/bin/env -S bun run

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface UserFlowOptions {
  url: string;
  flow: string;
  outputFile: string;
  framework: string;
}

function printHelp(): void {
  console.log(`
🎬 Chrome User Flow Recorder

Usage:
  bun run agents/chrome-user-flow-recorder.ts <url> <flow-description> [options]

Arguments:
  url                     Starting URL
  flow-description        Description of user flow to record

Options:
  --output <file>         Output test file (default: user-flow-test.spec.ts)
  --framework <name>      Test framework: playwright|cypress (default: playwright)
  --help, -h              Show this help
  `);
}

function parseOptions(): UserFlowOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const url = positionals[0];
  const flow = positionals[1];

  if (!url || !flow) {
    console.error('❌ Error: URL and flow description are required');
    printHelp();
    process.exit(1);
  }

  try {
    new URL(url);
  } catch (error) {
    console.error('❌ Error: Invalid URL');
    process.exit(1);
  }

  const outputFile = typeof values.output === "string" ? values.output : "user-flow-test.spec.ts";
  const framework = typeof values.framework === "string" ? values.framework : "playwright";

  if (framework !== "playwright" && framework !== "cypress") {
    console.error('❌ Error: Framework must be playwright or cypress');
    process.exit(1);
  }

  return { url, flow, outputFile, framework };
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["output", "framework", "help", "h"] as const;
  for (const key of agentKeys) {
    if (key in values) delete values[key];
  }
}

const options = parseOptions();
if (!options) process.exit(0);

console.log('🎬 Chrome User Flow Recorder\n');
console.log(`URL: ${options.url}`);
console.log(`Flow: ${options.flow}`);
console.log(`Framework: ${options.framework}\n`);

const prompt = `You are a test automation expert recording a user flow. Target URL: ${options.url}. Flow: "${options.flow}". Target Framework: ${options.framework}. Open URL, take snapshot, identify interactive elements, follow the flow description, record each action (click, type, navigate) with stable selectors. Generate ${options.framework} test code and save to "${options.outputFile}" with proper assertions.`;

const settings: Settings = {};
const allowedTools = ["mcp__chrome-devtools__navigate_page", "mcp__chrome-devtools__new_page", "mcp__chrome-devtools__take_snapshot", "mcp__chrome-devtools__click", "mcp__chrome-devtools__fill", "mcp__chrome-devtools__evaluate_script", "Write", "TodoWrite"];
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
    console.log('\n✨ User flow recorded!');
    console.log(`📄 Test: ${options.outputFile}`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
