#!/usr/bin/env bun

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
 *   bun run agents/test-generator.ts <path-to-code>
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface TestGeneratorOptions {
  targetPath: string;
  testFramework?: 'jest' | 'vitest' | 'mocha';
  includeEdgeCases?: boolean;
  generateIntegrationTests?: boolean;
  coverageThreshold?: number;
}

async function generateTests(options: TestGeneratorOptions) {
  const {
    targetPath,
    testFramework = 'vitest',
    includeEdgeCases = true,
    generateIntegrationTests = false,
    coverageThreshold = 80,
  } = options;

  console.log('🧪 Starting Intelligent Test Generator...\n');
  console.log(`Target: ${targetPath}`);
  console.log(`Framework: ${testFramework}`);
  console.log(`Coverage Threshold: ${coverageThreshold}%\n`);

  const prompt = `
You are an expert test engineer. Analyze the code at "${targetPath}" and generate comprehensive tests.

Your tasks:
1. Identify all functions, classes, and methods that need testing
2. Generate ${testFramework} tests with:
   - Happy path scenarios
   ${includeEdgeCases ? '- Edge cases (empty inputs, nulls, boundary values)' : ''}
   - Error handling scenarios
   - Mock/stub external dependencies
3. ${generateIntegrationTests ? 'Create integration tests for API endpoints' : ''}
4. Organize tests in appropriate __tests__ directories
5. Add test documentation with clear descriptions
6. Generate a coverage report summary

Test file naming convention:
- Unit tests: <filename>.test.ts
- Integration tests: <filename>.integration.test.ts

Use modern ${testFramework} best practices including:
- describe/it blocks
- beforeEach/afterEach setup
- expect assertions
- async/await for async tests
`.trim();

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      // Define a test-focused subagent
      agents: {
        'unit-test-generator': {
          description: 'Generates unit tests for individual functions and classes',
          tools: ['Read', 'Write', 'Glob', 'Grep'],
          prompt: `You are a unit testing specialist. Generate comprehensive unit tests with edge cases and mocks.`,
          model: 'sonnet',
        },
        'integration-test-generator': {
          description: 'Generates integration tests for API endpoints and workflows',
          tools: ['Read', 'Write', 'Glob', 'Grep', 'Bash'],
          prompt: `You are an integration testing specialist. Generate end-to-end tests for APIs and workflows.`,
          model: 'sonnet',
        },
        'test-analyzer': {
          description: 'Analyzes existing tests and identifies coverage gaps',
          tools: ['Read', 'Glob', 'Grep', 'Bash'],
          prompt: `You analyze test coverage and identify untested code paths.`,
          model: 'haiku',
        },
      },
      // Only allow necessary tools
      allowedTools: [
        'Read',
        'Write',
        'Glob',
        'Grep',
        'Bash',
        'Task',
        'TodoWrite',
      ],
      // Auto-accept file writes for test generation
      permissionMode: 'acceptEdits',
      // Add hooks to track progress
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse' && input.tool_name === 'Write') {
                  const filePath = (input.tool_input as any).file_path;
                  if (filePath?.includes('.test.')) {
                    console.log(`✍️  Generating: ${filePath}`);
                  }
                }
                return { continue: true };
              },
            ],
          },
        ],
        PostToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PostToolUse' && input.tool_name === 'Write') {
                  const response = input.tool_response as any;
                  if (response?.message?.includes('test')) {
                    console.log(`✅ Created test file successfully`);
                  }
                }
                return { continue: true };
              },
            ],
          },
        ],
        SessionEnd: [
          {
            hooks: [
              async () => {
                console.log('\n🎉 Test generation complete!');
                console.log('\nNext steps:');
                console.log(`1. Run tests: ${testFramework === 'vitest' ? 'vitest' : 'npm test'}`);
                console.log('2. Check coverage report');
                console.log('3. Review and adjust generated tests as needed');
                return { continue: true };
              },
            ],
          },
        ],
      },
      // Configure max turns to prevent infinite loops
      maxTurns: 50,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  // Stream results
  for await (const message of result) {
    if (message.type === 'assistant') {
      const textContent = message.message.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        // Only show planning messages, not tool responses
        if (!textContent.text.includes('tool_use')) {
          console.log('\n💭', textContent.text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('\n' + '='.repeat(60));
        console.log('📊 Final Report');
        console.log('='.repeat(60));
        console.log(`\nTests generated successfully!`);
        console.log(`Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`API calls: ${(message.duration_api_ms / 1000).toFixed(2)}s`);
        console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`Turns: ${message.num_turns}`);
        console.log(
          `Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`
        );

        if (message.usage.cache_read_input_tokens) {
          console.log(`Cache hits: ${message.usage.cache_read_input_tokens} tokens`);
        }
      } else {
        console.error('\n❌ Error during test generation:', message.subtype);
      }
    }
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
🧪 Intelligent Test Generator

Usage:
  bun run agents/test-generator.ts <path> [options]

Arguments:
  path                    Path to the code to test

Options:
  --framework <name>      Test framework (jest|vitest|mocha, default: vitest)
  --no-edge-cases         Skip edge case generation
  --integration           Generate integration tests
  --coverage <threshold>  Coverage threshold percentage (default: 80)
  --help                  Show this help message

Examples:
  # Generate tests for a single file
  bun run agents/test-generator.ts src/utils/math.ts

  # Generate tests for a directory with Jest
  bun run agents/test-generator.ts src/api --framework jest

  # Generate tests including integration tests
  bun run agents/test-generator.ts src --integration --coverage 90
  `);
  process.exit(0);
}

const targetPath = args[0];

if (!targetPath) {
  console.error('❌ Error: Target path is required');
  process.exit(1);
}

// Parse CLI options
const options: TestGeneratorOptions = {
  targetPath,
  testFramework: 'vitest',
  includeEdgeCases: true,
  generateIntegrationTests: false,
  coverageThreshold: 80,
};

for (let i = 1; i < args.length; i++) {
  switch (args[i]) {
    case '--framework':
      options.testFramework = args[++i] as any;
      break;
    case '--no-edge-cases':
      options.includeEdgeCases = false;
      break;
    case '--integration':
      options.generateIntegrationTests = true;
      break;
    case '--coverage':
      options.coverageThreshold = parseInt(args[++i] || '80', 10);
      break;
  }
}

// Run the test generator
generateTests(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});