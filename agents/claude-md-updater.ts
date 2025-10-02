#!/usr/bin/env -S bun run

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

function printHelp(): void {
  console.log(`
🤖 CLAUDE.md Updater Agent

Usage:
  bun run agents/claude-md-updater.ts [options]

Options:
  --dry-run               Show suggested updates without applying them
  --days <num>            Number of days to look back (default: 30)
  --help, -h              Show this help
  `);
}

interface UpdaterOptions {
  dryRun: boolean;
  days: number;
}

function parseOptions(): UpdaterOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const dryRun = values["dry-run"] === true;
  const days = typeof values.days === "string" ? parseInt(values.days) : 30;

  return { dryRun, days };
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["dry-run", "days", "help", "h"] as const;
  for (const key of agentKeys) {
    if (key in values) delete values[key];
  }
}

const options = parseOptions();
if (!options) process.exit(0);

console.log('🤖 CLAUDE.md Updater Agent\n');

const prompt = `You are an agent that keeps CLAUDE.md up-to-date. Find CLAUDE.md or .claude/CLAUDE.md (if missing, suggest creating one). Use git to find last modification date (or use last ${options.days} days if file doesn't exist). Analyze commits since that date for: new dependencies, build/test commands, architectural patterns, environment variables, contribution guidelines. Read current CLAUDE.md content. ${options.dryRun ? 'Generate suggested updates without applying them.' : 'Apply updates to CLAUDE.md using Edit tool, explaining each change.'} If file doesn't exist, create it with a comprehensive template.`;

const settings: Settings = {};
const allowedTools = options.dryRun
  ? ["Bash", "Glob", "Grep", "Read", "TodoWrite"]
  : ["Bash", "Glob", "Grep", "Read", "Edit", "Write", "TodoWrite"];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": options.dryRun ? "default" : "acceptEdits",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log('\n✅ CLAUDE.md update analysis complete!');
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
