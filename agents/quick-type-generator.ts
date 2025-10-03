#!/usr/bin/env -S bun run

/**
 * Quick Type Generator
 *
 * Transforms JSON into production-ready TypeScript types in under 3 seconds.
 *
 * Features:
 * - Generates properly named TypeScript interfaces with JSDoc comments
 * - Creates corresponding Zod schemas for runtime validation
 * - Generates type-safe mock data factories
 * - Intelligently infers optional vs required fields
 * - Handles deeply nested objects, arrays, unions, and edge cases
 * - Outputs code ready to paste directly into your project
 *
 * Usage:
 *   # From clipboard or inline JSON
 *   bun run agents/quick-type-generator.ts
 *
 *   # From a file
 *   bun run agents/quick-type-generator.ts path/to/data.json
 *
 *   # From stdin
 *   curl https://api.example.com/data | bun run agents/quick-type-generator.ts
 */

import { readFileSync } from 'fs';
import { claude, parsedArgs, removeAgentFlags } from './lib';
import type { ClaudeFlags, Settings } from './lib';

interface QuickTypeOptions {
  jsonInput: string;
  typeName?: string;
}

function printHelp(): void {
  console.log(`
⚡ Quick Type Generator

Usage:
  bun run agents/quick-type-generator.ts [file] [options]

Arguments:
  file                    Optional path to JSON file (uses stdin if omitted)

Options:
  --type-name <name>      Custom type name (inferred from data if not provided)
  --help, -h              Show this help

Examples:
  # From clipboard or paste
  bun run agents/quick-type-generator.ts

  # From a file
  bun run agents/quick-type-generator.ts data.json

  # From stdin with curl
  curl https://api.example.com/data | bun run agents/quick-type-generator.ts

  # With custom type name
  bun run agents/quick-type-generator.ts data.json --type-name User
  `);
}

async function readInput(filePath?: string): Promise<string> {
  // If a file path is provided
  if (filePath) {
    try {
      return readFileSync(filePath, 'utf-8');
    } catch (error) {
      console.error(`❌ Error reading file: ${filePath}`);
      process.exit(1);
    }
  }

  // Check if stdin has data
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }

  // Prompt for input
  console.log('📋 Paste your JSON data (press Ctrl+D when done):');
  console.log('');

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function parseOptions(): QuickTypeOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawTypeName = values['type-name'] || values.typeName;
  const typeName = typeof rawTypeName === 'string' && rawTypeName.length > 0
    ? rawTypeName
    : undefined;

  // Read JSON input synchronously first to validate
  const jsonInput = '';  // Will be populated below

  return {
    jsonInput,
    typeName,
  };
}

function buildPrompt(options: QuickTypeOptions): string {
  const typeNameHint = options.typeName
    ? `\n\nUse "${options.typeName}" as the main type name.`
    : '';

  return `Generate production-ready TypeScript types, Zod schemas, and mock data factories for this JSON:

\`\`\`json
${options.jsonInput}
\`\`\`

Generate:
1. TypeScript interfaces with JSDoc comments
2. Zod schemas for runtime validation
3. A mock data factory function

Make it production-ready and include helpful comments. Infer sensible type names from the data structure.${typeNameHint}`.trim();
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log('⚡ Quick Type Generator\n');

// Read JSON input
const filePath = parsedArgs.positionals[0];
const jsonInput = await readInput(filePath);

// Update options with actual jsonInput
options.jsonInput = jsonInput;

// Validate JSON
try {
  JSON.parse(jsonInput);
} catch (error) {
  console.error('❌ Invalid JSON input');
  console.error(error);
  process.exit(1);
}

console.log('🔍 Analyzing JSON structure...\n');

const prompt = buildPrompt(options);
const settings: Settings = {};

const systemPrompt = `You are a TypeScript type generation expert. Your job is to analyze JSON data and generate production-ready TypeScript types, Zod schemas, and mock data factories.

## Your Process:
1. Parse and analyze the JSON structure
2. Infer types, handling edge cases like:
   - Optional vs required fields (check for null/undefined)
   - Union types (multiple possible types for a field)
   - Arrays with consistent or varied element types
   - Nested objects and complex structures
   - Dates (ISO strings should become Date types)
   - Numbers vs strings that look like numbers
3. Generate well-named TypeScript interfaces with:
   - Proper naming conventions (PascalCase for types)
   - JSDoc comments describing each field
   - Nested types for complex objects
   - Proper optional field markers (?)
4. Generate corresponding Zod schemas for runtime validation
5. Generate a simple mock data factory function using faker-like patterns

## Naming Conventions:
- If JSON is from an API endpoint path (like /users/:id), name it accordingly (User, UserResponse)
- For generic objects, use descriptive names based on the data (Product, Order, Profile)
- For nested objects, create separate named types
- Use clear, professional naming that matches TypeScript conventions

## Output Format:
Provide three code blocks:
1. TypeScript interfaces (with JSDoc)
2. Zod schemas
3. Mock data factory

Make the code production-ready - properly formatted, well-commented, and ready to paste into a project.
Work fast - aim to complete in under 3 seconds!`;

removeAgentFlags([
    
  ]);

const defaultFlags: ClaudeFlags = {
  model: 'claude-sonnet-4-5-20250929',
  settings: JSON.stringify(settings),
  allowedTools: '',  // No tools needed
  'permission-mode': 'bypassPermissions',
  'append-system-prompt': systemPrompt,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log('\n' + '='.repeat(80));
    console.log('✅ Types generated successfully!');
    console.log('='.repeat(80));
    console.log('\n💡 Usage tips:');
    console.log('   • Copy the code blocks above into your project');
    console.log('   • Install zod if needed: bun add zod');
    console.log('   • For mocks, consider adding @faker-js/faker\n');
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}