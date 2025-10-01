#!/usr/bin/env bun

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

import { query } from '@anthropic-ai/claude-agent-sdk';

interface PRChecklistOptions {
  branch?: string;
  baseBranch?: string;
  outputPath?: string;
  skipTests?: boolean;
  skipLinting?: boolean;
  skipFormatting?: boolean;
  strictMode?: boolean;
}

async function runPRChecklistGenerator(options: PRChecklistOptions) {
  const {
    branch,
    baseBranch = 'main',
    outputPath = './PR_DESCRIPTION.md',
    skipTests = false,
    skipLinting = false,
    skipFormatting = false,
    strictMode = false,
  } = options;

  console.log('🔍 PR Review Checklist Generator\n');
  console.log(`Base Branch: ${baseBranch}`);
  if (branch) console.log(`Target Branch: ${branch}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Strict Mode: ${strictMode ? 'ON' : 'OFF'}\n`);

  const branchContext = branch ? `branch "${branch}"` : 'current branch';

  const prompt = `You are a PR Review Checklist Generator. Your mission is to analyze the ${branchContext} and create a comprehensive PR description with a hygiene checklist.

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

  const queryStream = query({
    prompt,
    options: {
      cwd: process.cwd(),
      model: 'claude-sonnet-4-5-20250929',
      permissionMode: 'acceptEdits',
      maxTurns: 40,

      allowedTools: [
        'Bash',
        'Read',
        'Glob',
        'Grep',
        'Write',
        'TodoWrite'
      ],

      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  if (input.tool_name === 'Bash') {
                    const command = (input.tool_input as any).command || '';
                    if (command.includes('git diff')) {
                      console.log('📊 Analyzing changed files...');
                    } else if (command.includes('git log')) {
                      console.log('📝 Extracting commit messages...');
                    } else if (command.includes('git blame') || command.includes('--pretty=format')) {
                      console.log('👥 Identifying contributors...');
                    } else if (command.includes('test') || command.includes('jest') || command.includes('pytest')) {
                      console.log('🧪 Running tests...');
                    } else if (command.includes('lint') || command.includes('eslint')) {
                      console.log('🔍 Running linter...');
                    } else if (command.includes('format') || command.includes('prettier')) {
                      console.log('✨ Checking code formatting...');
                    }
                  } else if (input.tool_name === 'Grep') {
                    const pattern = (input.tool_input as any).pattern || '';
                    if (pattern.includes('console.log') || pattern.includes('debugger')) {
                      console.log('🐛 Scanning for debug code...');
                    } else if (pattern.includes('TODO') || pattern.includes('FIXME')) {
                      console.log('📌 Finding TODOs and FIXMEs...');
                    }
                  } else if (input.tool_name === 'Write') {
                    console.log('✍️  Generating PR description...');
                  }
                }
                return { continue: true };
              }
            ]
          }
        ],

        PostToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PostToolUse') {
                  if (input.tool_name === 'Write') {
                    const filePath = (input.tool_input as any).file_path;
                    console.log(`✅ PR description written to: ${filePath}`);
                  }
                }
                return { continue: true };
              }
            ]
          }
        ]
      }
    }
  });

  let startTime = Date.now();
  let checklistComplete = false;
  let hasErrors = false;

  // Stream results
  for await (const message of queryStream) {
    switch (message.type) {
      case 'assistant':
        // Show assistant progress
        for (const block of message.message.content) {
          if (block.type === 'text') {
            const text = block.text;
            // Show important findings
            if (text.includes('Found:') || text.includes('Issue:') || text.includes('Warning:')) {
              console.log(`\n⚠️  ${text.substring(0, 150)}...`);
            } else if (text.includes('✅') || text.includes('Passed:')) {
              console.log(`\n✅ ${text.substring(0, 120)}...`);
            }
          }
        }
        break;

      case 'result':
        checklistComplete = true;
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n' + '='.repeat(60));
        if (message.subtype === 'success') {
          console.log('✨ PR Review Checklist Generated!');
          console.log('='.repeat(60));
          console.log(`📄 Your PR description is ready at: ${outputPath}`);
          console.log(`\n📊 Statistics:`);
          console.log(`   Time: ${elapsedTime}s`);
          console.log(`   Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`   Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);

          if (message.usage.cache_read_input_tokens) {
            console.log(`   Cache hits: ${message.usage.cache_read_input_tokens} tokens`);
          }

          console.log('\n💡 Tip: Review the checklist before creating your PR!');
          console.log('💡 Use this as your PR description template.');
        } else {
          console.log('❌ Error generating checklist');
          console.log('='.repeat(60));
          console.log(`Error type: ${message.subtype}`);
          hasErrors = true;
        }
        break;

      case 'system':
        if (message.subtype === 'init') {
          console.log('🚀 Initializing PR Review Checklist Generator...');
          console.log(`   Model: ${message.model}`);
          console.log(`   Working Directory: ${message.cwd}\n`);
        }
        break;
    }
  }

  if (!checklistComplete) {
    console.log('\n⚠️  Checklist generation was interrupted.');
    hasErrors = true;
  }

  if (hasErrors && strictMode) {
    console.log('\n🚨 Strict mode: Exiting with error due to critical issues found.');
    process.exit(1);
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
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
  process.exit(0);
}

// Parse options
const options: PRChecklistOptions = {
  baseBranch: 'main',
  outputPath: './PR_DESCRIPTION.md',
  skipTests: false,
  skipLinting: false,
  skipFormatting: false,
  strictMode: false,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--branch':
      options.branch = args[++i];
      break;
    case '--base':
      options.baseBranch = args[++i];
      break;
    case '--output':
      options.outputPath = args[++i];
      break;
    case '--skip-tests':
      options.skipTests = true;
      break;
    case '--skip-linting':
      options.skipLinting = true;
      break;
    case '--skip-formatting':
      options.skipFormatting = true;
      break;
    case '--strict':
      options.strictMode = true;
      break;
  }
}

// Run the PR checklist generator
runPRChecklistGenerator(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
