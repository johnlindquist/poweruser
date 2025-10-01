#!/usr/bin/env bun

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
 *   bun run agents/flaky-test-fixer.ts [test-command] [runs]
 *
 * Example:
 *   bun run agents/flaky-test-fixer.ts "npm test" 5
 *   bun run agents/flaky-test-fixer.ts "bun test" 10
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const DEFAULT_TEST_COMMAND = 'npm test';
const DEFAULT_RUNS = 5;

async function main() {
  const testCommand = process.argv[2] || DEFAULT_TEST_COMMAND;
  const numRuns = parseInt(process.argv[3] || String(DEFAULT_RUNS), 10);

  console.log(`🔬 Flaky Test Fixer`);
  console.log(`   Test command: ${testCommand}`);
  console.log(`   Number of runs: ${numRuns}`);
  console.log(`   Working directory: ${process.cwd()}`);
  console.log();

  const prompt = `You are a Flaky Test Fixer agent. Your goal is to identify and fix flaky tests in this codebase.

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

Generate a comprehensive report and suggest fixes. If you can safely apply automated fixes, do so, but always explain what you changed and why.`;

  try {
    let finalResult = '';

    for await (const event of query({
      prompt,
      options: {
        cwd: process.cwd(),
        model: 'claude-sonnet-4-5',
        permissionMode: 'acceptEdits',
      }
    })) {
      if (event.type === 'assistant') {
        // Stream assistant messages as they arrive
        for (const content of event.message.content) {
          if (content.type === 'text') {
            process.stdout.write(content.text);
          }
        }
      } else if (event.type === 'result') {
        if (event.subtype === 'success') {
          finalResult = event.result;
          console.log('\n\n✅ Analysis complete!');
          console.log(`   Duration: ${(event.duration_ms / 1000).toFixed(2)}s`);
          console.log(`   Cost: $${event.total_cost_usd.toFixed(4)}`);
          console.log(`   Turns: ${event.num_turns}`);
        } else {
          console.error('\n\n❌ Error:', event.subtype);
        }
      }
    }

    return finalResult;
  } catch (error) {
    console.error('\n\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
