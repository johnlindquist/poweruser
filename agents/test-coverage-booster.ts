#!/usr/bin/env bun

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
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const SYSTEM_PROMPT = `You are a test coverage expert. Your goal is to analyze codebases, identify untested code, and generate comprehensive test cases.

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
   - Current vs target coverage
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

## Tools Available:
- Bash: Run coverage commands, git operations
- Read: Analyze source code and existing tests
- Grep: Find test patterns and code references
- Glob: Locate test files and source files
- Write: Generate new test files

Start by analyzing the project structure and detecting the testing framework.`;

async function main() {
  console.log('🧪 Test Coverage Booster Agent\n');
  console.log('Analyzing your codebase to identify untested code and generate comprehensive test cases...\n');

  const prompt = `Analyze this codebase and boost test coverage:

1. First, identify the testing framework and test directory structure
2. Run the coverage command to get current coverage statistics
3. Parse the coverage report to identify:
   - Files with low or no coverage
   - Specific functions/methods that are untested
   - Critical paths without tests (error handling, edge cases)
4. Analyze the code complexity to prioritize what needs testing most
5. Check git history to find recently changed code that lacks tests
6. Generate test files for the highest-priority untested code:
   - Follow existing test patterns in the codebase
   - Include unit tests with multiple scenarios
   - Add integration tests where appropriate
   - Use realistic test data and proper assertions
7. Provide a summary report with:
   - Current coverage statistics
   - Tests generated (file paths and test count)
   - Recommended next steps
   - Estimated new coverage percentage

Focus on generating 3-5 high-quality test files for the most critical untested code.`;

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: SYSTEM_PROMPT,
        model: 'claude-sonnet-4-5-20250929',
        allowedTools: ['Bash', 'Read', 'Write', 'Grep', 'Glob'],
        maxTurns: 25,
      },
    })) {
      if (message.type === 'result') {
        if (message.subtype === 'success') {
          console.log('\n✅ Test Coverage Boost Complete!\n');
          console.log(message.result);
        } else {
          console.log('\n⚠️ Task completed with limitations\n');
        }
        console.log(`\n📊 Total cost: $${message.total_cost_usd?.toFixed(4) || 'N/A'}`);
        console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
