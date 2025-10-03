#!/usr/bin/env -S bun run

import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface CliReconstructorOptions {
  binPath: string;
  focusPatterns: string[];
  maxCommands: number;
  outputFile: string;
  dryRun: boolean;
}

function printHelp(): void {
  console.log(`
🛠️  CLI Utility Reconstructor

Usage:
  bun run agents/cli-utility-reconstructor.ts [options]

Options:
  --bin-path <path>       Directory with CLI binaries (default: /usr/local/bin)
  --focus <patterns>      Comma-separated patterns to prioritize
  --max-commands <num>    Limit number of CLIs (default: 5)
  --output <file>         Report path (default: cli-utility-rebuild-plan.md)
  --dry-run               Print findings without writing report
  --help, -h              Show this help
  `);
}

function parseOptions(): CliReconstructorOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const binPath = typeof values["bin-path"] === "string" ? values["bin-path"] : "/usr/local/bin";
  const focusPatterns = typeof values.focus === "string" ? values.focus.split(',') : [];
  const maxCommands = typeof values["max-commands"] === "string" ? parseInt(values["max-commands"]) : 5;
  const outputFile = typeof values.output === "string" ? values.output : "cli-utility-rebuild-plan.md";
  const dryRun = values["dry-run"] === true;

  return { binPath, focusPatterns, maxCommands, outputFile, dryRun };
}



const options = parseOptions();
if (!options) process.exit(0);

console.log('🛠️  CLI Utility Reconstructor\n');
console.log(`Binary directory: ${options.binPath}`);
console.log(`Focus patterns: ${options.focusPatterns.length ? options.focusPatterns.join(', ') : '(none)'}`);
console.log(`Command limit: ${options.maxCommands}\n`);

const prompt = `Survey CLI binaries in ${options.binPath}. ${options.focusPatterns.length ? `Focus on: ${options.focusPatterns.join(', ')}.` : ''} Inspect up to ${options.maxCommands} utilities. For each: run --help, analyze output, identify dependencies, determine build method. ${options.dryRun ? 'Print findings only.' : `Write blueprint to "${options.outputFile}" explaining how to rebuild each utility from source.`}`;

const settings: Settings = {};
const allowedTools = options.dryRun
  ? ["Bash", "Read", "TodoWrite"]
  : ["Bash", "Read", "Write", "TodoWrite"];

removeAgentFlags([
    "bin-path", "focus", "max-commands", "output", "dry-run", "help", "h"
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
    console.log('\n✨ CLI reconstruction complete!');
    if (!options.dryRun) console.log(`📄 Report: ${options.outputFile}`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
