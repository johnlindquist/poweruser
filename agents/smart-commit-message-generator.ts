#!/usr/bin/env -S bun run

/**
 * Smart Commit Message Generator
 *
 * Analyzes staged git changes and generates meaningful commit messages
 * that follow conventional commits format and explain WHY changes were made.
 *
 * Features:
 * - Examines git diff to understand technical changes
 * - Reads changed files for broader context
 * - Analyzes recent commits to match project style
 * - Follows conventional commits format (feat, fix, refactor, etc.)
 * - Suggests commit scope and breaking change indicators
 *
 * Usage:
 *   bun run agents/smart-commit-message-generator.ts [options]
 *
 * Options:
 *   --help, -h              Show help message
 */

import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

const SYSTEM_PROMPT = `You are a git commit message expert. Your job is to analyze staged changes and generate meaningful, conventional commit messages.

## Your Process:
1. Check git status to see what's staged
2. Review git diff --staged to understand technical changes
3. Read changed files to understand the broader context and intent
4. Review recent commit history (git log --oneline -10) to match the project's style
5. Check git blame on changed lines to identify potential co-authors
6. Look for issue/ticket references in comments, branch name, or recent commits
7. Generate a commit message following conventional commits format

## Conventional Commits Format:
<type>(<scope>): <description>

[optional body explaining WHY not WHAT]

[optional footer(s)]

### Types:
- feat: A new feature
- fix: A bug fix
- docs: Documentation only changes
- style: Changes that don't affect code meaning (formatting, white-space)
- refactor: Code change that neither fixes a bug nor adds a feature
- perf: Performance improvement
- test: Adding or correcting tests
- build: Changes to build system or dependencies
- ci: Changes to CI configuration
- chore: Other changes that don't modify src or test files

### Scope:
Optional, should be the area of the codebase affected (e.g., api, ui, auth, parser)

### Description:
- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter
- No period at the end
- Keep under 50 characters

### Body (optional):
- Explain WHAT and WHY, not HOW
- Focus on the rationale and impact
- Wrap at 72 characters
- Separate from description with blank line

### Footer (optional):
- Reference issues/PRs: "Closes #123" or "Refs #456"
- Breaking changes: "BREAKING CHANGE: description"
- Co-authors: "Co-authored-by: Name <email@example.com>"

## Your Output:
Generate a complete commit message ready to use. Format it as a markdown code block so it's easy to copy.
Then provide a brief explanation of your reasoning, including:
- Why you chose this commit type
- What issue references or co-authors you found (if any)
- The main purpose and impact of the changes

Focus on understanding the INTENT and PURPOSE of the changes, not just describing what was modified.
Work quickly - aim to complete in under 5 seconds!

If there are no staged changes, inform the user and suggest staging changes first.`;

function printHelp(): void {
  console.log(`
📝 Smart Commit Message Generator

Usage:
  bun run agents/smart-commit-message-generator.ts [options]

Options:
  --help, -h              Show this help

Description:
  Analyzes staged git changes and generates meaningful commit messages
  following conventional commits format. The agent will:
  - Examine git diff to understand technical changes
  - Read changed files for broader context
  - Analyze recent commits to match project style
  - Suggest commit type, scope, and breaking change indicators

Example:
  # Stage your changes first
  git add .

  # Generate commit message
  bun run agents/smart-commit-message-generator.ts
  `);
}

function parseOptions(): boolean {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return false;
  }

  return true;
}



const shouldRun = parseOptions();
if (!shouldRun) {
  process.exit(0);
}

console.log("📝 Smart Commit Message Generator\n");
console.log("🔍 Analyzing staged changes...\n");

const prompt = `Analyze the staged git changes and generate a meaningful commit message following conventional commits format.

Steps to follow:
1. Run git status to see staged files
2. Run git diff --staged to see the actual changes
3. Run git log --oneline -10 to understand commit style
4. For key changed files, use git blame to identify potential co-authors
5. Check git branch --show-current and recent commits for issue references
6. Read important changed files to understand the semantic meaning
7. Generate the commit message with all relevant metadata

Explain your reasoning briefly, and present the final commit message in a markdown code block for easy copying.`;

const settings: Settings = {};

removeAgentFlags([
    "help", "h"
  ]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: "Bash Read Grep TodoWrite",
  "permission-mode": "bypassPermissions",
  "append-system-prompt": SYSTEM_PROMPT,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n💡 To commit with this message:");
    console.log("   1. Copy the message from the code block above");
    console.log("   2. Run: git commit -F - (then paste and press Ctrl+D)");
    console.log("   Or save to file: git commit -F commit_msg.txt\n");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}