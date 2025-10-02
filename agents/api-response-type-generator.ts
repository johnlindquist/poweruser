#!/usr/bin/env -S bun run

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
 *
 * Usage:
 *   bun run agents/api-response-type-generator.ts <api-endpoint> [output-file] [options]
 *
 * Examples:
 *   # Basic type generation
 *   bun run agents/api-response-type-generator.ts https://api.github.com/users/octocat
 *
 *   # Generate with Zod schemas
 *   bun run agents/api-response-type-generator.ts https://jsonplaceholder.typicode.com/posts types/api.ts --zod
 *
 *   # Generate with Zod and mocks
 *   bun run agents/api-response-type-generator.ts https://api.example.com/data types/api.ts --zod --mocks
 *
 *   # Check for API changes
 *   bun run agents/api-response-type-generator.ts https://api.example.com/data types/api.ts --check-changes
 */

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface ApiTypeGeneratorOptions {
  apiEndpoint: string;
  outputFile: string;
  generateZod: boolean;
  generateMocks: boolean;
  checkChanges: boolean;
}

const DEFAULT_OUTPUT_FILE = "generated-types.ts";

function printHelp(): void {
  console.log(`
🎯 API Response Type Generator

Usage:
  bun run agents/api-response-type-generator.ts <api-endpoint> [output-file] [options]

Arguments:
  api-endpoint    The API URL to fetch and generate types from (required)
  output-file     Output TypeScript file path (default: ${DEFAULT_OUTPUT_FILE})

Options:
  --zod           Generate Zod schemas alongside TypeScript types
  --mocks         Generate mock data factories for testing
  --check-changes Compare with existing types and show migration guide
  --help, -h      Show this help

Examples:
  bun run agents/api-response-type-generator.ts https://api.github.com/users/octocat
  bun run agents/api-response-type-generator.ts https://jsonplaceholder.typicode.com/posts types/api.ts --zod --mocks
  bun run agents/api-response-type-generator.ts https://api.example.com/data types/api.ts --check-changes
  `);
}

function parseOptions(): ApiTypeGeneratorOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const apiEndpoint = positionals[0];
  if (!apiEndpoint) {
    console.error("❌ Error: API endpoint is required");
    printHelp();
    process.exit(1);
  }

  try {
    new URL(apiEndpoint);
  } catch (error) {
    console.error("❌ Error: Invalid API endpoint URL format");
    process.exit(1);
  }

  const outputFile = positionals[1] || DEFAULT_OUTPUT_FILE;
  const generateZod = values.zod === true;
  const generateMocks = values.mocks === true;
  const checkChanges = values["check-changes"] === true || values.checkChanges === true;

  return {
    apiEndpoint,
    outputFile,
    generateZod,
    generateMocks,
    checkChanges,
  };
}

function buildSystemPrompt(_options: ApiTypeGeneratorOptions): string {
  return `You are an API Response Type Generator agent that helps developers automatically create TypeScript types from API responses.

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
}

function buildPrompt(options: ApiTypeGeneratorOptions): string {
  const { apiEndpoint, outputFile, generateZod, generateMocks, checkChanges } = options;

  return `Fetch the API endpoint and generate TypeScript types.

1. Fetch the API response:
   - Use WebFetch to call: ${apiEndpoint}
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

${checkChanges ? `
4. Check for existing types:
   - Read the file: ${outputFile}
   - If it exists, parse the existing interfaces
   - Compare field by field with new structure
   - Identify:
     * New fields (non-breaking)
     * Removed fields (breaking)
     * Type changes (potentially breaking)
     * Optional→Required changes (breaking)
` : ''}

${checkChanges ? '5' : '4'}. Generate the TypeScript file with:

\`\`\`typescript
/**
 * Generated types for ${apiEndpoint}
 * Generated on: ${new Date().toISOString()}
 *
${checkChanges ? ` * MIGRATION GUIDE:
 * [Include migration notes here if changes detected]
 *
` : ''}*/

${generateZod ? "import { z } from 'zod';\n" : ''}

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

${generateZod ? `
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

${generateMocks ? `
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

${checkChanges ? '6' : '5'}. Save the generated types to: ${outputFile}

Focus on creating production-ready, well-documented types that developers can use immediately.`;
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["zod", "mocks", "check-changes", "checkChanges", "help", "h"] as const;

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

console.log("🎯 API Response Type Generator\n");
console.log(`🔗 API Endpoint: ${options.apiEndpoint}`);
console.log(`📄 Output file: ${options.outputFile}`);
if (options.generateZod) console.log("✨ Generating Zod schemas");
if (options.generateMocks) console.log("🎭 Generating mock factories");
if (options.checkChanges) console.log("🔍 Checking for schema changes");
console.log("");

const prompt = buildPrompt(options);
const systemPrompt = buildSystemPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "WebFetch",
  "Read",
  "Write",
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
  "append-system-prompt": systemPrompt,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✅ Type generation complete!\n");
    console.log(`📄 Types saved to: ${options.outputFile}`);
    console.log("\n💡 Tips:");
    console.log("  - Import the types in your code");
    if (!options.generateZod) {
      console.log("  - Run with --zod to add runtime validation");
    }
    if (!options.generateMocks) {
      console.log("  - Run with --mocks to generate test fixtures");
    }
    if (!options.checkChanges) {
      console.log("  - Run with --check-changes to detect schema changes");
    }
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Error running type generator:", error);
  process.exit(1);
}
