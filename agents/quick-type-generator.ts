#!/usr/bin/env bun

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

import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync } from 'fs';

const SYSTEM_PROMPT = `You are a TypeScript type generation expert. Your job is to analyze JSON data and generate production-ready TypeScript types, Zod schemas, and mock data factories.

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

async function readInput(): Promise<string> {
  const args = process.argv.slice(2);

  // If a file path is provided
  if (args.length > 0 && args[0]) {
    const filePath = args[0];
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

async function main() {
  console.log('⚡ Quick Type Generator\n');

  const jsonInput = await readInput();

  // Validate JSON
  try {
    JSON.parse(jsonInput);
  } catch (error) {
    console.error('❌ Invalid JSON input');
    console.error(error);
    process.exit(1);
  }

  console.log('🔍 Analyzing JSON structure...\n');

  const startTime = Date.now();

  const result = query({
    prompt: `Generate production-ready TypeScript types, Zod schemas, and mock data factories for this JSON:

\`\`\`json
${jsonInput}
\`\`\`

Generate:
1. TypeScript interfaces with JSDoc comments
2. Zod schemas for runtime validation
3. A mock data factory function

Make it production-ready and include helpful comments. Infer sensible type names from the data structure.`,
    options: {
      systemPrompt: SYSTEM_PROMPT,
      model: 'claude-sonnet-4-5-20250929',
      allowedTools: [],
      permissionMode: 'bypassPermissions',
      maxTurns: 3,
    },
  });

  // Stream the response
  for await (const message of result) {
    if (message.type === 'assistant') {
      for (const content of message.message.content) {
        if (content.type === 'text') {
          console.log(content.text);
        }
      }
    } else if (message.type === 'result') {
      const elapsed = Date.now() - startTime;

      if (message.subtype === 'success') {
        console.log('\n' + '='.repeat(80));
        console.log('✅ Types generated successfully!');
        console.log(`⏱️  Time: ${(elapsed / 1000).toFixed(2)}s (API: ${(message.duration_api_ms / 1000).toFixed(2)}s)`);
        console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`🔄 Turns: ${message.num_turns}`);
        console.log('='.repeat(80));
        console.log('\n💡 Usage tips:');
        console.log('   • Copy the code blocks above into your project');
        console.log('   • Install zod if needed: bun add zod');
        console.log('   • For mocks, consider adding @faker-js/faker\n');
      } else {
        console.log('\n❌ Error during generation');
        console.log(`⏱️  Time: ${(elapsed / 1000).toFixed(2)}s`);
      }
    }
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});