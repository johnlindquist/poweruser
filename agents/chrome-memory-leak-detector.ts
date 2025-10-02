#!/usr/bin/env -S bun run

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface MemoryLeakOptions {
  url: string;
  duration: number;
  reportFile: string;
}

function printHelp(): void {
  console.log(`
🧠 Chrome Memory Leak Detector

Usage:
  bun run agents/chrome-memory-leak-detector.ts <url> [options]

Arguments:
  url                  URL to monitor

Options:
  --duration <sec>     Monitoring duration in seconds (default: 30)
  --report <file>      Report output file (default: memory-leak-report.md)
  --help, -h           Show this help
  `);
}

function parseOptions(): MemoryLeakOptions | null {
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

  const duration = typeof values.duration === "string" ? parseInt(values.duration) : 30;
  const reportFile = typeof values.report === "string" ? values.report : "memory-leak-report.md";

  return { url, duration, reportFile };
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["duration", "report", "help", "h"] as const;
  for (const key of agentKeys) {
    if (key in values) delete values[key];
  }
}

const options = parseOptions();
if (!options) process.exit(0);

console.log('🧠 Chrome Memory Leak Detector\n');
console.log(`URL: ${options.url}`);
console.log(`Duration: ${options.duration}s`);
console.log(`Report: ${options.reportFile}\n`);

const prompt = `Monitor ${options.url} for memory leaks over ${options.duration} seconds. Open page, use JavaScript to monitor memory over time: check performance.memory, count detached DOM nodes, identify event listeners not cleaned up. Interact with page (open/close modals, navigate). Take multiple memory snapshots. Generate "${options.reportFile}" identifying: memory growth patterns, detached nodes, event listener leaks, potential closure leaks, and fixes.`;

const settings: Settings = {};
const allowedTools = ["mcp__chrome-devtools__navigate_page", "mcp__chrome-devtools__new_page", "mcp__chrome-devtools__evaluate_script", "mcp__chrome-devtools__click", "mcp__chrome-devtools__wait_for", "Write", "TodoWrite"];
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
    console.log('\n✅ Memory leak detection complete!');
    console.log(`📄 Report: ${options.reportFile}`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
