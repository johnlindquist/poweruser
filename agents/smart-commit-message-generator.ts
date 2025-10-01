#!/usr/bin/env bun

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
 *   bun run agents/smart-commit-message-generator.ts
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

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

async function main() {
  console.log('🔍 Analyzing staged changes...\n');

  const startTime = Date.now();

  const result = query({
    prompt: `Analyze the staged git changes and generate a meaningful commit message following conventional commits format.

Steps to follow:
1. Run git status to see staged files
2. Run git diff --staged to see the actual changes
3. Run git log --oneline -10 to understand commit style
4. For key changed files, use git blame to identify potential co-authors
5. Check git branch --show-current and recent commits for issue references
6. Read important changed files to understand the semantic meaning
7. Generate the commit message with all relevant metadata

Explain your reasoning briefly, and present the final commit message in a markdown code block for easy copying.`,
    options: {
      systemPrompt: SYSTEM_PROMPT,
      model: 'claude-sonnet-4-5-20250929',
      allowedTools: ['Bash', 'Read', 'Grep'],
      permissionMode: 'bypassPermissions',
      cwd: process.cwd(),
      maxTurns: 15,
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
        console.log('✅ Commit message generated successfully!');
        console.log(`⏱️  Time: ${(elapsed / 1000).toFixed(2)}s (API: ${(message.duration_api_ms / 1000).toFixed(2)}s)`);
        console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`🔄 Turns: ${message.num_turns}`);
        console.log('='.repeat(80));
        console.log('\n💡 To commit with this message:');
        console.log('   1. Copy the message from the code block above');
        console.log('   2. Run: git commit -F - (then paste and press Ctrl+D)');
        console.log('   Or save to file: git commit -F commit_msg.txt\n');
      } else {
        console.log('\n❌ Error during analysis');
        console.log(`⏱️  Time: ${(elapsed / 1000).toFixed(2)}s`);
      }
    }
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});