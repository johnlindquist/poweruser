#!/usr/bin/env -S bun run

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
 *
 * Usage:
 *   bun run agents/api-documentation-sync-checker.ts [project-path] [options]
 *
 * Examples:
 *   # Check current directory
 *   bun run agents/api-documentation-sync-checker.ts
 *
 *   # Check specific project
 *   bun run agents/api-documentation-sync-checker.ts ./my-api
 *
 *   # Auto-update docs
 *   bun run agents/api-documentation-sync-checker.ts --auto-update
 *
 *   # Custom output file
 *   bun run agents/api-documentation-sync-checker.ts --output my-report.md
 */

import { resolve } from "node:path";
import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface ApiDocSyncOptions {
  projectPath: string;
  autoUpdate: boolean;
  outputFile: string;
}

const DEFAULT_OUTPUT_FILE = "api-sync-report.md";

function printHelp(): void {
  console.log(`
📚 API Documentation Sync Checker

Usage:
  bun run agents/api-documentation-sync-checker.ts [project-path] [options]

Arguments:
  project-path            Path to project (default: current directory)

Options:
  --auto-update           Automatically update documentation files
  --output <file>         Output file (default: ${DEFAULT_OUTPUT_FILE})
  --help, -h              Show this help

Examples:
  bun run agents/api-documentation-sync-checker.ts
  bun run agents/api-documentation-sync-checker.ts ./my-api
  bun run agents/api-documentation-sync-checker.ts --auto-update
  bun run agents/api-documentation-sync-checker.ts --output my-report.md
  `);
}

function parseOptions(): ApiDocSyncOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const projectPath = positionals[0]
    ? resolve(positionals[0])
    : process.cwd();

  const rawOutput = values.output;
  const outputFile = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : DEFAULT_OUTPUT_FILE;

  const autoUpdate = values["auto-update"] === true || values.autoUpdate === true;

  return {
    projectPath,
    autoUpdate,
    outputFile,
  };
}

function buildPrompt(options: ApiDocSyncOptions): string {
  const { projectPath, autoUpdate, outputFile } = options;

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

${autoUpdate ? '6. Automatically update documentation files with the suggested fixes' : ''}

Use Grep to find routes and docs efficiently, Read to analyze implementations and docs, and Write to generate the report.

IMPORTANT:
- Be thorough in finding all endpoint patterns for different frameworks
- Parse route parameters carefully (/:id vs /{id} vs <id>)
- Compare parameter types, not just names
- Generate documentation in the same format as existing docs
- Prioritize issues by severity for actionability`;

  const prompt = `Scan the API implementation and documentation at: ${projectPath}

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

5. Generate a markdown report saved as '${outputFile}' with:

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

${autoUpdate ? `
6. After generating the report, update the documentation:
   - For OpenAPI/Swagger specs, add missing endpoints
   - Update README or API.md with new endpoints
   - Ensure the format matches existing documentation style
   - Make minimal changes to preserve existing structure
` : ''}

Start by identifying the framework and endpoint patterns, then systematically compare code vs docs.`;

  return systemPrompt + '\n\n' + prompt;
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("📚 API Documentation Sync Checker\n");
console.log(`📁 Project: ${options.projectPath}`);
console.log(`📄 Output: ${options.outputFile}`);
console.log(`Auto-update: ${options.autoUpdate ? "Enabled" : "Disabled"}`);
console.log("");

// Change to project directory if needed
const originalCwd = process.cwd();
if (options.projectPath !== originalCwd) {
  process.chdir(options.projectPath);
}

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Glob",
  "Grep",
  "Read",
  "Write",
  ...(options.autoUpdate ? ["Edit"] : []),
  "TodoWrite",
];

removeAgentFlags([
    "auto-update", "autoUpdate", "output", "help", "h"
  ]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": options.autoUpdate ? "acceptEdits" : "bypassPermissions",
  ...(options.autoUpdate ? { 'dangerously-skip-permissions': true } : {}),
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ API documentation sync check complete!\n");
    console.log(`📄 Report saved to: ${options.outputFile}`);
    if (options.autoUpdate) {
      console.log("✏️  Documentation updates applied - review before committing");
    } else {
      console.log("💡 Run with --auto-update to automatically update documentation files");
    }
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
} finally {
  // Restore original directory
  if (options.projectPath !== originalCwd) {
    process.chdir(originalCwd);
  }
}
