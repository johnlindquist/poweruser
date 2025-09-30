#!/usr/bin/env bun

/**
 * Duplicate Code Detector Agent
 *
 * A tiny task agent that finds copy-pasted code quickly:
 * - Scans all files for duplicate or near-duplicate code blocks
 * - Identifies copy-paste patterns with configurable similarity thresholds
 * - Reports exact locations and similarity percentages for each duplicate
 * - Suggests consolidation opportunities using functions or shared modules
 * - Flags potential bugs where duplicated code was modified in one place but not others
 * - Prioritizes duplicates by potential impact (size, complexity, duplication count)
 * - Generates a quick summary report with file paths and line numbers
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const PROJECT_PATH = process.argv[2] || process.cwd();
const MIN_LINES = parseInt(process.argv.find(arg => arg.startsWith('--min-lines='))?.split('=')[1] || '5');
const SIMILARITY_THRESHOLD = parseInt(process.argv.find(arg => arg.startsWith('--similarity='))?.split('=')[1] || '85');
const OUTPUT_FILE = process.argv.includes('--output')
  ? process.argv[process.argv.indexOf('--output') + 1] || 'duplicate-code-report.md'
  : 'duplicate-code-report.md';

async function main() {
  console.log('🔍 Duplicate Code Detector');
  console.log(`📁 Scanning project: ${PROJECT_PATH}`);
  console.log(`📏 Minimum lines: ${MIN_LINES}`);
  console.log(`🎯 Similarity threshold: ${SIMILARITY_THRESHOLD}%`);
  console.log(`📄 Output file: ${OUTPUT_FILE}`);
  console.log();

  const systemPrompt = `You are a Duplicate Code Detector agent that helps developers find copy-pasted code.

Your task is to:
1. Scan the codebase for duplicate or near-duplicate code blocks:
   - Focus on functions, methods, and significant code blocks (${MIN_LINES}+ lines)
   - Look for exact duplicates and near-duplicates (${SIMILARITY_THRESHOLD}%+ similar)
   - Detect patterns like copy-paste with minor variable name changes
   - Identify duplicated logic with slightly different implementations

2. For each duplicate found:
   - Record all locations (file paths and line numbers)
   - Calculate similarity percentage
   - Extract the duplicated code snippet
   - Count how many times it appears
   - Assess complexity and size (lines of code)
   - Check if duplicates have diverged (modified in some places but not others)

3. Prioritize duplicates by impact:
   - High: Large complex blocks (50+ lines) duplicated 3+ times
   - Medium: Medium blocks (20-50 lines) duplicated 2+ times
   - Low: Small blocks (${MIN_LINES}-20 lines) duplicated 2+ times

4. Generate a comprehensive duplicate report with:
   - Executive summary (total duplicates, lines of duplicated code, potential savings)
   - Duplicates grouped by priority (High/Medium/Low)
   - For each duplicate:
     - Similarity score
     - Number of occurrences
     - File locations with line numbers
     - Code snippet preview
     - Suggested refactoring approach (extract function, create utility, etc.)
     - Potential bugs from divergent duplicates
   - Refactoring recommendations prioritized by ROI

Use Grep to find similar patterns, Read to analyze code structure, and Write to generate the report.

IMPORTANT:
- Search across all source files (JS/TS/Python/Go/Rust/Java/etc.)
- Skip test files, node_modules, and build artifacts
- Focus on meaningful duplicates (not just imports or boilerplate)
- Provide actionable refactoring suggestions
- Highlight cases where duplicates have diverged (potential bugs)
- Calculate potential line savings from consolidation`;

  const prompt = `Scan the project at: ${PROJECT_PATH} to find duplicate code blocks.

Follow these steps:

## Step 1: Understand Project Structure
- Use Glob to identify what file types are present
- Determine project language(s) and framework(s)
- Identify which directories to scan (skip node_modules, dist, build, etc.)

## Step 2: Find Duplicate Code Patterns
Use Grep strategically to find potential duplicates:
- Search for common function/method patterns
- Look for repeated imports or setup code
- Find similar variable declarations
- Identify repeated error handling patterns

## Step 3: Analyze Code Blocks
For each potential duplicate:
- Read the full code context
- Compare blocks for similarity
- Calculate similarity percentage (exact match = 100%, minor differences = 85-99%)
- Identify what's different between copies
- Determine if differences are intentional or bugs

## Step 4: Categorize by Impact
Prioritize by:
1. Size (lines of code in each duplicate)
2. Complexity (nested logic, number of operations)
3. Frequency (how many times duplicated)
4. Maintenance risk (has the code diverged?)

## Step 5: Generate Report
Save as '${OUTPUT_FILE}' with:

# Duplicate Code Report

## Summary
- Total duplicates found: X
- Lines of duplicated code: X
- Potential line savings: X (after consolidation)
- High priority duplicates: X
- Medium priority duplicates: X
- Low priority duplicates: X

## High Priority Duplicates 🚨

### Duplicate #1: [Function/Pattern Name]
- **Similarity**: 95%
- **Occurrences**: 4 locations
- **Size**: 45 lines each
- **Potential Savings**: 135 lines
- **Locations**:
  1. \`src/utils/validator.ts:123-168\`
  2. \`src/api/auth.ts:45-90\`
  3. \`src/services/user.ts:234-279\`
  4. \`src/lib/helpers.ts:89-134\`

**Code Preview**:
\`\`\`typescript
// Common code pattern found
function validateInput(data: any) {
  if (!data) throw new Error('Invalid input');
  // ... 40 more lines
}
\`\`\`

**Refactoring Suggestion**:
Extract to a shared utility function in \`src/utils/validation.ts\`:
\`\`\`typescript
export function validateInput(data: any) { ... }
\`\`\`

**Divergence Warning**: ⚠️  The copy in \`auth.ts\` has an additional null check that others don't have. This could be a bug in the other locations.

## Medium Priority Duplicates ⚠️
[Same format]

## Low Priority Duplicates 💡
[Same format]

## Refactoring Roadmap
1. Start with high-priority duplicates (biggest ROI)
2. Create shared utilities/helpers
3. Update all duplicate locations to use new shared code
4. Add tests for the consolidated code
5. Review divergent duplicates for bugs

## Statistics
- Most duplicated pattern: [Pattern name]
- File with most duplicates: [File path]
- Estimated effort to consolidate: X hours
- Estimated maintenance time saved annually: X hours

Focus on finding meaningful duplicates that justify refactoring. Be thorough but finish quickly (under 15 seconds).`;

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
          console.log('\n✅ Duplicate detection complete!');
          console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
          console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`📊 Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);

          if (message.result) {
            console.log('\n' + message.result);
          }

          console.log(`\n📄 Report saved to: ${OUTPUT_FILE}`);
          console.log('\n💡 Tips:');
          console.log('  - Focus on high-priority duplicates first');
          console.log('  - Check divergent duplicates for potential bugs');
          console.log('  - Extract common patterns to shared utilities');
        } else {
          console.error('\n❌ Duplicate detection failed:', message.subtype);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error running duplicate code detector:', error);
    process.exit(1);
  }
}

main();
