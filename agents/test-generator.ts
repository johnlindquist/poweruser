#!/usr/bin/env -S bun run

/**
 * Intelligent Test Generator Agent
 *
 * This agent analyzes your codebase and generates comprehensive test suites:
 * - Detects untested functions and classes
 * - Generates unit tests with edge cases
 * - Creates integration tests for API endpoints
 * - Maintains test coverage reports
 *
 * Usage:
 *   bun run agents/test-generator.ts <path-to-code> [options]
 *
 * Examples:
 *   # Generate tests for a single file
 *   bun run agents/test-generator.ts src/utils/math.ts
 *
 *   # Generate tests for a directory with Jest
 *   bun run agents/test-generator.ts src/api --framework jest
 *
 *   # Generate tests including integration tests
 *   bun run agents/test-generator.ts src --integration --coverage 90
 */

import { resolve } from "node:path";
import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type TestFramework = "jest" | "vitest" | "mocha";

interface TestGeneratorOptions {
  targetPath: string;
  testFramework: TestFramework;
  includeEdgeCases: boolean;
  generateIntegrationTests: boolean;
  coverageThreshold: number;
}

const DEFAULT_FRAMEWORK: TestFramework = "vitest";
const DEFAULT_COVERAGE_THRESHOLD = 80;

function printHelp(): void {
  console.log(`
🧪 Intelligent Test Generator

Usage:
  bun run agents/test-generator.ts <path> [options]

Arguments:
  path                    Path to the code to test

Options:
  --framework <name>      Test framework (jest|vitest|mocha, default: ${DEFAULT_FRAMEWORK})
  --no-edge-cases         Skip edge case generation
  --integration           Generate integration tests
  --coverage <threshold>  Coverage threshold percentage (default: ${DEFAULT_COVERAGE_THRESHOLD})
  --help, -h              Show this help

Examples:
  bun run agents/test-generator.ts src/utils/math.ts
  bun run agents/test-generator.ts src/api --framework jest
  bun run agents/test-generator.ts src --integration --coverage 90
  `);
}

function parseOptions(): TestGeneratorOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const targetPath = positionals[0];
  if (!targetPath) {
    console.error("❌ Error: Target path is required");
    printHelp();
    process.exit(1);
  }

  const rawFramework = values.framework;
  const rawCoverage = values.coverage;
  const noEdgeCases = values["no-edge-cases"] === true;
  const integration = values.integration === true;

  const testFramework = typeof rawFramework === "string" &&
    ["jest", "vitest", "mocha"].includes(rawFramework)
    ? (rawFramework as TestFramework)
    : DEFAULT_FRAMEWORK;

  const coverageThreshold = typeof rawCoverage === "string"
    ? parseInt(rawCoverage, 10)
    : DEFAULT_COVERAGE_THRESHOLD;

  if (isNaN(coverageThreshold) || coverageThreshold < 0 || coverageThreshold > 100) {
    console.error("❌ Error: Coverage threshold must be between 0 and 100");
    process.exit(1);
  }

  return {
    targetPath: resolve(targetPath),
    testFramework,
    includeEdgeCases: !noEdgeCases,
    generateIntegrationTests: integration,
    coverageThreshold,
  };
}

function buildPrompt(options: TestGeneratorOptions): string {
  const {
    targetPath,
    testFramework,
    includeEdgeCases,
    generateIntegrationTests,
    coverageThreshold,
  } = options;

  return `
You are an expert test engineer. Analyze the code at "${targetPath}" and generate comprehensive tests.

Your tasks:
1. Identify all functions, classes, and methods that need testing
2. Generate ${testFramework} tests with:
   - Happy path scenarios
   ${includeEdgeCases ? "- Edge cases (empty inputs, nulls, boundary values)" : ""}
   - Error handling scenarios
   - Mock/stub external dependencies
3. ${generateIntegrationTests ? "Create integration tests for API endpoints" : ""}
4. Organize tests in appropriate __tests__ directories
5. Add test documentation with clear descriptions
6. Generate a coverage report summary
7. Target coverage threshold: ${coverageThreshold}%

Test file naming convention:
- Unit tests: <filename>.test.ts
- Integration tests: <filename>.integration.test.ts

Use modern ${testFramework} best practices including:
- describe/it blocks
- beforeEach/afterEach setup
- expect assertions
- async/await for async tests

At the end, provide a summary of:
- Number of test files created
- Number of test cases generated
- Estimated coverage improvement
- Next steps for running and validating tests
`.trim();
}

function buildSystemPrompt(options: TestGeneratorOptions): string {
  const { testFramework } = options;

  return `
You are an expert test engineer specializing in ${testFramework}.

Define test-focused subagents:

**unit-test-generator**: Generates unit tests for individual functions and classes
- Tools: Read, Write, Glob, Grep
- Specializes in comprehensive unit tests with edge cases and mocks

**integration-test-generator**: Generates integration tests for API endpoints and workflows
- Tools: Read, Write, Glob, Grep, Bash
- Specializes in end-to-end tests for APIs and workflows

**test-analyzer**: Analyzes existing tests and identifies coverage gaps
- Tools: Read, Glob, Grep, Bash
- Identifies untested code paths and coverage gaps

Use these subagents via the Task tool to organize test generation work efficiently.
`.trim();
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🧪 Intelligent Test Generator\n");
console.log(`Target: ${options.targetPath}`);
console.log(`Framework: ${options.testFramework}`);
console.log(`Edge cases: ${options.includeEdgeCases ? "Enabled" : "Disabled"}`);
console.log(`Integration tests: ${options.generateIntegrationTests ? "Enabled" : "Disabled"}`);
console.log(`Coverage threshold: ${options.coverageThreshold}%`);
console.log("");

const prompt = buildPrompt(options);
const systemPrompt = buildSystemPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Read",
  "Write",
  "Glob",
  "Grep",
  "Bash",
  "Task",
  "TodoWrite",
];

removeAgentFlags([
    "framework", "no-edge-cases", "integration", "coverage", "help", "h"
  ]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "acceptEdits",
  "append-system-prompt": systemPrompt,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Test generation complete!\n");
    console.log("Next steps:");
    console.log(`1. Run tests: ${options.testFramework === "vitest" ? "vitest" : "npm test"}`);
    console.log("2. Check coverage report");
    console.log("3. Review and adjust generated tests as needed");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}