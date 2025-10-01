#!/usr/bin/env bun

/**
 * CLAUDE.md Updater Agent
 *
 * This agent keeps the project's CLAUDE.md file up-to-date by analyzing
 * recent git commits and suggesting additions or modifications.
 *
 * Features:
 * - Finds the last time CLAUDE.md was modified.
 * - Analyzes commits since that date.
 * - Identifies new conventions, dependencies, or architectural changes.
 * - Suggests updates to CLAUDE.md to reflect the latest project state.
 *
 * Usage:
 *   bun run agents/claude-md-updater.ts [--dry-run] [--output]
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

async function main() {
  console.log("🤖 CLAUDE.md Updater Agent");

  const prompt = `
You are an agent that keeps CLAUDE.md up-to-date.

1.  **Find CLAUDE.md**: Look for \`CLAUDE.md\` or \`.claude/CLAUDE.md\`. If it doesn't exist, note that and suggest creating one based on the project.
2.  **Find Last Modified Date**: Use git to find the last modification date of the CLAUDE.md file.
    - If the file doesn't exist, use the last 30 days.
3.  **Analyze Commits**: Get all commits since that date.
4.  **Summarize Changes**: For the most significant commits, analyze the diffs to find changes relevant to a project's context memory. Look for:
    - New dependencies (package.json, etc.)
    - New build/test/lint commands (package.json)
    - New architectural patterns or major features.
    - New environment variables.
    - Changes to contribution guidelines.
5.  **Read CLAUDE.md**: Read the current content of the file.
6.  **Suggest Updates**: Based on the analysis, generate and apply updates to \`CLAUDE.md\`. Use the 'replace' tool to add or modify sections. Explain why the changes are being made.
    - If the file doesn't exist, create it with a good starting template.
`;

  for await (const message of query({ prompt })) {
    if (message.type === "assistant") {
      for (const content of message.message.content) {
        if (content.type === "text") {
          console.log(content.text);
        }
      }
    } else if (message.type === "result") {
      if (message.subtype === "success") {
        console.log("\n✅ CLAUDE.md update analysis complete!");
        console.log(message.result);
      } else {
        console.error(`\n❌ Task failed: ${message.subtype}`);
      }
    }
  }
}

main().catch(console.error);