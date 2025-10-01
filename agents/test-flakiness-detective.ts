#!/usr/bin/env bun

/**
 * Test Flakiness Detective
 *
 * A practical agent that hunts down and helps fix unreliable tests.
 * Analyzes test output history to identify patterns of flaky tests and suggests fixes.
 *
 * Usage:
 *   bun run agents/test-flakiness-detective.ts [test-file-pattern]
 *
 * Examples:
 *   bun run agents/test-flakiness-detective.ts "glob-pattern"
 *   bun run agents/test-flakiness-detective.ts src/components/Button.test.tsx
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

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

async function main() {
  const args = process.argv.slice(2);
  const testPattern = args[0] || '**/*.{test,spec}.{ts,tsx,js,jsx}';

  console.log('🔍 Test Flakiness Detective starting...\n');
  console.log(`Analyzing tests matching: ${testPattern}\n`);

  const prompt = `Analyze tests matching the pattern "${testPattern}" for flakiness issues.

Please follow these steps:

1. **Find test files**: Use Glob to find all test files matching the pattern
2. **Scan for common issues**: Use Grep to search for common flakiness indicators like:
   - Hardcoded timeouts (setTimeout, sleep)
   - Date/time dependencies (new Date, Date.now)
   - Random values (Math.random, uuid)
   - Missing cleanup (afterEach, beforeEach issues)
   - Network calls without mocks (fetch, axios without mocks)
3. **Read suspicious files**: Examine files that show warning signs
4. **Run tests** (optional): If there's a test script in package.json, run it to observe behavior
5. **Generate report**: Create a comprehensive flakiness report with:
   - List of potentially flaky tests (ranked by severity)
   - Root cause analysis for each
   - Specific fix recommendations with code examples
   - Summary of findings

Focus on actionable insights and practical fixes. Prioritize high-severity issues.`;

  try {
    const result = query({
      prompt,
      options: {
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: SYSTEM_PROMPT
        },
        model: 'claude-sonnet-4-5-20250929',
        allowedTools: [
          'Glob',
          'Grep',
          'Read',
          'Bash',
          'Edit',
          'Write',
          'TodoWrite'
        ],
        maxTurns: 20,
        permissionMode: 'acceptEdits',
      },
    });

    // Stream the results
    for await (const message of result) {
      if (message.type === 'assistant') {
        // Print assistant messages
        for (const content of message.message.content) {
          if (content.type === 'text') {
            console.log(content.text);
          }
        }
      } else if (message.type === 'result') {
        // Print final results
        console.log('\n' + '='.repeat(80));
        if (message.subtype === 'success') {
          console.log('✅ Analysis complete!');
          console.log(`\nTotal turns: ${message.num_turns}`);
          console.log(`Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
          console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
        } else {
          console.log('⚠️  Analysis completed with limitations');
          console.log(`Reason: ${message.subtype}`);
        }
        console.log('='.repeat(80));
      }
    }

  } catch (error) {
    console.error('❌ Error running Test Flakiness Detective:', error);
    process.exit(1);
  }
}

main();