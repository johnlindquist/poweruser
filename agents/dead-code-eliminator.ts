#!/usr/bin/env -S bun run

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface DeadCodeOptions {
  projectPath: string;
  dryRun: boolean;
  aggressive: boolean;
}

function printHelp(): void {
  console.log(`
🗑️  Dead Code Eliminator

Usage:
  bun run agents/dead-code-eliminator.ts [directory] [options]

Arguments:
  directory               Project directory (default: current directory)

Options:
  --dry-run               Analysis only, don't remove code
  --aggressive            Include nearly-dead code with minimal usage
  --help, -h              Show this help
  `);
}

function parseOptions(): DeadCodeOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const projectPath = positionals[0] || process.cwd();
  const dryRun = values["dry-run"] === true;
  const aggressive = values.aggressive === true;

  return { projectPath, dryRun, aggressive };
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

console.log('🗑️  Dead Code Eliminator\n');
console.log(`Project: ${options.projectPath}`);
console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'REMOVAL'}\n`);

const prompt = `Analyze ${options.projectPath} for dead code. Identify unused functions, variables, imports, entire files. Check call graphs, dependency chains for safe removal. Detect dead CSS classes, unused TypeScript types, orphaned test files. Check references across codebase including dynamic imports. ${options.aggressive ? 'Include nearly-dead code with minimal usage.' : 'Focus on definitely unused code.'} Generate prioritized removal plan with risk assessment, estimated bundle size reduction. ${options.dryRun ? 'Analysis only, don\'t remove code.' : 'Create backup branch, then safely remove dead code using Edit tool.'} Suggest refactoring opportunities.`;

const settings: Settings = {};
const allowedTools = options.dryRun
  ? ["Bash", "Glob", "Grep", "Read", "TodoWrite"]
  : ["Bash", "Glob", "Grep", "Read", "Edit", "TodoWrite"];

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
    console.log('\n✨ Dead code analysis complete!');
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
