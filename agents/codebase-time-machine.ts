#!/usr/bin/env -S bun run

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface TimeMachineOptions {
  file: string;
  outputFile: string;
  depth: number;
}

function printHelp(): void {
  console.log(`
⏰ Codebase Time Machine

Usage:
  bun run agents/codebase-time-machine.ts <file> [options]

Arguments:
  file                    File to analyze history

Options:
  --output <file>         Report file (default: code-evolution.md)
  --depth <num>           Number of commits to analyze (default: 20)
  --help, -h              Show this help
  `);
}

function parseOptions(): TimeMachineOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const file = positionals[0];
  if (!file) {
    console.error('❌ Error: File path is required');
    printHelp();
    process.exit(1);
  }

  const outputFile = typeof values.output === "string" ? values.output : "code-evolution.md";
  const depth = typeof values.depth === "string" ? parseInt(values.depth) : 20;

  return { file, outputFile, depth };
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["output", "depth", "help", "h"] as const;
  for (const key of agentKeys) {
    if (key in values) delete values[key];
  }
}

const options = parseOptions();
if (!options) process.exit(0);

console.log('⏰ Codebase Time Machine\n');
console.log(`File: ${options.file}`);
console.log(`Depth: ${options.depth} commits\n`);

const prompt = `Travel through time analyzing ${options.file}. Use git log to get last ${options.depth} commits affecting this file. For each commit: get diff, analyze changes, identify why changes were made, track evolution of key functions/classes. Identify patterns: refactorings, bug fixes, feature additions, performance improvements. Create timeline visualization. Save comprehensive evolution report to "${options.outputFile}" with: commit timeline, major milestones, evolution patterns, key contributors, lessons learned from history.`;

const settings: Settings = {};
const allowedTools = ["Bash", "Read", "Write", "TodoWrite"];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "acceptEdits",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log('\n✨ Time travel complete!');
    console.log(`📄 Report: ${options.outputFile}`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
