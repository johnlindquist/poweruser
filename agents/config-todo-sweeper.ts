#!/usr/bin/env -S bun run

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface ConfigSweeperOptions {
  targetDir: string;
  dryRun: boolean;
  aggressive: boolean;
}

function printHelp(): void {
  console.log(`
🧹 Config TODO Sweeper

Usage:
  bun run agents/config-todo-sweeper.ts [directory] [options]

Arguments:
  directory               Target directory (default: current directory)

Options:
  --dry-run               Show TODOs without removing
  --aggressive            Remove all TODOs including important ones
  --help, -h              Show this help
  `);
}

function parseOptions(): ConfigSweeperOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const targetDir = positionals[0] || process.cwd();
  const dryRun = values["dry-run"] === true;
  const aggressive = values.aggressive === true;

  return { targetDir, dryRun, aggressive };
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["dry-run", "aggressive", "help", "h"] as const;
  for (const key of agentKeys) {
    if (key in values) delete values[key];
  }
}

const options = parseOptions();
if (!options) process.exit(0);

console.log('🧹 Config TODO Sweeper\n');
console.log(`Directory: ${options.targetDir}`);
console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'REMOVAL'}\n`);

const prompt = `Sweep configuration files in ${options.targetDir} for TODO comments. Find TODOs in: config files (.json, .yaml, .toml, .env.example), documentation (.md), package.json, tsconfig.json. Categorize: completed (implemented elsewhere), obsolete (no longer relevant), important (keep). ${options.aggressive ? 'Remove all TODOs.' : 'Remove completed and obsolete only, keep important ones.'} ${options.dryRun ? 'Report findings without modifying files.' : 'Use Edit tool to remove TODOs.'} Generate summary report.`;

const settings: Settings = {};
const allowedTools = options.dryRun
  ? ["Glob", "Grep", "Read", "TodoWrite"]
  : ["Glob", "Grep", "Read", "Edit", "TodoWrite"];

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
    console.log('\n✨ Config sweep complete!');
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
