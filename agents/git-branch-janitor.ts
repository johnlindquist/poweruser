#!/usr/bin/env -S bun run

/**
 * Git Branch Janitor
 *
 * A lightning-fast utility that keeps your git repository clean and organized.
 * Identifies stale local and remote branches and helps clean them up safely.
 *
 * Usage:
 *   bun run agents/git-branch-janitor.ts [options]
 *
 * Options:
 *   --dry-run         Show what would be deleted without actually deleting
 *   --days <N>        Consider branches stale after N days (default: 30)
 *   --include-remote  Also analyze and suggest remote branch cleanup
 *   --help, -h        Show this help
 *
 * Examples:
 *   bun run agents/git-branch-janitor.ts
 *   bun run agents/git-branch-janitor.ts --dry-run
 *   bun run agents/git-branch-janitor.ts --days 60 --include-remote
 */

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface BranchJanitorOptions {
  dryRun: boolean;
  staleDays: number;
  includeRemote: boolean;
}

const DEFAULT_STALE_DAYS = 30;

function printHelp(): void {
  console.log(`
🧹 Git Branch Janitor

Usage:
  bun run agents/git-branch-janitor.ts [options]

Options:
  --dry-run           Show what would be deleted without actually deleting
  --days <N>          Consider branches stale after N days (default: ${DEFAULT_STALE_DAYS})
  --include-remote    Also analyze and suggest remote branch cleanup
  --help, -h          Show this help

Examples:
  bun run agents/git-branch-janitor.ts
  bun run agents/git-branch-janitor.ts --dry-run
  bun run agents/git-branch-janitor.ts --days 60 --include-remote
  `);
}

function parseOptions(): BranchJanitorOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const dryRun = values["dry-run"] === true || values.dryRun === true;
  const includeRemote = values["include-remote"] === true || values.includeRemote === true;

  const rawDays = values.days;
  const staleDays = typeof rawDays === "string" && rawDays.length > 0
    ? parseInt(rawDays, 10)
    : DEFAULT_STALE_DAYS;

  if (isNaN(staleDays) || staleDays < 1) {
    console.error("❌ Error: --days must be a positive number");
    process.exit(1);
  }

  return {
    dryRun,
    staleDays,
    includeRemote,
  };
}

function buildPrompt(options: BranchJanitorOptions): string {
  const { staleDays, includeRemote, dryRun } = options;

  return `You are a Git Branch Janitor - a specialized agent that helps keep git repositories clean and organized.

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
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["dry-run", "dryRun", "days", "include-remote", "includeRemote", "help", "h"] as const;

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

console.log("🧹 Git Branch Janitor\n");
console.log(`Stale threshold: ${options.staleDays} days`);
console.log(`Dry run mode: ${options.dryRun ? "YES" : "NO"}`);
console.log(`Include remote: ${options.includeRemote ? "YES" : "NO"}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Bash",
  "Read",
  "Write",
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": options.dryRun ? "acceptEdits" : "default",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✅ Branch analysis complete!\n");
    if (options.dryRun) {
      console.log("🔍 Dry run complete - no branches were deleted");
    } else {
      console.log("🧹 Cleanup complete");
    }
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}