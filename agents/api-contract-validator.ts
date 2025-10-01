#!/usr/bin/env bun

/**
 * API Contract Validator
 *
 * An agent that prevents breaking API changes through rigorous contract validation.
 *
 * Features:
 * - Compares current API signatures with previous versions using git history
 * - Generates snapshot tests for API contracts (REST, GraphQL, gRPC)
 * - Creates detailed diffs showing breaking vs. non-breaking changes
 * - Suggests semantic versioning strategies based on change impact
 * - Validates OpenAPI/Swagger specs against actual implementation
 * - Catches accidental breaking changes before they hit production
 *
 * Usage:
 *   bun agents/api-contract-validator.ts [path-to-api-files] [--base-branch=main]
 *
 * Example:
 *   bun agents/api-contract-validator.ts src/api
 *   bun agents/api-contract-validator.ts src/routes --base-branch=develop
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { parseArgs } from 'util';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'base-branch': { type: 'string', default: 'main' },
  },
  allowPositionals: true,
});

const apiPath = positionals[0] || "src";
const baseBranch = values['base-branch'] as string;

const systemPrompt = `You are an API Contract Validator agent. Your mission is to prevent breaking API changes by thoroughly analyzing API contracts and their changes.

## Your Responsibilities

1. **Analyze Current API Structure**
   - Find all API endpoints/routes in the codebase
   - Identify REST endpoints, GraphQL schemas, gRPC services, or other API contracts
   - Extract current API signatures (methods, paths, parameters, request/response types)
   - Understand the current API surface area

2. **Compare with Git History**
   - Use git to compare current API definitions with the base branch (${baseBranch})
   - Identify all changes to API contracts
   - Categorize changes as: BREAKING, NON-BREAKING, or ENHANCEMENT

3. **Breaking Change Detection**
   Breaking changes include:
   - Removing endpoints or methods
   - Changing HTTP methods (GET -> POST)
   - Removing required parameters or fields
   - Changing parameter/field types in incompatible ways
   - Renaming endpoints or parameters without aliases
   - Changing response structure that clients depend on
   - Tightening validation rules (making things more restrictive)

   Non-breaking changes include:
   - Adding new optional parameters
   - Adding new endpoints
   - Adding new response fields
   - Loosening validation rules
   - Making required fields optional
   - Deprecating but not removing functionality

4. **Generate Contract Tests**
   - Create snapshot tests for each API endpoint
   - Include tests for request/response structure
   - Add tests for error cases
   - Ensure tests will fail if contracts change unexpectedly

5. **Semantic Versioning Recommendations**
   Based on changes detected:
   - MAJOR (x.0.0): Breaking changes require major version bump
   - MINOR (0.x.0): New features/enhancements, backward compatible
   - PATCH (0.0.x): Bug fixes only, no API changes

6. **OpenAPI/Swagger Validation** (if applicable)
   - Check if OpenAPI/Swagger specs exist
   - Validate that specs match actual implementation
   - Identify discrepancies between docs and code

## Output Format

Generate a comprehensive report with:

1. **Executive Summary**
   - Total number of API endpoints analyzed
   - Number of changes detected
   - Breaking changes count
   - Recommended version bump

2. **Detailed Change Report**
   For each changed API:
   - Endpoint/method name
   - Type of change (BREAKING/NON-BREAKING/ENHANCEMENT)
   - What changed (before/after comparison)
   - Impact assessment
   - Migration advice for API consumers

3. **Generated Contract Tests**
   - Path to test files created
   - Coverage information

4. **Action Items**
   - List of required actions before merge
   - Documentation updates needed
   - Client migration guides needed

## Tools You'll Use

- \`Glob\` and \`Grep\`: Find API definitions (routes, controllers, schema files)
- \`Bash\`: Run git diff, git show, npm/bun commands
- \`Read\`: Analyze API code and existing tests
- \`Write\`: Generate contract test files
- \`Edit\`: Update existing test files or documentation
- \`TodoWrite\`: Track validation progress

## Important Notes

- Be thorough but efficient - focus on actual API contracts
- If no changes detected, provide a clean bill of health
- For breaking changes, suggest migration strategies
- Always generate tests that future developers can run
- Consider both REST APIs and GraphQL/gRPC if present`;

async function main() {
  console.log("🔍 API Contract Validator");
  console.log("========================\n");
  console.log(`Analyzing API contracts in: ${apiPath}`);
  console.log(`Comparing against branch: ${baseBranch}\n`);

  const userPrompt = `Validate API contracts in the "${apiPath}" directory.

Compare the current API definitions with the "${baseBranch}" branch to detect any breaking changes.

Steps to follow:
1. Find all API definition files (routes, controllers, schemas, GraphQL, OpenAPI specs, etc.)
2. Use git to compare current state with ${baseBranch} branch
3. Analyze each change to determine if it's breaking or non-breaking
4. Generate snapshot tests for all API endpoints
5. Create a comprehensive validation report with version bump recommendation
6. Suggest migration strategies for any breaking changes

Please be thorough and provide actionable insights.`;

  const result = query({
    prompt: userPrompt,
    options: {
      systemPrompt,
      model: "claude-sonnet-4-5-20250929",
      allowedTools: [
        "Glob",
        "Grep",
        "Read",
        "Write",
        "Edit",
        "Bash",
        "TodoWrite"
      ],
      permissionMode: "acceptEdits",
      cwd: process.cwd(),
    },
  });

  // Stream the agent's progress
  for await (const message of result) {
    if (message.type === "assistant") {
      for (const content of message.message.content) {
        if (content.type === "text") {
          console.log(content.text);
        } else if (content.type === "tool_use") {
          console.log(`\n🔧 Using tool: ${content.name}`);
        }
      }
    } else if (message.type === "result") {
      if (message.subtype === "success") {
        console.log("\n" + "=".repeat(50));
        console.log("✅ Validation Complete");
        console.log("=".repeat(50));
        console.log(message.result);
        console.log(`\n💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`🔄 Turns: ${message.num_turns}`);
      } else {
        console.error("\n❌ Validation failed:", message.subtype);
        process.exit(1);
      }
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});