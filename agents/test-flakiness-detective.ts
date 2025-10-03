#!/usr/bin/env -S bun run

// Test Flakiness Detective
//
// A practical agent that hunts down and helps fix unreliable tests.
// Analyzes test output history to identify patterns of flaky tests and suggests fixes.
//
// Usage:
//   bun run agents/test-flakiness-detective.ts [test-file-pattern] [options]
//
// Examples:
//   bun run agents/test-flakiness-detective.ts
//   bun run agents/test-flakiness-detective.ts "src/**/*.test.ts"
//   bun run agents/test-flakiness-detective.ts src/components/Button.test.tsx --fix
//   bun run agents/test-flakiness-detective.ts --report flakiness.md

import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface TestFlakinessOptions {
  testPattern: string;
  autoFix: boolean;
  reportFile: string;
  runTests: boolean;
}

const DEFAULT_TEST_PATTERN = "**/*.{test,spec}.{ts,tsx,js,jsx}";
const DEFAULT_REPORT_FILE = "test-flakiness-report.md";

const SYSTEM_PROMPT = `You are a Test Flakiness Detective, an expert at identifying and fixing unreliable tests.

Your mission is to:
1. Analyze test files and test output to identify flaky tests
2. Detect common flakiness causes:
   - Timing issues and race conditions
   - Shared state between tests
   - Network dependencies and external services
   - Non-deterministic data (dates, random values, UUIDs)
   - Improper cleanup or teardown
   - Environment-specific assumptions
3. Suggest specific, actionable fixes based on test type
4. Generate before/after examples showing how to make tests deterministic
5. Create a flakiness report ranking tests by severity

## Common Patterns to Look For:

**Timing Issues:**
- setTimeout without proper waits
- Missing await on async operations
- Polling without timeouts
- Animation/transition assumptions

**Shared State:**
- Global variables modified by tests
- Database records not cleaned up
- Singleton instances persisting across tests
- Browser storage (localStorage, cookies)

**Non-deterministic Data:**
- new Date() without mocking
- Math.random() in assertions
- UUIDs in snapshots
- Order-dependent array operations

**Network/External Dependencies:**
- Real API calls instead of mocks
- Database connections without isolation
- File system operations without cleanup
- Third-party service dependencies

## Output Format:

For each flaky test found, provide:
1. Test name and location
2. Flakiness severity (High/Medium/Low)
3. Root cause analysis
4. Specific fix recommendation with code example
5. Prevention tips

## Tools at Your Disposal:

- Read: Examine test files for patterns
- Grep: Search for common flakiness indicators
- Bash: Run tests multiple times to detect flakiness
- Edit: Apply fixes to test files

Work efficiently and focus on the most impactful fixes first.`;

function printHelp(): void {
  console.log(`
🔍 Test Flakiness Detective

Usage:
  bun run agents/test-flakiness-detective.ts [test-file-pattern] [options]

Arguments:
  test-file-pattern       Test file pattern to analyze (default: ${DEFAULT_TEST_PATTERN})

Options:
  --fix                   Automatically apply safe fixes to test files
  --report <file>         Output report file (default: ${DEFAULT_REPORT_FILE})
  --run-tests             Run tests to detect flakiness (optional)
  --help, -h              Show this help

Examples:
  bun run agents/test-flakiness-detective.ts
  bun run agents/test-flakiness-detective.ts "src/**/*.test.ts"
  bun run agents/test-flakiness-detective.ts src/components/Button.test.tsx --fix
  bun run agents/test-flakiness-detective.ts --report flakiness.md --run-tests
  `);
}

function parseOptions(): TestFlakinessOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const testPattern = positionals[0] || DEFAULT_TEST_PATTERN;
  const autoFix = values.fix === true;
  const runTests = values["run-tests"] === true || values.runTests === true;

  const rawReport = values.report;
  const reportFile = typeof rawReport === "string" && rawReport.length > 0
    ? rawReport
    : DEFAULT_REPORT_FILE;

  return {
    testPattern,
    autoFix,
    reportFile,
    runTests,
  };
}

function buildPrompt(options: TestFlakinessOptions): string {
  const { testPattern, reportFile, runTests, autoFix } = options;

  return `Analyze tests matching the pattern "${testPattern}" for flakiness issues.

Please follow these steps:

1. **Find test files**: Use Glob to find all test files matching the pattern
2. **Scan for common issues**: Use Grep to search for common flakiness indicators like:
   - Hardcoded timeouts (setTimeout, sleep)
   - Date/time dependencies (new Date, Date.now)
   - Random values (Math.random, uuid)
   - Missing cleanup (afterEach, beforeEach issues)
   - Network calls without mocks (fetch, axios without mocks)
3. **Read suspicious files**: Examine files that show warning signs
${runTests ? "4. **Run tests**: Execute the test suite multiple times to observe flaky behavior" : ""}
${autoFix ? "5. **Apply fixes**: Use Edit tool to apply safe, deterministic fixes to flaky tests" : ""}
${runTests ? "6" : "4"}. **Generate report**: Save a comprehensive flakiness report to "${reportFile}" with:
   - List of potentially flaky tests (ranked by severity)
   - Root cause analysis for each
   - Specific fix recommendations with code examples
   - Summary of findings and next steps

Focus on actionable insights and practical fixes. Prioritize high-severity issues.`.trim();
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🔍 Test Flakiness Detective\n");
console.log(`Test Pattern: ${options.testPattern}`);
console.log(`Auto-fix: ${options.autoFix ? "Enabled" : "Disabled"}`);
console.log(`Run Tests: ${options.runTests ? "Yes" : "No"}`);
console.log(`Report: ${options.reportFile}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Glob",
  "Grep",
  "Read",
  "Bash",
  "Write",
  ...(options.autoFix ? ["Edit"] : []),
  "TodoWrite",
];

removeAgentFlags([
    "fix", "report", "run-tests", "runTests", "help", "h"
  ]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  "append-system-prompt": SYSTEM_PROMPT,
  allowedTools: allowedTools.join(" "),
  "permission-mode": options.autoFix ? "acceptEdits" : "default",
  ...(options.autoFix ? { "dangerously-skip-permissions": true } : {}),
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Test flakiness analysis complete!\n");
    console.log(`📄 Full report: ${options.reportFile}`);
    if (options.autoFix) {
      console.log("🔧 Auto-fixes applied - review changes before committing");
    }
    console.log("\nNext steps:");
    console.log("1. Review the flakiness report");
    console.log("2. Prioritize high-severity flaky tests");
    console.log("3. Apply recommended fixes");
    console.log("4. Re-run tests to verify stability");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
