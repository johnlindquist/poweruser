#!/usr/bin/env -S bun run

/**
 * Quick JSDoc Generator Agent
 *
 * A lightning-fast micro-agent that generates documentation comments in seconds:
 * - Takes a single function or class as input
 * - Generates proper JSDoc/TSDoc comments
 * - Automatically infers parameter types and return types from TypeScript
 * - Adds @param, @returns, @throws tags with sensible defaults
 * - Respects existing project documentation style
 * - Completes in under 5 seconds for instant productivity boost
 *
 * Usage:
 *   bun run agents/quick-jsdoc-generator.ts <file-path> [function-name] [options]
 *
 * Examples:
 *   # Document a specific function
 *   bun run agents/quick-jsdoc-generator.ts src/utils.ts calculateSum
 *
 *   # Document all exports in a file
 *   bun run agents/quick-jsdoc-generator.ts src/api.ts
 *
 *   # Use JSDoc style with examples
 *   bun run agents/quick-jsdoc-generator.ts src/helpers.ts --style jsdoc --examples
 */

import { resolve } from "node:path";
import { claude, parsedArgs, removeAgentFlags } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type DocStyle = "jsdoc" | "tsdoc";

interface JSDocOptions {
  filePath: string;
  targetName?: string;
  style: DocStyle;
  includeExamples: boolean;
}

const DEFAULT_STYLE: DocStyle = "tsdoc";

function printHelp(): void {
  console.log(`
📝 Quick JSDoc Generator

Generates documentation comments in seconds!

Usage:
  bun run agents/quick-jsdoc-generator.ts <file-path> [function-name] [options]

Arguments:
  file-path              Path to the source file
  function-name          Optional: specific function or class to document

Options:
  --style <type>         Documentation style (jsdoc|tsdoc, default: ${DEFAULT_STYLE})
  --examples             Include @example tags
  --help, -h             Show this help

Examples:
  # Document a specific function
  bun run agents/quick-jsdoc-generator.ts src/utils.ts calculateSum

  # Document all exports in a file
  bun run agents/quick-jsdoc-generator.ts src/api.ts

  # Use JSDoc style with examples
  bun run agents/quick-jsdoc-generator.ts src/helpers.ts --style jsdoc --examples
  `);
}

function parseOptions(): JSDocOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help || positionals.length === 0) {
    printHelp();
    return null;
  }

  const filePath = positionals[0];
  if (!filePath) {
    console.error("❌ Error: File path is required");
    printHelp();
    process.exit(1);
  }

  // Check if second positional is a target name (not a flag)
  const targetName = positionals[1] && !positionals[1].startsWith("--")
    ? positionals[1]
    : undefined;

  const rawStyle = values.style;
  const includeExamples = values.examples === true;

  const style = typeof rawStyle === "string" && rawStyle.length > 0
    ? (rawStyle.toLowerCase() as DocStyle)
    : DEFAULT_STYLE;

  if (style !== "jsdoc" && style !== "tsdoc") {
    console.error("❌ Error: Invalid style. Must be 'jsdoc' or 'tsdoc'");
    process.exit(1);
  }

  return {
    filePath: resolve(filePath),
    targetName,
    style,
    includeExamples,
  };
}

function buildPrompt(options: JSDocOptions): string {
  const { filePath, targetName, style, includeExamples } = options;

  return targetName
    ? `
Generate ${style.toUpperCase()} documentation comments for the function or class named "${targetName}" in the file "${filePath}".

Your task:
1. Read the file and locate the target function/class
2. Analyze its signature, parameters, return type, and implementation
3. Generate a concise but complete documentation comment with:
   - Clear description of what it does
   - @param tags for each parameter with type and description
   - @returns tag with return type and description
   - @throws tag if the function can throw errors
   ${includeExamples ? "- @example tag with a usage example" : ""}
4. Use the Edit tool to insert the documentation comment right before the function/class declaration
5. Preserve existing indentation and code style

Requirements:
- Use ${style === "tsdoc" ? "TSDoc" : "JSDoc"} format
- Keep descriptions concise but informative
- Infer types from TypeScript annotations when available
- If the function already has documentation, enhance it rather than replace it
- Complete this task in ONE edit operation

Do not modify the function/class code itself, only add/update the documentation comment.
`.trim()
    : `
Generate ${style.toUpperCase()} documentation comments for ALL exported functions and classes in the file "${filePath}".

Your task:
1. Read the file and identify all exported functions, methods, and classes
2. For each one, analyze its signature and implementation
3. Generate documentation comments with:
   - Clear description
   - @param tags for parameters
   - @returns tag for return values
   - @throws tag if applicable
   ${includeExamples ? "- @example tag with usage example" : ""}
4. Use the Edit tool to add documentation to each function/class
5. Preserve existing indentation and code style

Requirements:
- Use ${style === "tsdoc" ? "TSDoc" : "JSDoc"} format
- Process functions in order from top to bottom
- Skip functions that already have complete documentation
- Make minimal edits - only add documentation comments

Do not modify any function/class code, only add documentation comments.
`.trim();
}


const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("📝 Quick JSDoc Generator\n");
console.log(`File: ${options.filePath}`);
if (options.targetName) {
  console.log(`Target: ${options.targetName}`);
}
console.log(`Style: ${options.style}`);
console.log(`Examples: ${options.includeExamples ? "Yes" : "No"}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = ["Read", "Edit", "TodoWrite"];

removeAgentFlags(["style", "examples", "help", "h"]);

const defaultFlags: ClaudeFlags = {
  model: "claude-haiku-4-5-20250903",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "acceptEdits",
  "dangerously-skip-permissions": true,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Documentation generated successfully!");
    console.log("\nNext steps:");
    console.log("1. Review the generated documentation");
    console.log("2. Adjust descriptions if needed");
    console.log("3. Commit the changes");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}