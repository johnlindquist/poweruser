#!/usr/bin/env bun

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
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const PROJECT_PATH = process.argv[2] || process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');
const AUTO_RESOLVE = process.argv.includes('--auto-resolve');
const RUN_TESTS = !process.argv.includes('--skip-tests');

async function main() {
  console.log('🔀 Merge Conflict Resolver');
  console.log(`📁 Project: ${PROJECT_PATH}`);
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
  }
  if (AUTO_RESOLVE) {
    console.log('🤖 AUTO-RESOLVE MODE - Will automatically resolve simple conflicts');
  }
  console.log();

  const systemPrompt = `You are a Merge Conflict Resolver agent that helps developers resolve git merge conflicts intelligently.

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

4. For SIMPLE conflicts (only if --auto-resolve flag is set):
   - Automatically resolve by merging both changes intelligently
   - Preserve functionality from both branches when possible
   - Apply consistent formatting
   - Write the resolved file

5. For MODERATE and COMPLEX conflicts:
   - Explain what each side is trying to accomplish
   - Suggest resolution strategies with pros/cons
   - Provide code snippets showing possible resolutions
   - Flag for manual review with clear explanations

6. ${RUN_TESTS ? 'After resolving conflicts, run tests to verify correctness' : 'Skip running tests'}

7. Generate a comprehensive resolution report

Use Bash for git operations, Read to analyze conflicted files, Grep to find related code, ${AUTO_RESOLVE ? 'Write to apply resolutions, ' : ''}and Write to generate the report.

IMPORTANT:
- Never auto-resolve conflicts unless --auto-resolve flag is set
- In dry-run mode, only analyze and suggest - don't modify files
- Preserve the intent of both changes whenever possible
- When in doubt, flag for manual review rather than making incorrect assumptions
- Test after each resolution to catch breaking changes early`;

  const prompt = `Analyze and help resolve merge conflicts in: ${PROJECT_PATH}

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

4. ${AUTO_RESOLVE ? `For SIMPLE conflicts:
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

${RUN_TESTS ? `
6. After resolving any conflicts:
   - Detect test command from package.json, Makefile, or common patterns
   - Run the test suite
   - Report test results
   - If tests fail, suggest rolling back auto-resolutions
` : ''}

7. Generate a markdown report saved as 'MERGE_CONFLICT_REPORT.md':

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

${DRY_RUN ? '\n**DRY RUN MODE** - No files were modified. Review the report and run without --dry-run to apply changes.' : ''}

Start by checking git status to detect conflicts.`;

  try {
    const result = query({
      prompt,
      options: {
        cwd: PROJECT_PATH,
        systemPrompt,
        allowedTools: [
          'Bash',
          'Read',
          'Grep',
          'Glob',
          ...(AUTO_RESOLVE && !DRY_RUN ? ['Write', 'Edit'] : ['Write']) // Only allow Edit for auto-resolve
        ],
        permissionMode: 'bypassPermissions',
        model: 'sonnet',
      }
    });

    for await (const message of result) {
      if (message.type === 'assistant') {
        // Show assistant thinking/working
        for (const block of message.message.content) {
          if (block.type === 'text') {
            console.log(block.text);
          }
        }
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          console.log('\n✅ Conflict analysis complete!');
          console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
          console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`📊 Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);

          if (message.result) {
            console.log('\n' + message.result);
          }

          console.log('\n📄 Report saved to: MERGE_CONFLICT_REPORT.md');

          if (DRY_RUN) {
            console.log('💡 Run without --dry-run to apply suggested resolutions');
          } else if (!AUTO_RESOLVE) {
            console.log('💡 Run with --auto-resolve to automatically fix simple conflicts');
          }
        } else {
          console.error('\n❌ Conflict resolution failed:', message.subtype);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error running merge conflict resolver:', error);
    process.exit(1);
  }
}

main();
