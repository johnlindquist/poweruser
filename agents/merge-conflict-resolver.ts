#!/usr/bin/env -S bun run

/**
 * Merge Conflict Resolver Agent
 *
 * A practical everyday agent that takes the pain out of merge conflicts:
 * - Automatically detects merge conflicts in your working directory
 * - Analyzes both branches to understand the intent behind conflicting changes
 * - Suggests resolution strategies based on code context and git history
 * - Auto-resolves simple conflicts (whitespace, formatting, non-overlapping changes)
 * - Flags complex conflicts with detailed explanations for manual review
 * - Runs tests after each resolution to verify correctness
 * - Generates a summary report of all conflicts and how they were resolved
 *
 * Usage:
 *   bun run agents/merge-conflict-resolver.ts [project-path] [options]
 *
 * Examples:
 *   # Basic conflict analysis in current directory
 *   bun run agents/merge-conflict-resolver.ts
 *
 *   # Analyze conflicts in specific directory
 *   bun run agents/merge-conflict-resolver.ts /path/to/project
 *
 *   # Dry run mode - only analyze, don't modify
 *   bun run agents/merge-conflict-resolver.ts --dry-run
 *
 *   # Auto-resolve simple conflicts
 *   bun run agents/merge-conflict-resolver.ts --auto-resolve
 *
 *   # Skip test suite after resolution
 *   bun run agents/merge-conflict-resolver.ts --skip-tests
 */

import { resolve } from "node:path";
import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface MergeConflictOptions {
  projectPath: string;
  dryRun: boolean;
  autoResolve: boolean;
  runTests: boolean;
}

const DEFAULT_REPORT_FILE = "MERGE_CONFLICT_REPORT.md";

function printHelp(): void {
  console.log(`
🔀 Merge Conflict Resolver

Usage:
  bun run agents/merge-conflict-resolver.ts [project-path] [options]

Arguments:
  project-path            Path to project directory (default: current directory)

Options:
  --dry-run               Analyze only, don't modify files
  --auto-resolve          Automatically resolve simple conflicts
  --skip-tests            Skip running tests after resolution
  --help, -h              Show this help

Examples:
  bun run agents/merge-conflict-resolver.ts
  bun run agents/merge-conflict-resolver.ts /path/to/project
  bun run agents/merge-conflict-resolver.ts --dry-run
  bun run agents/merge-conflict-resolver.ts --auto-resolve
  bun run agents/merge-conflict-resolver.ts --auto-resolve --skip-tests
  `);
}

function parseOptions(): MergeConflictOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const projectPath = positionals[0] ? resolve(positionals[0]) : process.cwd();
  const dryRun = values["dry-run"] === true || values.dryRun === true;
  const autoResolve = values["auto-resolve"] === true || values.autoResolve === true;
  const runTests = values["skip-tests"] !== true && values.skipTests !== true;

  return {
    projectPath,
    dryRun,
    autoResolve,
    runTests,
  };
}

function buildSystemPrompt(options: MergeConflictOptions): string {
  const { autoResolve, runTests } = options;

  return `You are a Merge Conflict Resolver agent that helps developers resolve git merge conflicts intelligently.

Your task is to:
1. Detect merge conflicts in the working directory
   - Check git status for conflicted files
   - Identify the branches involved in the merge
   - List all files with conflicts and their conflict markers

2. Analyze each conflicted file:
   - Read the file to understand the conflict markers (<<<<<<< HEAD, =======, >>>>>>>)
   - Extract the conflicting sections from both branches
   - Use git log to understand the commit history of both changes
   - Use git blame to identify who made each change and when
   - Read surrounding code context to understand the intent of each change

3. Categorize conflicts:
   - SIMPLE: Whitespace-only, formatting differences, non-overlapping logic changes
   - MODERATE: Related logic changes that can be merged with clear strategy
   - COMPLEX: Conflicting logic that requires human judgment and domain knowledge

4. For SIMPLE conflicts (only if auto-resolve is enabled):
   - Automatically resolve by merging both changes intelligently
   - Preserve functionality from both branches when possible
   - Apply consistent formatting
   - Write the resolved file

5. For MODERATE and COMPLEX conflicts:
   - Explain what each side is trying to accomplish
   - Suggest resolution strategies with pros/cons
   - Provide code snippets showing possible resolutions
   - Flag for manual review with clear explanations

6. ${runTests ? 'After resolving conflicts, run tests to verify correctness' : 'Skip running tests'}

7. Generate a comprehensive resolution report

Use Bash for git operations, Read to analyze conflicted files, Grep to find related code, ${autoResolve ? 'Write to apply resolutions, ' : ''}and Write to generate the report.

IMPORTANT:
- Never auto-resolve conflicts unless auto-resolve is enabled
- In dry-run mode, only analyze and suggest - don't modify files
- Preserve the intent of both changes whenever possible
- When in doubt, flag for manual review rather than making incorrect assumptions
- Test after each resolution to catch breaking changes early`;
}

function buildPrompt(options: MergeConflictOptions): string {
  const { projectPath, autoResolve, runTests, dryRun } = options;

  return `Analyze and help resolve merge conflicts in: ${projectPath}

1. First, check for merge conflicts:
   - Run 'git status' to see if there are any conflicted files
   - If no conflicts, report success and exit
   - If conflicts exist, list all conflicted files

2. For each conflicted file:
   a) Read the file to see the conflict markers
   b) Extract the conflicting sections:
      - HEAD version (ours)
      - Incoming version (theirs)
   c) Get git history context:
      - Run 'git log --oneline -5 HEAD' to see recent commits on current branch
      - Run 'git log --oneline -5 MERGE_HEAD' to see incoming commits
      - Run 'git blame' on the conflicted regions to see who made changes
   d) Read surrounding code context (50 lines before/after conflict)

3. Categorize each conflict:
   - SIMPLE: Only whitespace, formatting, or clearly non-overlapping changes
   - MODERATE: Related changes that have a clear merge strategy
   - COMPLEX: Conflicting logic requiring human judgment

4. ${autoResolve ? `For SIMPLE conflicts:
   - Automatically merge both changes
   - Remove conflict markers
   - Apply consistent formatting
   - Write the resolved file
   - Run 'git add <file>' to stage the resolution` : 'For SIMPLE conflicts: Provide auto-resolution suggestion'}

5. For MODERATE and COMPLEX conflicts:
   - Explain what HEAD is trying to do
   - Explain what MERGE_HEAD is trying to do
   - Suggest 2-3 resolution strategies:
     Strategy A: Keep HEAD version (when appropriate)
     Strategy B: Keep MERGE_HEAD version (when appropriate)
     Strategy C: Merge both changes (show how)
   - Provide code snippets for each strategy
   - Recommend which strategy to use and why

${runTests ? `
6. After resolving any conflicts:
   - Detect test command from package.json, Makefile, or common patterns
   - Run the test suite
   - Report test results
   - If tests fail, suggest rolling back auto-resolutions
` : ''}

7. Generate a markdown report saved as '${DEFAULT_REPORT_FILE}':

   # Merge Conflict Resolution Report

   ## Summary
   - Total conflicted files: X
   - Auto-resolved: X (SIMPLE)
   - Manual review needed: X (MODERATE + COMPLEX)
   - Tests passed: Yes/No

   ## Auto-Resolved Conflicts (SIMPLE)
   [List files with brief explanation of resolution]

   ## Conflicts Requiring Manual Review

   ### File: path/to/file.ts (MODERATE/COMPLEX)

   **Conflict Location:** Lines X-Y

   **What HEAD is doing:**
   [Explanation]

   **What MERGE_HEAD is doing:**
   [Explanation]

   **Suggested Resolutions:**

   **Strategy A:** Keep HEAD version
   \`\`\`typescript
   [code snippet]
   \`\`\`
   Pros: ...
   Cons: ...

   **Strategy B:** Keep MERGE_HEAD version
   \`\`\`typescript
   [code snippet]
   \`\`\`
   Pros: ...
   Cons: ...

   **Strategy C:** Merge both changes
   \`\`\`typescript
   [code snippet]
   \`\`\`
   Pros: ...
   Cons: ...

   **Recommendation:** Strategy C - because [reasoning]

   ---

   ## Next Steps
   1. Review manual conflicts in the report
   2. Apply suggested resolutions
   3. Run tests to verify
   4. Complete merge with 'git commit'

${dryRun ? '\n**DRY RUN MODE** - No files were modified. Review the report and run without --dry-run to apply changes.' : ''}

Start by checking git status to detect conflicts.`;
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log('🔀 Merge Conflict Resolver');
console.log(`📁 Project: ${options.projectPath}`);
if (options.dryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made');
}
if (options.autoResolve) {
  console.log('🤖 AUTO-RESOLVE MODE - Will automatically resolve simple conflicts');
}
if (!options.runTests) {
  console.log('⏭️  SKIP TESTS - Tests will not run after resolution');
}
console.log();

// Change working directory if needed
const originalCwd = process.cwd();
if (options.projectPath !== originalCwd) {
  process.chdir(options.projectPath);
}

const systemPrompt = buildSystemPrompt(options);
const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  'Bash',
  'Read',
  'Grep',
  'Glob',
  'Write',
  ...(options.autoResolve && !options.dryRun ? ['Edit'] : []),
  'TodoWrite',
];

removeAgentFlags([
    "dry-run", "dryRun", "auto-resolve", "autoResolve", "skip-tests", "skipTests", "help", "h"
  ]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  'append-system-prompt': systemPrompt,
  allowedTools: allowedTools.join(" "),
  "permission-mode": options.autoResolve && !options.dryRun ? "acceptEdits" : "default",
  ...(options.autoResolve && !options.dryRun ? { 'dangerously-skip-permissions': true } : {}),
};

try {
  const exitCode = await claude(prompt, defaultFlags);

  // Restore original directory
  if (options.projectPath !== originalCwd) {
    process.chdir(originalCwd);
  }

  if (exitCode === 0) {
    console.log('\n✅ Conflict analysis complete!');
    console.log(`\n📄 Report saved to: ${DEFAULT_REPORT_FILE}`);

    if (options.dryRun) {
      console.log('💡 Run without --dry-run to apply suggested resolutions');
    } else if (!options.autoResolve) {
      console.log('💡 Run with --auto-resolve to automatically fix simple conflicts');
    }

    console.log('\nNext steps:');
    console.log('1. Review the resolution report');
    console.log('2. Apply suggested fixes for complex conflicts');
    if (options.runTests) {
      console.log('3. Verify tests pass');
    }
    console.log(`${options.runTests ? '4' : '3'}. Complete merge with 'git commit'`);
  }

  process.exit(exitCode);
} catch (error) {
  // Restore original directory on error
  if (options.projectPath !== originalCwd) {
    process.chdir(originalCwd);
  }
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
