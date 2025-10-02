#!/usr/bin/env -S bun run

/**
 * PR Review Checklist Generator Agent
 *
 * An agent that performs pre-submission PR hygiene checks and generates comprehensive PR descriptions:
 * - Scans for console.logs, debugger statements, and commented-out code
 * - Identifies TODOs and FIXMEs that should be addressed
 * - Checks if new code has corresponding tests
 * - Runs linters, formatters, and type checkers
 * - Verifies all tests pass before submission
 * - Generates a PR description with context and a verification checklist
 * - Suggests reviewers based on git blame and file ownership
 *
 * Usage:
 *   bun run agents/pr-review-checklist-generator.ts [options]
 *   bun run agents/pr-review-checklist-generator.ts --branch feature/new-auth
 *   bun run agents/pr-review-checklist-generator.ts --output PR_DESCRIPTION.md
 */

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface PRChecklistOptions {
  branch?: string;
  baseBranch: string;
  outputPath: string;
  skipTests: boolean;
  skipLinting: boolean;
  skipFormatting: boolean;
  strictMode: boolean;
}

function printHelp(): void {
  console.log(`
🔍 PR Review Checklist Generator

Analyzes your changes and generates a comprehensive PR description with hygiene checks!

Usage:
  bun run agents/pr-review-checklist-generator.ts [options]

Options:
  --branch <name>        Target branch to analyze (default: current branch)
  --base <name>          Base branch to compare against (default: main)
  --output <path>        Output file path (default: ./PR_DESCRIPTION.md)
  --skip-tests           Skip running the test suite
  --skip-linting         Skip running the linter
  --skip-formatting      Skip checking code formatting
  --strict               Enable strict mode (fail on critical issues)
  --help, -h             Show this help message

Examples:
  # Generate PR checklist for current branch
  bun run agents/pr-review-checklist-generator.ts

  # Analyze a specific branch
  bun run agents/pr-review-checklist-generator.ts --branch feature/new-auth

  # Compare against develop branch
  bun run agents/pr-review-checklist-generator.ts --base develop

  # Quick check without running tests
  bun run agents/pr-review-checklist-generator.ts --skip-tests --skip-linting

  # Strict mode - fail if critical issues found
  bun run agents/pr-review-checklist-generator.ts --strict
  `);
}

function parseOptions(): PRChecklistOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawBranch = values.branch;
  const rawBase = values.base;
  const rawOutput = values.output;
  const skipTests = values["skip-tests"] === true;
  const skipLinting = values["skip-linting"] === true;
  const skipFormatting = values["skip-formatting"] === true;
  const strictMode = values.strict === true;

  const branch = typeof rawBranch === "string" && rawBranch.length > 0
    ? rawBranch
    : undefined;

  const baseBranch = typeof rawBase === "string" && rawBase.length > 0
    ? rawBase
    : "main";

  const outputPath = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : "./PR_DESCRIPTION.md";

  return {
    branch,
    baseBranch,
    outputPath,
    skipTests,
    skipLinting,
    skipFormatting,
    strictMode,
  };
}

function buildPrompt(options: PRChecklistOptions): string {
  const { branch, baseBranch, outputPath, skipTests, skipLinting, skipFormatting, strictMode } = options;

  console.log('🔍 PR Review Checklist Generator\n');
  console.log(`Base Branch: ${baseBranch}`);
  if (branch) console.log(`Target Branch: ${branch}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Strict Mode: ${strictMode ? 'ON' : 'OFF'}\n`);

  const branchContext = branch ? `branch "${branch}"` : 'current branch';

  return `You are a PR Review Checklist Generator. Your mission is to analyze the ${branchContext} and create a comprehensive PR description with a hygiene checklist.

## Your Task

Generate a thorough PR description that will help reviewers understand the changes and ensure code quality standards are met.

### Phase 1: Code Hygiene Scan

1. **Analyze Changed Files**
   Use Bash to identify changed files:
   \`\`\`bash
   git diff --name-only ${baseBranch}${branch ? ` ${branch}` : ''}
   \`\`\`

2. **Scan for Debug Code**
   Use Grep to find issues in changed files:
   - Search for \`console.log\`, \`console.debug\`, \`console.warn\` (JavaScript/TypeScript)
   - Search for \`debugger\` statements
   - Search for \`print(\`, \`println\`, \`pprint(\` (Python)
   - Search for commented-out code blocks (lines starting with // or # that contain function calls)
   - Search for \`TODO\`, \`FIXME\`, \`HACK\`, \`XXX\` comments

3. **Identify Test Coverage**
   - Find all test files in the repository (look for *.test.*, *.spec.*, __tests__ directories)
   - Analyze changed source files and check if corresponding test files exist
   - Look for new functions/classes without test coverage
   - List files that need test coverage

4. **Find Potential Reviewers**
   Use git blame to identify the main contributors to changed files:
   \`\`\`bash
   git log ${baseBranch}${branch ? `..${branch}` : ''} --pretty=format:"%an" --no-merges | sort | uniq -c | sort -rn | head -5
   \`\`\`

### Phase 2: Run Quality Checks

${!skipLinting ? `
5. **Run Linter**
   - Check for a linter configuration (eslint, tslint, pylint, rubocop, etc.)
   - Run the appropriate linter on changed files
   - Capture and summarize linting errors/warnings
` : ''}

${!skipFormatting ? `
6. **Run Formatter Check**
   - Check for formatter configuration (prettier, black, gofmt, etc.)
   - Run formatter in check mode to identify unformatted files
   - List files that need formatting
` : ''}

${!skipTests ? `
7. **Run Test Suite**
   - Identify the test command (npm test, pytest, cargo test, etc.)
   - Run the test suite
   - Capture test results (pass/fail counts)
   - ${strictMode ? 'FAIL if any tests are failing' : 'Report test failures as warnings'}
` : ''}

### Phase 3: Analyze Changes

8. **Summarize Changes**
   Use Bash to get a summary of changes:
   \`\`\`bash
   git diff ${baseBranch}${branch ? ` ${branch}` : ''} --stat
   git diff ${baseBranch}${branch ? ` ${branch}` : ''} --shortstat
   \`\`\`

9. **Identify Change Categories**
   Analyze the git diff to categorize changes:
   - New features
   - Bug fixes
   - Refactoring
   - Documentation
   - Tests
   - Configuration changes
   - Dependencies updates

10. **Extract Commit Messages**
    \`\`\`bash
    git log ${baseBranch}${branch ? `..${branch}` : ''} --pretty=format:"%s" --no-merges
    \`\`\`

### Phase 4: Generate PR Description

Create a comprehensive PR description with the following structure:

\`\`\`markdown
# [Title derived from commit messages or main change]

## Summary
[2-3 sentence summary of the changes and their purpose]

## Changes
- [Bullet list of key changes organized by category]
- [Include file names and what changed]

## Motivation
[Why these changes were needed - infer from commits and code changes]

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] All tests passing

## Code Quality Checklist
- [ ] No console.log or debug statements
- [ ] No commented-out code
- [ ] Linter passing
- [ ] Code formatted
- [ ] No TODOs or FIXMEs (or documented in issues)

## Review Notes
[Specific areas that need careful review]
[Potential edge cases or concerns]

## Suggested Reviewers
[List of suggested reviewers based on git blame]

---

## 🤖 Automated Analysis Results

### Files Changed
[List of changed files with line counts]

### Issues Found
${strictMode ? '**Strict Mode: ON** - PR will be blocked if critical issues are found' : ''}

#### 🚨 Critical Issues
[Issues that must be fixed before merge]

#### ⚠️ Warnings
[Issues that should be addressed but may not block merge]

#### ✅ Passed Checks
[List of checks that passed]

### Test Results
[Test suite results]

### Potential Reviewers
[List with contribution counts]
\`\`\`

### Phase 5: Write the PR Description

Use the Write tool to save the PR description to: ${outputPath}

## Guidelines
- Be thorough and specific in your analysis
- Flag critical issues that would block the PR
- Provide actionable feedback for each issue found
- Make the PR description clear and easy to review
- Include specific file names and line numbers when referencing issues
- ${strictMode ? 'In strict mode, fail the agent if critical issues are found' : 'Always complete successfully but clearly mark critical issues'}
- Format the output professionally with proper markdown

Start by analyzing the changed files.`;
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["branch", "base", "output", "skip-tests", "skip-linting", "skip-formatting", "strict", "help", "h"] as const;

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

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Bash",
  "Read",
  "Glob",
  "Grep",
  "Write",
  "TodoWrite",
];

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
    console.log("\n✨ PR Review Checklist Generated!\n");
    console.log(`📄 Your PR description is ready at: ${options.outputPath}`);
    console.log("\n💡 Tip: Review the checklist before creating your PR!");
    console.log("💡 Use this as your PR description template.");
  }

  if (exitCode !== 0 && options.strictMode) {
    console.log('\n🚨 Strict mode: Exiting with error due to critical issues found.');
  }

  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
