#!/usr/bin/env -S bun run

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface CodeReviewOptions {
  target: string;
  targetType: string;
}

function printHelp(): void {
  console.log(`
🔍 Code Review Automator

Usage:
  bun run agents/code-review-automator.ts [target] [options]

Arguments:
  target                  File path to review (default: staged changes)

Options:
  --branch <name>         Review changes vs branch
  --help, -h              Show this help

Examples:
  bun run agents/code-review-automator.ts                   # Review staged
  bun run agents/code-review-automator.ts --branch main     # Review vs main
  bun run agents/code-review-automator.ts src/file.ts       # Review file
  `);
}

function parseOptions(): CodeReviewOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  let target: string;
  let targetType: string;

  if (values.branch && typeof values.branch === "string") {
    target = values.branch;
    targetType = "branch";
  } else if (positionals[0]) {
    target = positionals[0];
    targetType = "file";
  } else {
    target = "staged";
    targetType = "staged";
  }

  return { target, targetType };
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["branch", "help", "h"] as const;
  for (const key of agentKeys) {
    if (key in values) delete values[key];
  }
}

const options = parseOptions();
if (!options) process.exit(0);

console.log('🔍 Code Review Automator\n');

const targetDescription = options.targetType === "branch"
  ? `changes compared to ${options.target} branch`
  : options.targetType === "file"
  ? `file ${options.target}`
  : "staged changes";

console.log(`Reviewing: ${targetDescription}\n`);

const prompt = `You are an automated code reviewer. Review ${targetDescription}. Identify files to review using git diff. Analyze for: code quality issues, anti-patterns, security vulnerabilities, performance concerns, maintainability issues, best practices violations. Provide constructive feedback with severity levels (critical, warning, suggestion). Include specific examples and recommendations for each issue found. Generate comprehensive code review report.`;

const settings: Settings = {};
const allowedTools = ["Bash", "Glob", "Grep", "Read", "TodoWrite"];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "default",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log('\n✅ Code review complete!');
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
