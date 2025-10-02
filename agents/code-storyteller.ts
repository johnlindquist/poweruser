#!/usr/bin/env -S bun run

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface StorytellerOptions {
  target: string;
  outputFile: string;
  style: string;
}

function printHelp(): void {
  console.log(`
📖 Code Storyteller

Usage:
  bun run agents/code-storyteller.ts [path] [options]

Arguments:
  path                    File or directory to analyze (default: current dir)

Options:
  --output <file>         Output file (default: code-story.md)
  --style <type>          Story style: narrative|technical|beginner (default: narrative)
  --help, -h              Show this help
  `);
}

function parseOptions(): StorytellerOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const target = positionals[0] || process.cwd();
  const outputFile = typeof values.output === "string" ? values.output : "code-story.md";
  const style = typeof values.style === "string" ? values.style : "narrative";

  return { target, outputFile, style };
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["output", "style", "help", "h"] as const;
  for (const key of agentKeys) {
    if (key in values) delete values[key];
  }
}

const options = parseOptions();
if (!options) process.exit(0);

console.log('📖 Code Storyteller\n');
console.log(`Target: ${options.target}`);
console.log(`Style: ${options.style}\n`);

const prompt = `You are a code storyteller. Analyze ${options.target} and create an engaging story about the codebase. Read key files, understand architecture, identify main components and their relationships. Write in ${options.style} style: ${options.style === 'narrative' ? 'engaging story with metaphors' : options.style === 'technical' ? 'detailed technical explanation' : 'beginner-friendly tutorial'}. Save story to "${options.outputFile}" with: overview, key characters (main classes/modules), plot (data flow), conflicts (challenges solved), resolution (architecture decisions). Make it interesting and educational.`;

const settings: Settings = {};
const allowedTools = ["Bash", "Glob", "Grep", "Read", "Write", "TodoWrite"];

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
    console.log('\n✨ Story complete!');
    console.log(`📄 Output: ${options.outputFile}`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
