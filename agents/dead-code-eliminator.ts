#!/usr/bin/env bun

/**
 * Dead Code Eliminator Agent
 *
 * A practical everyday agent that keeps your codebase lean by identifying and safely removing unused code:
 * - Scans for unused functions, variables, imports, and entire files
 * - Analyzes call graphs and dependency chains to ensure safe removal
 * - Detects dead CSS classes, unused TypeScript types, and orphaned test files
 * - Checks for references across the entire codebase including dynamic imports
 * - Generates a prioritized removal plan with risk assessment for each item
 * - Creates backup branches before deletion for safety
 * - Estimates bundle size reduction and performance improvements
 * - Suggests refactoring opportunities for nearly-dead code with minimal usage
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const PROJECT_PATH = process.argv[2] || process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('🗑️  Dead Code Eliminator');
  console.log(`📁 Analyzing project: ${PROJECT_PATH}`);
  console.log(`🔍 Mode: ${DRY_RUN ? 'DRY RUN (analysis only)' : 'REMOVAL MODE'}\n`);

  const systemPrompt = `You are a Dead Code Eliminator agent that helps developers identify and safely remove unused code.

Your task is to:
1. Analyze the project structure and identify potential dead code:
   - Unused functions and methods
   - Unused variables and constants
   - Unused imports and exports
   - Unused TypeScript types and interfaces
   - Dead CSS classes and styles
   - Orphaned test files
   - Entire unused files

2. For each potential dead code item:
   - Search for all references across the codebase using Grep
   - Analyze import statements and call graphs
   - Check for dynamic imports and string-based references
   - Assess the risk level of removal (safe, moderate risk, high risk)
   - Estimate impact on bundle size and performance

3. Generate a comprehensive dead code report with:
   - Executive summary with total potential savings
   - High-confidence removals (zero references found)
   - Moderate-confidence items (minimal references, potentially dead)
   - Low-confidence items (require manual review)
   - Nearly-dead code that could be refactored
   - Estimated bundle size reduction
   - Prioritized removal plan

4. ${DRY_RUN ? 'Save the analysis report only (no deletions)' : 'Create a backup git branch, then safely remove high-confidence dead code'}

Use Glob to find files, Grep to search for references, Read to analyze code, Bash for git operations, and Write to save reports.

IMPORTANT:
- Be conservative. Only mark as "high-confidence" if you find ZERO references
- Consider exports used by external packages or dynamic imports
- Don't remove code that might be used by tests or documentation
- Account for string-based references (e.g., reflection, dynamic requires)
- Create backups before any deletions`;

  const prompt = `Analyze the project at: ${PROJECT_PATH} and identify all dead code.

1. Scan the project structure to understand:
   - Programming languages used (TypeScript, JavaScript, Python, etc.)
   - Build tools and bundlers (webpack, vite, esbuild, etc.)
   - Test frameworks and patterns
   - CSS/styling approach (CSS modules, styled-components, etc.)

2. Find potential dead code candidates:
   - Functions/methods with no references
   - Unused imports and exports
   - Unused TypeScript types/interfaces
   - Dead CSS classes
   - Orphaned files with no imports

3. For each candidate, thoroughly search for references:
   - Direct function calls and imports
   - String-based references (dynamic imports, require statements)
   - Test files that might use the code
   - Documentation and example files
   - Configuration files

4. Assess removal risk for each item:
   - SAFE: Zero references found, not exported publicly
   - MODERATE: Minimal references, might be dead
   - RISKY: Has references but might still be unused

5. Generate a detailed report saved as 'dead-code-analysis.md' with:
   - Summary of findings and potential impact
   - Safe removals list with file paths and line numbers
   - Moderate risk items requiring review
   - Nearly-dead code refactoring opportunities
   - Estimated bundle size savings

${DRY_RUN ? '' : `
6. After generating the report, if there are high-confidence safe removals:
   - Create a git branch named 'dead-code-cleanup'
   - Remove the dead code files or sections
   - Generate a cleanup summary
`}

Start by understanding the project structure, then systematically analyze for dead code.`;

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
          'Write',
          'Edit'
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
          console.log('\n✅ Analysis complete!');
          console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
          console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`📊 Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);

          if (message.result) {
            console.log('\n' + message.result);
          }

          if (DRY_RUN) {
            console.log('\n💡 Run without --dry-run to actually remove dead code');
          }
        } else {
          console.error('\n❌ Analysis failed:', message.subtype);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error running analysis:', error);
    process.exit(1);
  }
}

main();
