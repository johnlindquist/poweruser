#!/usr/bin/env -S bun run

/**
 * Stack Overflow Helper Agent
 *
 * An outside-the-box agent that turns error messages into solutions:
 * - Analyzes error messages and stack traces from your logs, terminal output, or error tracking systems
 * - Searches Stack Overflow for similar issues with the same error patterns and stack traces
 * - Ranks solutions by relevance, votes, and recency to find the most reliable fixes
 * - Adapts Stack Overflow solutions to your specific codebase context (language version, framework, dependencies)
 * - Generates step-by-step fix instructions with code examples tailored to your project structure
 * - Explains why the error occurred and how the solution prevents it from happening again
 * - Creates a troubleshooting report with multiple solution approaches ranked by likely success
 * - Perfect for developers who spend hours googling errors - this does it intelligently in seconds
 *
 * Usage:
 *   bun run agents/stack-overflow-helper.ts <error> [options]
 *
 * Examples:
 *   # Direct error message
 *   bun run agents/stack-overflow-helper.ts "TypeError: Cannot read property 'map' of undefined"
 *
 *   # From a log file
 *   bun run agents/stack-overflow-helper.ts path/to/error.log
 *
 *   # Custom output file
 *   bun run agents/stack-overflow-helper.ts "Error message" --output solution.md
 */

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

const DEFAULT_OUTPUT_FILE = "ERROR_SOLUTION.md";

interface StackOverflowHelperOptions {
  errorInput: string;
  outputFile: string;
}

function printHelp(): void {
  console.log(`
🔍 Stack Overflow Helper

Usage:
  bun run agents/stack-overflow-helper.ts <error> [options]

Arguments:
  error                   Error message or path to log file

Options:
  --output <file>         Output file (default: ${DEFAULT_OUTPUT_FILE})
  --help, -h              Show this help

Examples:
  bun run agents/stack-overflow-helper.ts "TypeError: Cannot read property 'map' of undefined"
  bun run agents/stack-overflow-helper.ts path/to/error.log
  bun run agents/stack-overflow-helper.ts "Error message" --output solution.md
  `);
}

function parseOptions(): StackOverflowHelperOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const errorInput = positionals[0];
  if (!errorInput) {
    console.error("❌ Error: Please provide an error message or log file path");
    printHelp();
    process.exit(1);
  }

  const rawOutput = values.output;
  const outputFile = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : DEFAULT_OUTPUT_FILE;

  return {
    errorInput,
    outputFile,
  };
}

function buildPrompt(options: StackOverflowHelperOptions): string {
  const { errorInput, outputFile } = options;

  return `Debug this error and find solutions from Stack Overflow: ${errorInput}

1. First, check if the input is a file path or direct error message:
   - If it's a file path, read the file to get the full error log
   - If it's a direct error message, use it as-is

2. Analyze the error to understand what we're dealing with:
   - Extract the error type (TypeError, SyntaxError, etc.)
   - Identify the programming language from stack trace patterns
   - Parse stack trace for file paths and line numbers
   - Understand the error context

3. Understand the project context:
   - Check for package.json, requirements.txt, go.mod, Cargo.toml, etc.
   - Read dependency files to understand framework and version
   - Look at the relevant source files from the stack trace
   - Understand the project structure and patterns

4. Search Stack Overflow for solutions:
   - Use WebSearch with targeted queries combining error type and context
   - Search for: "[language] [framework] [error-type] [key-error-phrase]"
   - Look for questions with accepted answers and high votes
   - Find 3-5 different solution approaches

5. Analyze and adapt solutions:
   - Rank solutions by relevance to this specific error
   - Check if solutions match the project's framework versions
   - Adapt code examples to match the project's coding style
   - Verify solutions are compatible with the dependencies

6. Generate a markdown report saved as '${outputFile}' with:

   # Error Solution Report

   ## 🐛 Error Analysis
   **Error Type:** [TypeError/SyntaxError/etc.]
   **Message:** [Full error message]
   **Location:** [file:line from stack trace]

   ### What This Error Means
   [Explain the error in plain English]

   ### Why It Occurred
   [Explain the root cause]

   ## ✅ Recommended Solutions

   ### Solution 1: [Approach Name] (Recommended)
   **Confidence:** High/Medium/Low
   **Based on:** [Stack Overflow link]
   **Votes:** [Number of upvotes]

   #### Why This Works
   [Explanation]

   #### Implementation Steps
   1. [Step-by-step instructions]
   2. [With code examples adapted to this project]

   #### Code Changes
   \`\`\`[language]
   // Before (problematic code)
   [code from project]

   // After (fixed code)
   [adapted solution]
   \`\`\`

   ### Solution 2: [Alternative Approach]
   [Same format as Solution 1]

   ### Solution 3: [Another Alternative]
   [Same format]

   ## 🛡️ Prevention
   - [Tip 1 to avoid this error in the future]
   - [Tip 2]
   - [Tip 3]

   ## 📚 Related Resources
   - [Stack Overflow link 1]
   - [Stack Overflow link 2]
   - [Official documentation if relevant]

Start by analyzing the error, then search Stack Overflow, and generate the comprehensive solution report.`;
}

function buildSystemPrompt(): string {
  return `You are a Stack Overflow Helper agent that intelligently debugs errors by finding and adapting solutions from Stack Overflow.

Your task is to:
1. Analyze the error message and stack trace provided:
   - Extract the core error type and message
   - Identify the programming language/framework from stack trace patterns
   - Parse file paths, line numbers, and function names
   - Understand the error context and likely causes

2. Understand the project context:
   - Scan package.json/requirements.txt/go.mod to identify dependencies and versions
   - Look at the relevant source files mentioned in the stack trace
   - Identify the framework being used (React, Vue, Express, Django, etc.)
   - Note any configuration files that might be relevant

3. Search Stack Overflow for similar errors:
   - Use WebSearch to find Stack Overflow questions with similar error messages
   - Focus on questions with accepted answers or high vote counts
   - Look for solutions that match the project's language/framework versions
   - Find multiple solution approaches (not just one)

4. Analyze and rank solutions:
   - Evaluate each solution's relevance to the specific error
   - Consider solution recency (newer solutions for newer framework versions)
   - Check if the solution applies to the project's dependencies
   - Rank by: relevance score > votes > recency

5. Generate a comprehensive troubleshooting report with:
   - Error analysis: What the error means and why it occurred
   - Root cause: The likely source of the problem
   - Multiple solution approaches ranked by likelihood of success
   - Code examples adapted to the project's structure and patterns
   - Step-by-step fix instructions
   - Prevention tips to avoid this error in the future
   - Links to relevant Stack Overflow answers for reference

Use WebSearch to find Stack Overflow solutions, Read to understand the codebase context, and Write to generate the solution report.

IMPORTANT:
- Adapt generic Stack Overflow solutions to the specific project context
- Consider framework versions and dependencies when suggesting fixes
- Provide multiple solution approaches (sometimes the top answer isn't the right one)
- Explain WHY the error occurred, not just HOW to fix it
- Include prevention strategies to avoid similar errors`;
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["output", "help", "h"] as const;

  for (const key of agentKeys) {
    if (key in values) {
      delete values[key];
    }
  }
}

const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🔍 Stack Overflow Helper\n");
console.log(`🐛 Analyzing error: ${options.errorInput.substring(0, 100)}${options.errorInput.length > 100 ? '...' : ''}`);
console.log(`📄 Output file: ${options.outputFile}`);
console.log("");

const prompt = buildPrompt(options);
const systemPrompt = buildSystemPrompt();
const settings: Settings = {};

const allowedTools = [
  "Read",
  "Glob",
  "Grep",
  "WebSearch",
  "Bash",
  "Write",
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  "append-system-prompt": systemPrompt,
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✅ Solution found!\n");
    console.log(`📄 Solution report saved to: ${options.outputFile}`);
    console.log("💡 Review the report for multiple solution approaches ranked by likelihood of success");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
