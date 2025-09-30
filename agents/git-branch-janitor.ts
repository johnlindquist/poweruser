#!/usr/bin/env bun

/**
 * Git Branch Janitor
 *
 * A lightning-fast utility that keeps your git repository clean and organized.
 * Identifies stale local and remote branches and helps clean them up safely.
 *
 * Usage:
 *   bun run agents/git-branch-janitor.ts [--dry-run] [--days=30] [--include-remote]
 *
 * Options:
 *   --dry-run         Show what would be deleted without actually deleting
 *   --days=N          Consider branches stale after N days (default: 30)
 *   --include-remote  Also analyze and suggest remote branch cleanup
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const includeRemote = args.includes("--include-remote");
const daysArg = args.find((arg) => arg.startsWith("--days="));
const staleDays = daysArg ? parseInt(daysArg.split("=")[1] || "30") : 30;

const prompt = `You are a Git Branch Janitor - a specialized agent that helps keep git repositories clean and organized.

Your task is to analyze the git repository in the current directory and identify stale branches that can be safely cleaned up.

## Analysis Steps:

1. **Get current branch**: Identify the current branch to avoid deleting it
2. **List all local branches**: Get all local branches with their last commit info
3. **Check merged branches**: Identify which branches have been merged into main/master
4. **Check branch activity**: Find branches with no commits in the last ${staleDays} days
5. **Identify default branch**: Determine if the repo uses 'main' or 'master' as default
${includeRemote ? "6. **Analyze remote branches**: Check for remote branches that no longer exist locally or are stale" : ""}

## Branch Classification:

Classify each branch as:
- **Safe to delete**: Merged branches (excluding current and default branches)
- **Possibly stale**: Unmerged but inactive for ${staleDays}+ days
- **Active**: Recent activity or is the current/default branch
- **Remote only**: Branches that exist remotely but not locally (if --include-remote)
- **Local only**: Branches that exist locally but not remotely

## Output Format:

Generate a clear report with:
1. Summary statistics (total branches, safe to delete, stale, active)
2. List of branches in each category with:
   - Branch name
   - Last commit date
   - Last author
   - Whether it's merged
   - Whether it exists remotely
3. Suggested cleanup commands${dryRun ? " (DRY RUN - no actual deletion)" : ""}

${dryRun ? "## DRY RUN MODE\nYou are in dry-run mode. Show what WOULD be deleted but DO NOT execute any deletion commands." : "## CLEANUP MODE\nYou can execute branch deletion commands after user confirmation for branches classified as 'safe to delete'."}

## Important Safety Rules:
- NEVER delete the current branch
- NEVER delete the default branch (main/master)
- NEVER delete branches with recent activity (< ${staleDays} days) unless merged
- Always show what will be deleted before executing${!dryRun ? "\n- Ask for explicit confirmation before deleting branches" : ""}

Start by analyzing the git repository and generating the cleanup report.`;

async function main() {
  console.log("🧹 Git Branch Janitor starting...\n");
  console.log(`Configuration:`);
  console.log(`  - Stale threshold: ${staleDays} days`);
  console.log(`  - Dry run mode: ${dryRun ? "YES" : "NO"}`);
  console.log(`  - Include remote analysis: ${includeRemote ? "YES" : "NO"}`);
  console.log();

  const result = query({
    prompt,
    options: {
      permissionMode: dryRun ? "acceptEdits" : "default",
      allowedTools: [
        "Bash",
        "Read",
        "Write",
        "TodoWrite",
      ],
      maxTurns: 20,
    },
  });

  // Stream the agent's responses
  for await (const message of result) {
    if (message.type === "assistant") {
      // Process text content
      for (const block of message.message.content) {
        if (block.type === "text") {
          console.log(block.text);
        }
      }
    } else if (message.type === "result") {
      if (message.subtype === "success") {
        console.log("\n✅ Branch analysis complete!");
        console.log(`\nStatistics:`);
        console.log(`  - Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`  - Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`  - Turns: ${message.num_turns}`);
      } else if (message.subtype === "error_max_turns") {
        console.error("\n❌ Error: Maximum turns reached");
        process.exit(1);
      } else {
        console.error("\n❌ Error during execution");
        process.exit(1);
      }
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});