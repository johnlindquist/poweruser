#!/usr/bin/env bun

/**
 * API Documentation Sync Checker Agent
 *
 * A practical everyday agent that keeps your API docs in sync with reality:
 * - Scans your codebase to extract all API endpoints, routes, and handlers automatically
 * - Compares discovered endpoints against OpenAPI/Swagger specs, README files, and API documentation
 * - Identifies undocumented endpoints, outdated parameter descriptions, and missing response examples
 * - Detects endpoint signature changes that aren't reflected in docs (new params, changed types, deprecated fields)
 * - Validates example requests/responses against actual API schemas
 * - Generates updated documentation snippets ready to paste into your docs
 * - Creates a sync report with severity levels (critical: undocumented endpoint, minor: outdated description)
 * - Perfect for preventing documentation drift and maintaining accurate API contracts
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { parseArgs } from 'util';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'auto-update': { type: 'boolean', default: false },
    output: { type: 'string', default: 'api-sync-report.md' },
  },
  allowPositionals: true,
});

const PROJECT_PATH = positionals[0] || process.cwd();
const AUTO_UPDATE = values['auto-update'] as boolean;
const OUTPUT_FILE = values.output as string;

async function main() {
  console.log('📚 API Documentation Sync Checker');
  console.log(`📁 Scanning project: ${PROJECT_PATH}`);
  console.log(`📄 Output file: ${OUTPUT_FILE}`);
  if (AUTO_UPDATE) {
    console.log('✏️  Will automatically update documentation');
  }
  console.log();

  const systemPrompt = `You are an API Documentation Sync Checker agent that helps developers keep API documentation in sync with the actual implementation.

Your task is to:
1. Discover all API endpoints in the codebase:
   - Express/Fastify/Koa routes (app.get, app.post, router.use, etc.)
   - Next.js API routes (pages/api/* or app/api/*)
   - Django/Flask routes (@app.route, urlpatterns)
   - FastAPI routes (@app.get, @app.post)
   - Spring Boot (@RestController, @GetMapping, etc.)
   - Any other REST API frameworks

2. Extract endpoint details:
   - HTTP method (GET, POST, PUT, DELETE, PATCH)
   - Route path with parameters
   - Request parameters (query, path, body)
   - Response types and status codes
   - Authentication/middleware requirements
   - Description from code comments if present

3. Find and parse API documentation:
   - OpenAPI/Swagger specs (openapi.yaml, swagger.json)
   - README files with API sections
   - Dedicated API documentation files (API.md, docs/api/*)
   - JSDoc/TSDoc comments with API annotations
   - Postman collections if present

4. Compare implementation vs documentation:
   - Identify undocumented endpoints (exist in code but not in docs)
   - Find deprecated/removed endpoints (documented but not implemented)
   - Detect parameter mismatches (different types, names, or requirements)
   - Spot missing response examples or status codes
   - Check for outdated descriptions or examples
   - Validate request/response schema consistency

5. Generate a comprehensive sync report with:
   - Executive summary (total endpoints, documented %, issues found)
   - Critical issues (undocumented endpoints, breaking changes)
   - Warnings (outdated descriptions, missing examples)
   - Info (minor inconsistencies)
   - For each issue: endpoint, severity, description, suggested fix
   - Ready-to-paste documentation snippets for undocumented endpoints

${AUTO_UPDATE ? '6. Automatically update documentation files with the suggested fixes' : ''}

Use Grep to find routes and docs efficiently, Read to analyze implementations and docs, and Write to generate the report.

IMPORTANT:
- Be thorough in finding all endpoint patterns for different frameworks
- Parse route parameters carefully (/:id vs /{id} vs <id>)
- Compare parameter types, not just names
- Generate documentation in the same format as existing docs
- Prioritize issues by severity for actionability`;

  const prompt = `Scan the API implementation and documentation at: ${PROJECT_PATH}

1. First, identify the project type and framework:
   - Use Glob to find package.json, requirements.txt, pom.xml, etc.
   - Determine the web framework (Express, Next.js, Django, FastAPI, Spring Boot, etc.)
   - Locate API endpoint files based on common patterns

2. Extract all API endpoints from the codebase:
   - Search for route definitions using Grep with framework-specific patterns
   - For each endpoint found, read the file to extract:
     * HTTP method
     * Route path
     * Parameters (query, path, body)
     * Response types
     * Middleware/auth requirements
     * Any JSDoc/comments
   - Create a complete list of implemented endpoints

3. Find and parse API documentation:
   - Search for OpenAPI/Swagger files (openapi.yaml, openapi.json, swagger.yaml, etc.)
   - Look for API documentation in README.md or docs/
   - Check for API.md or similar dedicated docs
   - Read and parse the documentation format

4. Compare implementation vs documentation:
   - For each implemented endpoint:
     * Check if it's documented
     * Verify HTTP method matches
     * Compare parameters (names, types, required/optional)
     * Check response schemas and status codes
     * Validate examples against actual implementation
   - For each documented endpoint:
     * Verify it's still implemented
     * Check if it's been deprecated or removed
   - Categorize issues by severity:
     * CRITICAL: Undocumented endpoint, removed endpoint still documented, wrong HTTP method
     * WARNING: Outdated parameter description, missing response example, type mismatch
     * INFO: Minor formatting differences, missing optional details

5. Generate a markdown report saved as '${OUTPUT_FILE}' with:

   # API Documentation Sync Report

   ## Summary
   - Total implemented endpoints: X
   - Documented endpoints: X (Y%)
   - Critical issues: X
   - Warnings: X
   - Info: X

   ## Critical Issues

   ### Undocumented Endpoints
   **POST /api/users/:id/settings**
   - Implementation: src/routes/users.ts:45
   - Issue: Endpoint exists but not documented
   - Suggested documentation:
     \`\`\`yaml
     /api/users/{id}/settings:
       post:
         summary: Update user settings
         parameters:
           - name: id
             in: path
             required: true
             schema:
               type: string
         requestBody:
           content:
             application/json:
               schema:
                 type: object
                 properties:
                   theme: { type: string }
                   notifications: { type: boolean }
     \`\`\`

   ## Warnings
   [Parameter mismatches, outdated descriptions, missing examples]

   ## Info
   [Minor inconsistencies]

   ## Recommendations
   - Priority fixes to do first
   - Suggestions for maintaining sync going forward
   - Consider adding automated API doc generation

${AUTO_UPDATE ? `
6. After generating the report, update the documentation:
   - For OpenAPI/Swagger specs, add missing endpoints
   - Update README or API.md with new endpoints
   - Ensure the format matches existing documentation style
   - Make minimal changes to preserve existing structure
` : ''}

Start by identifying the framework and endpoint patterns, then systematically compare code vs docs.`;

  try {
    const result = query({
      prompt,
      options: {
        cwd: PROJECT_PATH,
        systemPrompt,
        allowedTools: [
          'Glob',
          'Grep',
          'Read',
          'Write',
          'Edit'
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
          console.log('\n✅ API documentation sync check complete!');
          console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
          console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`📊 Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);

          if (message.result) {
            console.log('\n' + message.result);
          }

          console.log(`\n📄 Report saved to: ${OUTPUT_FILE}`);

          if (!AUTO_UPDATE) {
            console.log('💡 Run with --auto-update to automatically update documentation files');
          }
        } else {
          console.error('\n❌ API sync check failed:', message.subtype);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error running API documentation sync checker:', error);
    process.exit(1);
  }
}

main();
