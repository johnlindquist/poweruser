#!/usr/bin/env -S bun run

/**
 * Flaky Test Fixer Agent
 *
 * Eliminates the nightmare of unreliable tests by:
 * - Running your test suite multiple times to identify flaky tests
 * - Analyzing failure patterns (timing issues, race conditions, environment dependencies)
 * - Pinpointing root causes (improper async handling, shared state, network calls)
 * - Suggesting specific fixes with code examples
 * - Generating a report with reliability metrics
 *
 * Usage:
 *   bun run agents/flaky-test-fixer.ts [test-command] [options]
 *
 * Examples:
 *   bun run agents/flaky-test-fixer.ts "npm test"
 *   bun run agents/flaky-test-fixer.ts "bun test" --runs 10
 *   bun run agents/flaky-test-fixer.ts "npm test" --runs 5 --auto-fix
 */

import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface FlakyTestOptions {
  testCommand: string;
  numRuns: number;
  autoFix: boolean;
}

const DEFAULT_TEST_COMMAND = 'npm test';
const DEFAULT_RUNS = 5;

function printHelp(): void {
  console.log(`
🔬 Flaky Test Fixer

Usage:
  bun run agents/flaky-test-fixer.ts [test-command] [options]

Arguments:
  test-command            Test command to run (default: ${DEFAULT_TEST_COMMAND})

Options:
  --runs <number>         Number of times to run tests (default: ${DEFAULT_RUNS})
  --auto-fix              Automatically apply safe fixes to test files
  --help, -h              Show this help

Examples:
  bun run agents/flaky-test-fixer.ts "npm test"
  bun run agents/flaky-test-fixer.ts "bun test" --runs 10
  bun run agents/flaky-test-fixer.ts "npm test" --runs 5 --auto-fix
  `);
}

function parseOptions(): FlakyTestOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const testCommand = positionals[0] || DEFAULT_TEST_COMMAND;

  const rawRuns = values.runs;
  const numRuns = typeof rawRuns === 'string' && rawRuns.length > 0
    ? parseInt(rawRuns, 10)
    : DEFAULT_RUNS;

  if (isNaN(numRuns) || numRuns < 1) {
    console.error("❌ Error: Invalid number of runs. Must be a positive integer.");
    process.exit(1);
  }

  const autoFix = values["auto-fix"] === true || values.autoFix === true;

  return {
    testCommand,
    numRuns,
    autoFix,
  };
}

function buildPrompt(options: FlakyTestOptions): string {
  const { testCommand, numRuns, autoFix } = options;

  return `You are a Flaky Test Fixer agent. Your goal is to identify and fix flaky tests in this codebase.

**Task Breakdown:**

1. **Identify the test framework and files:**
   - Search for test files (look for *.test.*, *.spec.*, __tests__ directories)
   - Identify the testing framework (Jest, Vitest, Mocha, Playwright, etc.)
   - List all test files found

2. **Run the test suite multiple times:**
   - Execute the test command: ${testCommand}
   - Run it ${numRuns} times to identify flaky tests
   - Capture all test outputs and identify tests that fail inconsistently
   - Track which tests pass/fail on each run

3. **Analyze flaky tests:**
   - For each flaky test identified, read the test file
   - Look for common flakiness causes:
     * Timing issues (setTimeout, hardcoded delays)
     * Race conditions (async/await issues, missing waits)
     * Shared state (global variables, singleton instances)
     * Network calls (external API dependencies)
     * Random data (Math.random, Date.now without mocking)
     * DOM/environment dependencies (browser-specific code)
   - Search for related code that the test depends on

4. **Generate fixes:**
   - For each flaky test, suggest specific fixes:
     * Replace setTimeout with proper waitFor/waitUntil patterns
     * Add proper async/await handling
     * Mock external dependencies (fetch, Date, Math.random)
     * Use test fixtures and proper setup/teardown
     * Add retry logic for legitimate eventually-consistent scenarios
   - Provide code examples for the fixes

5. **Create a detailed report:**
   - Summary of test runs (X runs, Y flaky tests found)
   - List of flaky tests with failure rates
   - Root cause analysis for each flaky test
   - Suggested fixes with code examples
   - Reliability improvement recommendations

**Important Guidelines:**
- Focus on actionable, specific fixes
- Provide code snippets that can be directly applied
- Prioritize fixes by impact (most flaky tests first)
- Explain WHY each test is flaky, not just HOW to fix it
- If a test is flaky due to the code under test (not the test itself), note that
${autoFix ? `
**Auto-fix enabled:** Attempt to fix issues by:
- Using Edit tool to fix obvious timing/async issues
- Adding proper waitFor/waitUntil patterns
- Mocking external dependencies
- Only make changes to obvious, safe fixes
- Report all changes made
` : ""}
Generate a comprehensive report and suggest fixes.${autoFix ? " Apply automated fixes where safe." : ""}`.trim();
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🔬 Flaky Test Fixer\n");
console.log(`Test command: ${options.testCommand}`);
console.log(`Number of runs: ${options.numRuns}`);
console.log(`Auto-fix: ${options.autoFix ? "Enabled" : "Disabled"}`);
console.log(`Working directory: ${process.cwd()}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Bash",
  "Grep",
  "Glob",
  "Read",
  ...(options.autoFix ? ["Edit"] : []),
  "TodoWrite",
];

removeAgentFlags([
    "runs", "auto-fix", "autoFix", "help", "h"
  ]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": options.autoFix ? "acceptEdits" : "default",
  ...(options.autoFix ? { 'dangerously-skip-permissions': true } : {}),
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Flaky test analysis complete!\n");
    if (options.autoFix) {
      console.log("🔧 Auto-fixes applied - review before committing");
    }
    console.log("\nNext steps:");
    console.log("1. Review the analysis and suggested fixes");
    console.log("2. Apply recommended changes");
    console.log("3. Re-run tests to verify fixes");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
