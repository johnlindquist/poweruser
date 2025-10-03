#!/usr/bin/env -S bun run

import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface ConsoleLogStripperOptions {
  dryRun: boolean;
  targetDir: string;
  preserveComments: boolean;
}

function printHelp(): void {
  console.log(`
🧹 Console Log Stripper

Usage:
  bun run agents/console-log-stripper.ts [directory] [options]

Arguments:
  directory               Target directory (default: current directory)

Options:
  --dry-run               Preview changes without modifying files
  --preserve-comments     Keep commented-out console statements
  --help, -h              Show this help
  `);
}

function parseOptions(): ConsoleLogStripperOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const targetDir = positionals[0] || process.cwd();
  const dryRun = values["dry-run"] === true;
  const preserveComments = values["preserve-comments"] === true;

  return { targetDir, dryRun, preserveComments };
}



const options = parseOptions();
if (!options) process.exit(0);

console.log('🧹 Console Log Stripper\n');
console.log(`Directory: ${options.targetDir}`);
console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'REMOVAL'}\n`);

const prompt = `Remove debugging console statements from ${options.targetDir}. Find and remove console.log, console.debug, console.info (preserve console.error, console.warn). ${options.preserveComments ? 'Preserve commented console statements.' : 'Remove commented console statements too.'} Skip node_modules. ${options.dryRun ? 'Show preview of changes without modifying files.' : 'Use Edit tool to remove statements.'} Generate summary report of removed statements.`;

const settings: Settings = {};
const allowedTools = options.dryRun
  ? ["Glob", "Grep", "Read", "TodoWrite"]
  : ["Glob", "Grep", "Read", "Edit", "TodoWrite"];

removeAgentFlags([
    "dry-run", "preserve-comments", "help", "h"
  ]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": options.dryRun ? "default" : "acceptEdits",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log('\n✨ Console log stripping complete!');
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
