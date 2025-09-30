#!/usr/bin/env bun

/**
 * Environment Variable Validator Agent
 *
 * A quick utility agent that ensures environment configuration correctness:
 * - Reads .env.example and validates against actual .env files
 * - Checks for missing required variables and warns about typos
 * - Validates variable formats (URLs, ports, booleans, JSON) based on usage patterns
 * - Scans codebase to find all environment variable references
 * - Generates starter .env file with placeholder values and inline documentation
 * - Creates .env.types.ts for type-safe environment access in TypeScript
 * - Completes in seconds for quick feedback
 *
 * Usage:
 *   bun run agents/env-validator.ts [options]
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface EnvValidatorOptions {
  envPath?: string;
  examplePath?: string;
  generateTypes?: boolean;
  generateStarter?: boolean;
  checkUsage?: boolean;
  strict?: boolean;
}

async function validateEnvironment(options: EnvValidatorOptions) {
  const {
    envPath = '.env',
    examplePath = '.env.example',
    generateTypes = false,
    generateStarter = false,
    checkUsage = true,
    strict = false,
  } = options;

  console.log('🔒 Environment Variable Validator\n');
  console.log(`Example file: ${examplePath}`);
  console.log(`Environment file: ${envPath}`);
  console.log(`Check usage: ${checkUsage ? '✅' : '❌'}`);
  console.log(`Generate types: ${generateTypes ? '✅' : '❌'}`);
  console.log(`Generate starter: ${generateStarter ? '✅' : '❌'}`);
  console.log(`Strict mode: ${strict ? '✅' : '❌'}\n`);

  const prompt = `
You are an environment variable validator. Your task is to analyze environment configuration files and ensure correctness.

STEPS TO FOLLOW:

1. Read the example file (${examplePath}) to understand required variables
   - Parse variable names and any comments explaining their purpose
   - Identify required vs optional variables (required if no default value)

2. Read the actual environment file (${envPath}) if it exists
   - Compare with example file
   - Identify missing variables
   - Identify extra variables not in example
   - Check for common typos (case sensitivity, underscores vs hyphens)

${
  checkUsage
    ? `
3. Scan the codebase to find ALL environment variable references
   - Use Grep to search for: process.env, import.meta.env, Deno.env, os.getenv
   - Search for common patterns like: process.env.VAR_NAME, process.env['VAR_NAME']
   - Extract all unique variable names referenced in code
   - Compare code usage with what's defined in .env files
   - Report variables used in code but not documented in .env.example
`
    : ''
}

4. Validate variable formats based on their names and usage:
   - URLs should start with http:// or https://
   - Ports should be numbers between 1-65535
   - Booleans should be true/false or 1/0
   - Paths should be valid file system paths
   - Email addresses should match email format
   - API keys/secrets should be reasonable length
   - Numbers should parse as valid numbers
   - JSON strings should be valid JSON

5. Generate a validation report with:
   - ✅ Variables correctly configured
   - ❌ Missing required variables
   - ⚠️  Format validation warnings
   - 💡 Variables in code not documented in .env.example
   - 🔍 Potential typos or similar variable names

${
  generateStarter
    ? `
6. Generate a starter .env file (${envPath}.starter) with:
   - All variables from .env.example
   - Placeholder values with format hints (e.g., https://example.com for URLs)
   - Inline comments explaining each variable's purpose
   - Organized by category if possible
`
    : ''
}

${
  generateTypes
    ? `
7. Generate TypeScript types (.env.types.ts) for type-safe environment access:
   - Create an interface with all environment variables
   - Infer types from variable names and formats (string, number, boolean, URL)
   - Add JSDoc comments for each variable
   - Generate a helper function to validate and parse environment variables at runtime
   - Include an example of how to use the types
`
    : ''
}

VALIDATION RULES:
${strict ? '- In strict mode, treat all warnings as errors' : '- Allow warnings without failing'}
- Report missing variables clearly
- Group similar issues together
- Provide actionable suggestions for fixes

OUTPUT FORMAT:
Present your findings as a clear, structured report with sections for each type of issue.
Use emojis and formatting to make the report easy to scan.
At the end, provide a summary with total issues found.

Begin your analysis now.
`.trim();

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      // Only allow necessary tools
      allowedTools: ['Read', 'Write', 'Grep', 'Glob', 'TodoWrite'],
      // Auto-accept file reads and greps, ask for writes
      permissionMode: generateTypes || generateStarter ? 'acceptEdits' : 'default',
      // Use Sonnet for good balance of speed and capability
      model: 'claude-sonnet-4-5-20250929',
      // Limit thinking for speed
      maxThinkingTokens: 5000,
      // Should complete quickly
      maxTurns: 10,
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  if (input.tool_name === 'Read') {
                    const toolInput = input.tool_input as any;
                    console.log(`📖 Reading ${toolInput.file_path}`);
                  } else if (input.tool_name === 'Grep') {
                    const toolInput = input.tool_input as any;
                    console.log(`🔍 Searching for pattern: ${toolInput.pattern}`);
                  } else if (input.tool_name === 'Write') {
                    const toolInput = input.tool_input as any;
                    console.log(`✍️  Generating ${toolInput.file_path}`);
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
                if (input.hook_event_name === 'PostToolUse') {
                  if (input.tool_name === 'Write') {
                    console.log(`✅ File created successfully`);
                  } else if (input.tool_name === 'Grep') {
                    const toolResponse = input.tool_response as any;
                    if (toolResponse.matches) {
                      console.log(`   Found ${toolResponse.matches.length} matches`);
                    }
                  }
                }
                return { continue: true };
              },
            ],
          },
        ],
      },
    },
  });

  const startTime = Date.now();
  let reportText = '';

  // Stream results
  for await (const message of result) {
    if (message.type === 'assistant') {
      const textContent = message.message.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        const text = textContent.text;
        // Collect report text
        reportText += text + '\n';
        // Show progress
        if (
          text.includes('Reading') ||
          text.includes('Scanning') ||
          text.includes('Analyzing') ||
          text.includes('Validating')
        ) {
          console.log(`💭 ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
        }
      }
    } else if (message.type === 'result') {
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

      if (message.subtype === 'success') {
        console.log('\n' + '='.repeat(60));
        console.log('📋 Validation Report');
        console.log('='.repeat(60));
        console.log('\n' + message.result);
        console.log('\n' + '='.repeat(60));
        console.log(`⚡ Completed in ${elapsedTime}s`);
        console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(
          `📊 Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`
        );

        if (message.usage.cache_read_input_tokens) {
          console.log(`🚀 Cache hits: ${message.usage.cache_read_input_tokens} tokens`);
        }

        // Exit with error code if strict mode and issues found
        if (strict && message.result.includes('❌')) {
          console.log('\n❌ Validation failed in strict mode');
          process.exit(1);
        }
      } else {
        console.error('\n❌ Error:', message.subtype);
        process.exit(1);
      }
    }
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🔒 Environment Variable Validator

Validates environment configuration and generates helpful files.

Usage:
  bun run agents/env-validator.ts [options]

Options:
  --env <path>           Path to .env file (default: .env)
  --example <path>       Path to .env.example file (default: .env.example)
  --generate-types       Generate TypeScript types (.env.types.ts)
  --generate-starter     Generate starter .env file
  --no-check-usage       Skip scanning codebase for env var usage
  --strict               Treat warnings as errors and exit with error code
  --help, -h             Show this help message

Examples:
  # Basic validation
  bun run agents/env-validator.ts

  # Generate types and starter file
  bun run agents/env-validator.ts --generate-types --generate-starter

  # Validate specific env files
  bun run agents/env-validator.ts --env .env.production --example .env.example

  # Strict mode for CI/CD
  bun run agents/env-validator.ts --strict
  `);
  process.exit(0);
}

// Parse options
const options: EnvValidatorOptions = {
  checkUsage: true,
  strict: false,
  generateTypes: false,
  generateStarter: false,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--env':
      options.envPath = args[++i];
      break;
    case '--example':
      options.examplePath = args[++i];
      break;
    case '--generate-types':
      options.generateTypes = true;
      break;
    case '--generate-starter':
      options.generateStarter = true;
      break;
    case '--no-check-usage':
      options.checkUsage = false;
      break;
    case '--strict':
      options.strict = true;
      break;
  }
}

// Run the validator
validateEnvironment(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});