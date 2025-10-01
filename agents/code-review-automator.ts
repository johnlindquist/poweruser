#!/usr/bin/env bun

/**
 * Code Review Automator
 *
 * Provides automated code review before human eyes see it.
 * Analyzes changed files for common issues, anti-patterns, and best practices.
 *
 * Usage:
 *   bun run agents/code-review-automator.ts [target]
 *
 * Examples:
 *   bun run agents/code-review-automator.ts                    # Review git staged files
 *   bun run agents/code-review-automator.ts --branch main      # Review changes vs branch
 *   bun run agents/code-review-automator.ts src/file.ts        # Review specific file
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

// Parse command line arguments
const args = process.argv.slice(2);
let target = "";

if (args.length === 0) {
  target = "staged changes";
} else if (args[0] === "--branch" && args[1]) {
  target = `changes compared to ${args[1]} branch`;
} else {
  target = `the file ${args[0]}`;
}

const prompt = `You are an automated code reviewer. Your job is to analyze code and provide constructive feedback on potential issues.

## Your Task

Review ${target} and provide a comprehensive code review report.

## Analysis Steps

1. **Identify the files to review**:
   - If reviewing staged changes: use \`git diff --staged --name-only\`
   - If reviewing vs branch: use \`git diff <branch> --name-only\`
   - If reviewing a specific file: analyze that file directly

2. **For each file, check for these issues**:

   **Critical Issues** (must fix):
   - Missing error handling in try-catch blocks or Promise chains
   - Hardcoded credentials, API keys, or sensitive data
   - SQL injection or XSS vulnerabilities
   - Infinite loops or obvious performance bottlenecks
   - Use of deprecated APIs or functions

   **Important Issues** (should fix):
   - console.log/console.error statements left in code
   - Hardcoded URLs, paths, or configuration values
   - Functions longer than 50 lines
   - Deeply nested code (>3 levels of indentation)
   - Complex conditionals that could be simplified
   - Missing input validation
   - Unused variables or imports
   - Poor variable/function naming (single letters, unclear abbreviations)

   **Suggestions** (nice to have):
   - Code that could be extracted into smaller functions
   - Opportunities to use modern language features
   - Inconsistent code style with the rest of the codebase
   - Missing JSDoc/docstring comments for public APIs
   - Magic numbers that should be named constants

3. **Check for missing tests**:
   - Look for corresponding test files (*test.ts, *.spec.ts, *_test.py, etc.)
   - Note if tests are missing for new features or significant changes

4. **Generate the review report**:
   - Group issues by file and priority level
   - Include file path and line numbers for each issue
   - Provide specific, actionable feedback
   - Suggest concrete improvements with code examples where helpful
   - Include a summary at the top with counts by priority

## Output Format

Your output should be a markdown report with this structure:

\`\`\`markdown
# Code Review Report

## Summary
- Critical Issues: X
- Important Issues: Y
- Suggestions: Z
- Files Reviewed: N

## Critical Issues

### file/path.ts:42
**Issue**: Missing error handling
\`\`\`typescript
// Current code
const result = await apiCall();
\`\`\`
**Recommendation**: Wrap in try-catch to handle potential errors
\`\`\`typescript
try {
  const result = await apiCall();
} catch (error) {
  logger.error('API call failed', error);
  throw error;
}
\`\`\`

## Important Issues

### file/path.ts:108
**Issue**: Console.log left in code
\`\`\`typescript
console.log('Debug info:', data);
\`\`\`
**Recommendation**: Remove debug logging or replace with proper logger

## Suggestions

### file/path.ts:200
**Issue**: Large function (75 lines)
**Recommendation**: Consider extracting helper functions for better readability

## Test Coverage

- ✅ file/path.test.ts exists
- ❌ Missing tests for new-feature.ts

## Overall Assessment

[Brief summary of code quality and key takeaways]
\`\`\`

## Important Notes

- Be constructive and specific in your feedback
- Prioritize issues correctly - don't mark everything as critical
- Include line numbers and code snippets for clarity
- If the code is well-written, say so! Positive feedback is valuable
- Focus on substantive issues, not nitpicks about formatting (unless it's inconsistent)
- If no issues are found, provide a brief positive review

Begin your analysis now.`;

async function main() {
  console.log("🔍 Code Review Automator\n");
  console.log(`Analyzing ${target}...\n`);

  try {
    const result = query({
      prompt,
      options: {
        cwd: process.cwd(),
        allowedTools: ["Bash", "Read", "Grep", "Glob"],
        permissionMode: "bypassPermissions",
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
        },
      },
    });

    // Stream the review as it's generated
    for await (const message of result) {
      if (message.type === "assistant") {
        for (const content of message.message.content) {
          if (content.type === "text") {
            console.log(content.text);
          }
        }
      } else if (message.type === "result") {
        if (message.subtype === "success") {
          console.log("\n✅ Code review completed successfully");
          console.log(`Duration: ${Math.round(message.duration_ms / 1000)}s`);
          console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
        } else {
          console.error("\n❌ Code review failed");
          process.exit(1);
        }
      }
    }
  } catch (error) {
    console.error("Error running code review:", error);
    process.exit(1);
  }
}

main();