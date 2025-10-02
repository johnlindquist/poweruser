#!/usr/bin/env -S bun run

/**
 * Test Coverage Booster
 *
 * A practical everyday agent that automatically identifies untested code and generates comprehensive test cases.
 *
 * Features:
 * - Analyzes coverage reports (Jest, Vitest, pytest, etc.) to find critical gaps
 * - Identifies high-risk untested paths: error handling, edge cases, boundary conditions
 * - Prioritizes what to test based on code complexity and usage frequency
 * - Generates test file templates with properly structured describe/it or test blocks
 * - Suggests realistic test data and assertions based on function signatures and types
 * - Creates integration tests for complex workflows
 * - Detects missing tests for recently changed code in PRs
 * - Ensures consistent test patterns across the codebase
 *
 * Usage:
 *   bun run agents/test-coverage-booster.ts [options]
 *
 * Examples:
 *   # Analyze test coverage and generate tests
 *   bun run agents/test-coverage-booster.ts
 *
 *   # Specify a target directory
 *   bun run agents/test-coverage-booster.ts --target ./src
 *
 *   # Set target coverage percentage
 *   bun run agents/test-coverage-booster.ts --target-coverage 80
 *
 *   # Generate tests for specific files
 *   bun run agents/test-coverage-booster.ts --files "src/utils/*.ts"
 */

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface TestCoverageOptions {
  targetDir?: string;
  targetCoverage: number;
  filesPattern?: string;
  maxTests: number;
}

const DEFAULT_TARGET_COVERAGE = 80;
const DEFAULT_MAX_TESTS = 5;

function printHelp(): void {
  console.log(`
🧪 Test Coverage Booster

Usage:
  bun run agents/test-coverage-booster.ts [options]

Options:
  --target <path>         Target directory to analyze (default: current directory)
  --target-coverage <n>   Target coverage percentage (default: ${DEFAULT_TARGET_COVERAGE})
  --files <pattern>       Glob pattern for files to focus on
  --max-tests <n>         Maximum number of test files to generate (default: ${DEFAULT_MAX_TESTS})
  --help, -h              Show this help

Examples:
  bun run agents/test-coverage-booster.ts
  bun run agents/test-coverage-booster.ts --target ./src
  bun run agents/test-coverage-booster.ts --target-coverage 90
  bun run agents/test-coverage-booster.ts --files "src/utils/*.ts"
  `);
}

function parseOptions(): TestCoverageOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawTarget = values.target;
  const rawTargetCoverage = values["target-coverage"] || values.targetCoverage;
  const rawFiles = values.files;
  const rawMaxTests = values["max-tests"] || values.maxTests;

  const targetDir = typeof rawTarget === "string" && rawTarget.length > 0
    ? resolve(rawTarget)
    : undefined;

  const targetCoverage = typeof rawTargetCoverage === "string"
    ? parseInt(rawTargetCoverage, 10)
    : typeof rawTargetCoverage === "number"
    ? rawTargetCoverage
    : DEFAULT_TARGET_COVERAGE;

  if (targetCoverage < 0 || targetCoverage > 100) {
    console.error("❌ Error: Target coverage must be between 0 and 100");
    process.exit(1);
  }

  const filesPattern = typeof rawFiles === "string" && rawFiles.length > 0
    ? rawFiles
    : undefined;

  const maxTests = typeof rawMaxTests === "string"
    ? parseInt(rawMaxTests, 10)
    : typeof rawMaxTests === "number"
    ? rawMaxTests
    : DEFAULT_MAX_TESTS;

  if (maxTests < 1) {
    console.error("❌ Error: Max tests must be at least 1");
    process.exit(1);
  }

  return {
    targetDir,
    targetCoverage,
    filesPattern,
    maxTests,
  };
}

function buildPrompt(options: TestCoverageOptions): string {
  const { targetDir, targetCoverage, filesPattern, maxTests } = options;

  return `You are a test coverage expert. Your goal is to analyze codebases, identify untested code, and generate comprehensive test cases.

${targetDir ? `Target Directory: ${targetDir}` : ""}
Target Coverage: ${targetCoverage}%
${filesPattern ? `Files Pattern: ${filesPattern}` : ""}
Max Test Files to Generate: ${maxTests}

## Your Process:
1. **Detect Testing Framework**: Look for package.json, requirements.txt, or config files to identify the testing framework (Jest, Vitest, pytest, go test, etc.)
2. **Run Coverage Analysis**: Execute the appropriate coverage command and parse the results
3. **Identify Critical Gaps**: Focus on:
   - Uncovered functions and methods
   - Error handling and edge cases
   - Complex conditional logic
   - Recently changed code (git diff)
   - High-risk areas (authentication, data processing, API endpoints)
4. **Prioritize Testing**: Rank files/functions by:
   - Code complexity (cyclomatic complexity)
   - Business criticality
   - Recent change frequency
   - Current coverage percentage
5. **Generate Test Files**: Create well-structured test files with:
   - Proper imports and setup
   - Descriptive test names following conventions
   - Realistic test data and mocks
   - Comprehensive assertions
   - Edge cases and error scenarios
6. **Report Results**: Provide a summary of:
   - Current vs target coverage (${targetCoverage}%)
   - Number of tests generated
   - Priority areas addressed
   - Recommendations for further testing

## Guidelines:
- Use the existing test patterns from the codebase for consistency
- Generate tests that are maintainable and readable
- Include both positive and negative test cases
- Add comments explaining complex test scenarios
- Suggest integration tests for multi-component workflows
- Never mock what you can test directly
- Ensure tests are deterministic and fast

Your tasks:
1. First, identify the testing framework and test directory structure
2. Run the coverage command to get current coverage statistics
3. Parse the coverage report to identify:
   - Files with low or no coverage
   - Specific functions/methods that are untested
   - Critical paths without tests (error handling, edge cases)
4. Analyze the code complexity to prioritize what needs testing most
5. Check git history to find recently changed code that lacks tests
6. Generate up to ${maxTests} test files for the highest-priority untested code:
   - Follow existing test patterns in the codebase
   - Include unit tests with multiple scenarios
   - Add integration tests where appropriate
   - Use realistic test data and proper assertions
7. Provide a summary report with:
   - Current coverage statistics
   - Tests generated (file paths and test count)
   - Recommended next steps
   - Estimated new coverage percentage

Focus on generating ${maxTests} high-quality test files for the most critical untested code.`.trim();
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["target", "target-coverage", "targetCoverage", "files", "max-tests", "maxTests", "help", "h"] as const;

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

console.log("🧪 Test Coverage Booster\n");
if (options.targetDir) console.log(`Target Directory: ${options.targetDir}`);
console.log(`Target Coverage: ${options.targetCoverage}%`);
if (options.filesPattern) console.log(`Files Pattern: ${options.filesPattern}`);
console.log(`Max Tests: ${options.maxTests}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Bash",
  "Read",
  "Write",
  "Grep",
  "Glob",
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "default",
};

// Change to target directory if specified
if (options.targetDir) {
  process.chdir(options.targetDir);
}

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Test coverage boost complete!\n");
    console.log("Next steps:");
    console.log("1. Review generated test files");
    console.log("2. Run tests to verify they pass");
    console.log("3. Run coverage again to see improvement");
    console.log("4. Commit the new tests");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
