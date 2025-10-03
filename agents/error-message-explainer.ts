#!/usr/bin/env -S bun run

/**
 * Error Message Explainer Agent
 *
 * A tiny quick agent that translates cryptic errors into actionable fixes.
 * Runs in under 3 seconds.
 *
 * Usage:
 *   bun run agents/error-message-explainer.ts "your error message here"
 *
 * Examples:
 *   # Explain a JavaScript error
 *   bun run agents/error-message-explainer.ts "TypeError: Cannot read property 'foo' of undefined"
 *
 *   # Explain a build error
 *   bun run agents/error-message-explainer.ts "Module not found: Error: Can't resolve 'react'"
 *
 *   # Explain a TypeScript error
 *   bun run agents/error-message-explainer.ts "TS2322: Type 'string' is not assignable to type 'number'"
 */

import { claude, parsedArgs, removeAgentFlags } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface ErrorExplainerOptions {
  errorMessage: string;
}

function printHelp(): void {
  console.log(`
🔍 Error Message Explainer

Usage:
  bun run agents/error-message-explainer.ts <error-message> [options]

Arguments:
  error-message           Error message to explain (wrap in quotes if multiple words)

Options:
  --help, -h              Show this help

Examples:
  bun run agents/error-message-explainer.ts "TypeError: Cannot read property 'foo' of undefined"
  bun run agents/error-message-explainer.ts "Module not found: Error: Can't resolve 'react'"
  bun run agents/error-message-explainer.ts "TS2322: Type 'string' is not assignable to type 'number'"
  `);
}

function parseOptions(): ErrorExplainerOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const errorMessage = positionals.join(" ");
  if (!errorMessage) {
    console.error("❌ Error: Error message is required");
    printHelp();
    process.exit(1);
  }

  return { errorMessage };
}

function buildPrompt(options: ErrorExplainerOptions): string {
  const { errorMessage } = options;

  return `You are an expert debugging assistant. Analyze this error message and help fix it quickly.

ERROR MESSAGE:
${errorMessage}

Your task:
1. Search the codebase for where this error might be occurring using Grep
2. Read relevant files to understand the context
3. Explain the error in plain English (what went wrong, why, what it means)
4. Provide 2-3 specific fix suggestions ranked by likelihood of success
5. Show relevant code snippets with file:line references

Be concise and actionable. This should take under 3 seconds.

IMPORTANT RULES:
- Use Grep to search for error-related patterns (function names, error types, stack trace elements)
- Read only the most relevant files (max 3)
- Focus on the most likely cause first
- Provide specific line numbers and file paths
- Give concrete fix examples, not just general advice
- If this is a common framework error, mention it and link to relevant docs`;
}


const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🔍 Error Message Explainer\n");
console.log(`Analyzing: ${options.errorMessage}\n`);

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Grep",
  "Read",
  "TodoWrite",
];

removeAgentFlags(["help", "h"]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✅ Analysis complete!");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
