#!/usr/bin/env bun

/**
 * Code Review Assistant
 *
 * A practical agent that prepares comprehensive PR review summaries and catches issues before human review.
 * Analyzes git diff, identifies potential bugs, checks code style, suggests improvements, and generates
 * a human-friendly summary with a review checklist.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  console.log("🔍 Code Review Assistant");
  console.log("========================\n");

  const prompt = `You are a code review assistant. Your job is to analyze the current git changes and prepare a comprehensive review summary.

Please perform the following tasks:

1. Run 'git status' to see what files have changed
2. Run 'git diff --cached' to see staged changes (if any)
3. Run 'git diff' to see unstaged changes
4. Analyze the changes and identify:
   - Potential bugs (null checks, error handling, edge cases)
   - Code style inconsistencies
   - Performance concerns
   - Security vulnerabilities
   - Missing error handling
   - Areas that need tests
   - Breaking changes
   - Backward compatibility concerns

5. Generate a comprehensive review summary in a file called 'code-review-summary.md' with:
   - **Summary**: High-level overview of what changed and why
   - **Files Changed**: List of modified files with brief description of changes
   - **Potential Issues**: Categorized list of concerns found (Critical, Warning, Suggestion)
   - **Performance Considerations**: Any performance implications
   - **Testing Recommendations**: What tests should be added/updated
   - **Review Checklist**: Points for both author and reviewers to verify
   - **Breaking Changes**: Any backward compatibility concerns

Be thorough but concise. Focus on actionable feedback. If there are no changes (clean working tree), report that instead.`;

  const result = query({
    prompt,
    options: {
      model: "claude-sonnet-4-5-20250929",
      allowedTools: ["Bash", "Read", "Write", "Grep"],
      permissionMode: "bypassPermissions",
    },
  });

  for await (const message of result) {
    if (message.type === "assistant") {
      for (const content of message.message.content) {
        if (content.type === "text") {
          console.log(content.text);
        }
      }
    } else if (message.type === "result") {
      if (message.subtype === "success") {
        console.log("\n✅ Code review completed!");
        console.log(`📊 Analysis complete. Check 'code-review-summary.md' for details.`);
        console.log(`\n💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
      } else {
        console.log("\n❌ Error during code review");
        process.exit(1);
      }
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
