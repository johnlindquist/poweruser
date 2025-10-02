#!/usr/bin/env -S bun run

/**
 * TODO Collector Agent
 *
 * A tiny quick-win agent that transforms scattered TODO comments into actionable tasks:
 * - Scans entire codebase for TODO, FIXME, HACK, BUG, and NOTE comments
 * - Extracts context: file path, line number, author, and date when TODO was added
 * - Groups TODOs by priority (FIXME > BUG > TODO > NOTE), category, or author
 * - Generates a clean markdown checklist with links to source locations
 * - Identifies stale TODOs that have been in the code for months
 * - Suggests which TODOs should be converted to GitHub issues
 * - Optionally creates a TODO.md file or GitHub issues automatically
 *
 * Usage:
 *   bun run agents/todo-collector.ts [project-path] [options]
 *
 * Examples:
 *   # Scan current directory
 *   bun run agents/todo-collector.ts
 *
 *   # Scan specific project
 *   bun run agents/todo-collector.ts /path/to/project
 *
 *   # Create GitHub issues for high-priority TODOs
 *   bun run agents/todo-collector.ts --create-issues
 *
 *   # Custom output file
 *   bun run agents/todo-collector.ts --output TODO-REPORT.md
 */

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface TodoCollectorOptions {
  projectPath: string;
  createIssues: boolean;
  outputFile: string;
}

const DEFAULT_OUTPUT_FILE = "TODO.md";

function printHelp(): void {
  console.log(`
📝 TODO Collector

Usage:
  bun run agents/todo-collector.ts [project-path] [options]

Arguments:
  project-path            Path to project (default: current directory)

Options:
  --output <file>         Output file (default: ${DEFAULT_OUTPUT_FILE})
  --create-issues         Create GitHub issues for high-priority TODOs
  --help, -h              Show this help

Examples:
  bun run agents/todo-collector.ts
  bun run agents/todo-collector.ts /path/to/project
  bun run agents/todo-collector.ts --create-issues
  bun run agents/todo-collector.ts --output TODO-REPORT.md --create-issues
  `);
}

function parseOptions(): TodoCollectorOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const projectPath = positionals[0]
    ? resolve(positionals[0])
    : process.cwd();

  const rawOutput = values.output;
  const outputFile = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : DEFAULT_OUTPUT_FILE;

  const createIssues = values["create-issues"] === true || values.createIssues === true;

  return {
    projectPath,
    createIssues,
    outputFile,
  };
}

function buildSystemPrompt(options: TodoCollectorOptions): string {
  const { createIssues } = options;

  return `You are a TODO Collector agent that helps developers track scattered TODO comments across their codebase.

Your task is to:
1. Scan the entire codebase for TODO-style comments:
   - TODO: Standard tasks and reminders
   - FIXME: Things that need fixing
   - HACK: Temporary workarounds that need proper solutions
   - BUG: Known bugs that need addressing
   - NOTE: Important notes or warnings
   - XXX: Critical issues requiring attention

2. For each TODO item found:
   - Extract the full comment text and context
   - Record file path and line number
   - Use git blame to find the author and date when it was added
   - Categorize by priority (FIXME/BUG/XXX > TODO > HACK > NOTE)
   - Identify stale TODOs (older than 90 days)

3. Generate a comprehensive TODO report with:
   - Executive summary (total count by type, oldest TODO, etc.)
   - TODOs grouped by priority level
   - Each TODO with: type, file location, line number, author, age, and description
   - Links to source code locations (file:line format)
   - Suggestions for which TODOs should be converted to GitHub issues
   - Statistics about stale TODOs and technical debt

4. Save the report as a markdown file with checkboxes for easy tracking

${createIssues ? '5. Create GitHub issues for high-priority TODOs (FIXME, BUG, XXX) using gh CLI' : ''}

Use Grep to find TODO comments efficiently, Bash (git blame) to get author/date info, and Write to generate the report.

IMPORTANT:
- Search for common comment patterns across multiple languages (// TODO, # TODO, /* TODO */, etc.)
- Parse the TODO text carefully to extract meaningful descriptions
- Calculate age in days from git blame timestamps
- Group logically for easy action planning
- Make the report actionable with clear priorities`;
}

function buildPrompt(options: TodoCollectorOptions): string {
  const { projectPath, outputFile, createIssues } = options;

  return `Scan the project at: ${projectPath} and collect all TODO-style comments.

1. First, understand the project structure:
   - Use Glob to identify what file types are present
   - Determine which languages are being used (JS/TS, Python, Go, Rust, etc.)

2. Search for TODO comments using Grep:
   - Search for patterns: "TODO:", "FIXME:", "HACK:", "BUG:", "NOTE:", "XXX:"
   - Include context lines (-B 1 -A 1) to capture multi-line comments
   - Search across all source files (respect .gitignore)
   - Capture line numbers for each match

3. For each TODO found, use git blame to get metadata:
   - Author who added the TODO
   - Date when it was added (calculate age in days)
   - Commit hash for reference

4. Organize all TODOs by priority:
   Priority 1 (Critical): FIXME, BUG, XXX
   Priority 2 (Important): TODO
   Priority 3 (Info): HACK, NOTE

5. Generate a markdown report saved as '${outputFile}' with:

   # TODO Report

   ## Summary
   - Total TODOs: X
   - By type: TODO (X), FIXME (X), BUG (X), HACK (X), NOTE (X), XXX (X)
   - Oldest TODO: X days old
   - Stale TODOs (>90 days): X

   ## Priority 1: Critical (FIXME, BUG, XXX)
   - [ ] **FIXME** (file.ts:123) - Description here
     - Author: John Doe
     - Age: 45 days
     - Location: \`src/components/file.ts:123\`

   ## Priority 2: Important (TODO)
   [Same format]

   ## Priority 3: Informational (HACK, NOTE)
   [Same format]

   ## Recommendations
   - Suggest which TODOs should become GitHub issues
   - Highlight stale TODOs that need attention
   - Suggest cleanup opportunities

${createIssues ? `
6. After generating the report, create GitHub issues:
   - Use 'gh issue create' for each Priority 1 TODO
   - Include file location, description, and author info
   - Add labels like 'technical-debt', 'bug', 'refactor'
   - Link back to the source code location
` : ''}

Start by scanning the codebase efficiently with Grep, then enrich with git blame data.`;
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["output", "create-issues", "createIssues", "help", "h"] as const;

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

console.log('📝 TODO Collector\n');
console.log(`📁 Scanning project: ${options.projectPath}`);
console.log(`📄 Output file: ${options.outputFile}`);
if (options.createIssues) {
  console.log('🎫 Will create GitHub issues for TODOs');
}
console.log();

// Change to project directory for scanning
const originalCwd = process.cwd();
process.chdir(options.projectPath);

const prompt = buildPrompt(options);
const systemPrompt = buildSystemPrompt(options);
const settings: Settings = {};

const allowedTools = [
  'Glob',
  'Grep',
  'Read',
  'Bash',
  'Write',
  'TodoWrite',
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: 'claude-sonnet-4-5-20250929',
  settings: JSON.stringify(settings),
  'append-system-prompt': systemPrompt,
  allowedTools: allowedTools.join(' '),
  'permission-mode': 'bypassPermissions',
};

try {
  const exitCode = await claude(prompt, defaultFlags);

  // Restore original working directory
  process.chdir(originalCwd);

  if (exitCode === 0) {
    console.log("\n✅ TODO collection complete!\n");
    console.log(`📄 Report saved to: ${options.outputFile}`);
    if (!options.createIssues) {
      console.log('💡 Run with --create-issues to automatically create GitHub issues for high-priority TODOs');
    }
  }
  process.exit(exitCode);
} catch (error) {
  // Restore original working directory on error
  process.chdir(originalCwd);
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
