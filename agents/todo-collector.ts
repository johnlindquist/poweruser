#!/usr/bin/env bun

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
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const PROJECT_PATH = process.argv[2] || process.cwd();
const CREATE_ISSUES = process.argv.includes('--create-issues');
const OUTPUT_FILE = process.argv.includes('--output')
  ? process.argv[process.argv.indexOf('--output') + 1] || 'TODO.md'
  : 'TODO.md';

async function main() {
  console.log('📝 TODO Collector');
  console.log(`📁 Scanning project: ${PROJECT_PATH}`);
  console.log(`📄 Output file: ${OUTPUT_FILE}`);
  if (CREATE_ISSUES) {
    console.log('🎫 Will create GitHub issues for TODOs');
  }
  console.log();

  const systemPrompt = `You are a TODO Collector agent that helps developers track scattered TODO comments across their codebase.

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

${CREATE_ISSUES ? '5. Create GitHub issues for high-priority TODOs (FIXME, BUG, XXX) using gh CLI' : ''}

Use Grep to find TODO comments efficiently, Bash (git blame) to get author/date info, and Write to generate the report.

IMPORTANT:
- Search for common comment patterns across multiple languages (// TODO, # TODO, /* TODO */, etc.)
- Parse the TODO text carefully to extract meaningful descriptions
- Calculate age in days from git blame timestamps
- Group logically for easy action planning
- Make the report actionable with clear priorities`;

  const prompt = `Scan the project at: ${PROJECT_PATH} and collect all TODO-style comments.

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

5. Generate a markdown report saved as '${OUTPUT_FILE}' with:

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

${CREATE_ISSUES ? `
6. After generating the report, create GitHub issues:
   - Use 'gh issue create' for each Priority 1 TODO
   - Include file location, description, and author info
   - Add labels like 'technical-debt', 'bug', 'refactor'
   - Link back to the source code location
` : ''}

Start by scanning the codebase efficiently with Grep, then enrich with git blame data.`;

  try {
    const result = query({
      prompt,
      options: {
        cwd: PROJECT_PATH,
        systemPrompt,
        allowedTools: [
          'Glob',
          'Grep',
          'Read',
          'Bash',
          'Write'
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
          console.log('\n✅ TODO collection complete!');
          console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
          console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`📊 Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);

          if (message.result) {
            console.log('\n' + message.result);
          }

          console.log(`\n📄 Report saved to: ${OUTPUT_FILE}`);

          if (!CREATE_ISSUES) {
            console.log('💡 Run with --create-issues to automatically create GitHub issues for high-priority TODOs');
          }
        } else {
          console.error('\n❌ TODO collection failed:', message.subtype);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error running TODO collector:', error);
    process.exit(1);
  }
}

main();
