#!/usr/bin/env -S bun run

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

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface EnvValidatorOptions {
  envPath?: string;
  examplePath?: string;
  generateTypes?: boolean;
  generateStarter?: boolean;
  checkUsage?: boolean;
  strict?: boolean;
}

function printHelp(): void {
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
}

function parseOptions(): EnvValidatorOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawEnv = values.env;
  const rawExample = values.example;
  const generateTypes = values["generate-types"] === true;
  const generateStarter = values["generate-starter"] === true;
  const checkUsage = values["no-check-usage"] !== true;
  const strict = values.strict === true;

  const envPath = typeof rawEnv === "string" && rawEnv.length > 0
    ? rawEnv
    : ".env";

  const examplePath = typeof rawExample === "string" && rawExample.length > 0
    ? rawExample
    : ".env.example";

  return {
    envPath,
    examplePath,
    generateTypes,
    generateStarter,
    checkUsage,
    strict,
  };
}

function buildPrompt(options: EnvValidatorOptions): string {
  const { envPath, examplePath, generateTypes, generateStarter, checkUsage, strict } = options;

  return `
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
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = [
    "env",
    "example",
    "generate-types",
    "generate-starter",
    "no-check-usage",
    "strict",
    "help",
    "h"
  ] as const;

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

console.log("🔒 Environment Variable Validator\n");
console.log(`Example file: ${options.examplePath}`);
console.log(`Environment file: ${options.envPath}`);
console.log(`Check usage: ${options.checkUsage ? "✅" : "❌"}`);
console.log(`Generate types: ${options.generateTypes ? "✅" : "❌"}`);
console.log(`Generate starter: ${options.generateStarter ? "✅" : "❌"}`);
console.log(`Strict mode: ${options.strict ? "✅" : "❌"}\n`);

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
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
  "permission-mode": options.generateTypes || options.generateStarter ? "acceptEdits" : "default",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Environment validation complete!\n");
    if (options.generateTypes) {
      console.log("📄 TypeScript types generated: .env.types.ts");
    }
    if (options.generateStarter) {
      console.log("📄 Starter file generated: .env.starter");
    }

    // Exit with error code if strict mode was enabled (claude wrapper handles the exit)
    if (options.strict) {
      console.log("\nNote: Check the validation report above for any issues.");
      console.log("In strict mode, the agent should have exited with error code if issues were found.");
    }
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}