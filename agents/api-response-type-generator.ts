#!/usr/bin/env bun

/**
 * API Response Type Generator Agent
 *
 * A practical everyday agent that eliminates manual TypeScript type writing for APIs:
 * - Fetches live API responses and generates accurate TypeScript interfaces automatically
 * - Handles nested objects, arrays, optional fields, and union types intelligently
 * - Detects API schema changes and updates types with clear migration guides
 * - Validates runtime responses against generated types to catch API breaking changes early
 * - Generates Zod schemas for runtime validation alongside TypeScript types
 * - Creates mock data factories for testing based on actual API response shapes
 * - Organizes types by API endpoint with clear naming conventions
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const API_ENDPOINT = process.argv[2];
const OUTPUT_FILE = process.argv[3] || 'generated-types.ts';
const GENERATE_ZOD = process.argv.includes('--zod');
const GENERATE_MOCKS = process.argv.includes('--mocks');
const CHECK_EXISTING = process.argv.includes('--check-changes');

function printUsage() {
  console.log(`
🎯 API Response Type Generator

Usage:
  bun agents/api-response-type-generator.ts <api-endpoint> [output-file] [options]

Arguments:
  api-endpoint    The API URL to fetch and generate types from (required)
  output-file     Output TypeScript file path (default: generated-types.ts)

Options:
  --zod           Generate Zod schemas alongside TypeScript types
  --mocks         Generate mock data factories for testing
  --check-changes Compare with existing types and show migration guide

Examples:
  bun agents/api-response-type-generator.ts https://api.github.com/users/octocat
  bun agents/api-response-type-generator.ts https://jsonplaceholder.typicode.com/posts types/api.ts --zod --mocks
  bun agents/api-response-type-generator.ts https://api.example.com/data types/api.ts --check-changes
`);
}

async function main() {
  if (!API_ENDPOINT || API_ENDPOINT === '--help' || API_ENDPOINT === '-h') {
    printUsage();
    process.exit(API_ENDPOINT ? 0 : 1);
  }

  console.log('🎯 API Response Type Generator');
  console.log(`🔗 API Endpoint: ${API_ENDPOINT}`);
  console.log(`📄 Output file: ${OUTPUT_FILE}`);
  if (GENERATE_ZOD) console.log('✨ Generating Zod schemas');
  if (GENERATE_MOCKS) console.log('🎭 Generating mock factories');
  if (CHECK_EXISTING) console.log('🔍 Checking for schema changes');
  console.log();

  const systemPrompt = `You are an API Response Type Generator agent that helps developers automatically create TypeScript types from API responses.

Your task is to:
1. Fetch the API response from the provided endpoint
2. Analyze the response structure deeply:
   - Identify all fields and their types (string, number, boolean, null, undefined)
   - Detect arrays and their element types
   - Handle nested objects recursively
   - Identify optional vs required fields (use ? for optional)
   - Detect union types (e.g., string | number)
   - Recognize common patterns (ISO dates, UUIDs, email addresses)

3. Generate clean TypeScript interfaces:
   - Use PascalCase for interface names based on endpoint path
   - Add JSDoc comments describing each field
   - Mark optional fields with ?
   - Use proper array notation (Type[] or Array<Type>)
   - Create nested interfaces for complex objects
   - Export all generated types

4. If --zod flag is present, also generate Zod schemas:
   - Import { z } from 'zod'
   - Create schemas that match the TypeScript interfaces
   - Use proper Zod validators (z.string(), z.number(), etc.)
   - Add refinements for special formats (email, url, date)
   - Export schemas with "Schema" suffix

5. If --mocks flag is present, generate mock data factories:
   - Create functions that return valid mock data
   - Use realistic sample values based on field names
   - Handle arrays with 1-3 mock items
   - Export factories with "mock" prefix

6. If --check-changes flag is present:
   - Read existing type file if it exists
   - Compare new types with existing types
   - Generate a migration guide showing:
     * New fields added
     * Fields removed
     * Type changes
     * Breaking vs non-breaking changes
   - Include the migration guide as a comment in the output

IMPORTANT:
- Fetch the API using WebFetch tool
- Use Read tool to check existing types if --check-changes
- Generate production-ready, properly formatted TypeScript code
- Use Write tool to save the generated types
- Handle errors gracefully (network issues, invalid JSON, etc.)`;

  const prompt = `Fetch the API endpoint and generate TypeScript types.

1. Fetch the API response:
   - Use WebFetch to call: ${API_ENDPOINT}
   - Prompt: "Return the raw JSON response data"
   - Handle authentication errors, rate limits, or network issues
   - If the response is an array, analyze the first few items

2. Analyze the response structure:
   - Deeply inspect all fields and nested objects
   - Determine if fields are optional by checking for null/undefined
   - Identify array types and their element structure
   - Detect union types where multiple types are possible
   - Recognize special string formats (dates, UUIDs, emails, URLs)

3. Generate a descriptive interface name:
   - Extract from URL path (e.g., /api/users/123 → User)
   - If path has multiple segments, use the resource name
   - Use PascalCase convention

${CHECK_EXISTING ? `
4. Check for existing types:
   - Read the file: ${OUTPUT_FILE}
   - If it exists, parse the existing interfaces
   - Compare field by field with new structure
   - Identify:
     * New fields (non-breaking)
     * Removed fields (breaking)
     * Type changes (potentially breaking)
     * Optional→Required changes (breaking)
` : ''}

${CHECK_EXISTING ? '5' : '4'}. Generate the TypeScript file with:

\`\`\`typescript
/**
 * Generated types for ${API_ENDPOINT}
 * Generated on: ${new Date().toISOString()}
 *
${CHECK_EXISTING ? ` * MIGRATION GUIDE:
 * [Include migration notes here if changes detected]
 *
` : ''}*/

${GENERATE_ZOD ? "import { z } from 'zod';\n" : ''}

/**
 * [Description of the main interface based on API purpose]
 */
export interface InterfaceName {
  /**
   * [Field description inferred from name and type]
   */
  fieldName: string;
  optionalField?: number;
  nestedObject: NestedInterface;
  arrayField: ArrayItemInterface[];
}

export interface NestedInterface {
  // ... nested structure
}

export interface ArrayItemInterface {
  // ... array element structure
}

${GENERATE_ZOD ? `
// Zod schemas for runtime validation

export const NestedInterfaceSchema = z.object({
  // ... matching Zod schema
});

export const ArrayItemInterfaceSchema = z.object({
  // ... matching Zod schema
});

export const InterfaceNameSchema = z.object({
  fieldName: z.string(),
  optionalField: z.number().optional(),
  nestedObject: NestedInterfaceSchema,
  arrayField: z.array(ArrayItemInterfaceSchema),
});

// Type inference helper
export type InterfaceNameFromSchema = z.infer<typeof InterfaceNameSchema>;
` : ''}

${GENERATE_MOCKS ? `
// Mock data factories for testing

export function mockNestedInterface(): NestedInterface {
  return {
    // ... realistic mock data
  };
}

export function mockArrayItemInterface(): ArrayItemInterface {
  return {
    // ... realistic mock data
  };
}

export function mockInterfaceName(): InterfaceName {
  return {
    fieldName: "example",
    optionalField: 42,
    nestedObject: mockNestedInterface(),
    arrayField: [mockArrayItemInterface()],
  };
}
` : ''}
\`\`\`

${CHECK_EXISTING ? '6' : '5'}. Save the generated types to: ${OUTPUT_FILE}

Focus on creating production-ready, well-documented types that developers can use immediately.`;

  try {
    const result = query({
      prompt,
      options: {
        systemPrompt,
        allowedTools: [
          'WebFetch',
          'Read',
          'Write'
        ],
        permissionMode: 'bypassPermissions',
        model: 'sonnet',
      }
    });

    for await (const message of result) {
      if (message.type === 'assistant') {
        // Show assistant thinking/working
        for (const block of message.message.content) {
          if (block.type === 'text') {
            console.log(block.text);
          }
        }
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          console.log('\n✅ Type generation complete!');
          console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
          console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`📊 Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);

          if (message.result) {
            console.log('\n' + message.result);
          }

          console.log(`\n📄 Types saved to: ${OUTPUT_FILE}`);
          console.log('\n💡 Tips:');
          console.log('  - Import the types in your code');
          if (!GENERATE_ZOD) {
            console.log('  - Run with --zod to add runtime validation');
          }
          if (!GENERATE_MOCKS) {
            console.log('  - Run with --mocks to generate test fixtures');
          }
          if (!CHECK_EXISTING) {
            console.log('  - Run with --check-changes to detect schema changes');
          }
        } else {
          console.error('\n❌ Type generation failed:', message.subtype);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error running type generator:', error);
    process.exit(1);
  }
}

main();
