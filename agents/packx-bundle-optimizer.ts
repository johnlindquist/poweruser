#!/usr/bin/env bun

/**
 * Packx Bundle Optimizer Agent
 *
 * An intelligent agent that creates focused code bundles under 50k tokens for AI analysis:
 * - Uses packx to search and filter codebase by content patterns and file extensions
 * - Iteratively refines search criteria to stay under the 50k token limit
 * - Analyzes codebases to identify relevant files for specific tasks or features
 * - Creates optimized bundles that include only contextually relevant code
 * - Generates markdown or XML output for easy consumption by LLMs
 * - Automatically excludes test files, build artifacts, and dependencies when requested
 * - Perfect for preparing focused context for code reviews, debugging, or feature analysis
 * - Supports copying directly to clipboard for instant pasting into AI chats
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const PROJECT_PATH = process.argv[2] || process.cwd();
const SEARCH_TOPIC = process.argv[3];
const MAX_TOKENS = parseInt(process.argv.find(arg => arg.startsWith('--max-tokens='))?.split('=')[1] || '50000');
const OUTPUT_FILE = process.argv.find(arg => arg.startsWith('--output='))?.split('=')[1] || 'packx-bundle.md';
const COPY_TO_CLIPBOARD = process.argv.includes('--copy');
const STYLE = process.argv.find(arg => arg.startsWith('--style='))?.split('=')[1] || 'markdown';
const EXCLUDE_TESTS = !process.argv.includes('--include-tests');

async function main() {
  if (!SEARCH_TOPIC) {
    console.error('❌ Error: Search topic is required');
    console.log('\nUsage: bun agents/packx-bundle-optimizer.ts [project-path] <search-topic> [options]');
    console.log('\nOptions:');
    console.log('  --max-tokens=N      Maximum token count (default: 50000)');
    console.log('  --output=FILE       Output file name (default: packx-bundle.md)');
    console.log('  --copy              Copy result to clipboard');
    console.log('  --style=FORMAT      Output format: markdown, xml, plain (default: markdown)');
    console.log('  --include-tests     Include test files in the bundle');
    console.log('\nExamples:');
    console.log('  bun agents/packx-bundle-optimizer.ts . "authentication" --copy');
    console.log('  bun agents/packx-bundle-optimizer.ts ./src "useState hooks" --max-tokens=30000');
    console.log('  bun agents/packx-bundle-optimizer.ts . "API endpoints" --style=xml --output=api-bundle.xml');
    process.exit(1);
  }

  console.log('📦 Packx Bundle Optimizer Agent');
  console.log(`📁 Project: ${PROJECT_PATH}`);
  console.log(`🔍 Search topic: "${SEARCH_TOPIC}"`);
  console.log(`🎯 Max tokens: ${MAX_TOKENS.toLocaleString()}`);
  console.log(`📄 Output: ${OUTPUT_FILE} (${STYLE} format)`);
  if (COPY_TO_CLIPBOARD) {
    console.log('📋 Will copy to clipboard');
  }
  if (EXCLUDE_TESTS) {
    console.log('🚫 Excluding test files');
  }
  console.log();

  const systemPrompt = `You are a Packx Bundle Optimizer agent that creates focused, token-efficient code bundles for AI analysis.

Your task is to:
1. Understand the search topic and identify relevant search patterns:
   - Break down the topic into multiple search strings
   - Identify key terms, function names, class names, etc.
   - Consider related terminology and synonyms
   - Think about file naming conventions related to the topic

2. Analyze the codebase to understand its structure:
   - Use Glob to identify file types and project structure
   - Determine which file extensions are relevant (.ts, .tsx, .js, .jsx, .py, .go, etc.)
   - Identify which directories contain relevant code vs. build artifacts/dependencies

3. Use packx iteratively to create an optimized bundle:
   - Start with a broad search using multiple related search strings
   - Run packx with the identified search patterns and file extensions
   - Check if the result is under ${MAX_TOKENS} tokens
   - If over the limit, refine the search to be more specific:
     * Add more specific search terms to narrow results
     * Limit to specific file extensions
     * Add exclusion patterns for irrelevant files
     * Use context lines (-l flag) to extract focused snippets instead of full files
   - If under the limit by a large margin, consider broadening to include related code:
     * Add related search terms
     * Include additional relevant file types
   - Iterate until you achieve an optimal bundle close to but under ${MAX_TOKENS} tokens

4. Optimize the packx command:
   - Use multiple -s flags for search strings related to the topic
   - Specify relevant -e flags for file extensions
   - Use -x flags to exclude test files${EXCLUDE_TESTS ? ' (spec.ts, test.ts, .test.js, .spec.js, __tests__)' : ' if needed'}
   - Use -S flags to exclude files containing irrelevant strings (test, mock, fixture)${EXCLUDE_TESTS ? ' if not already excluded' : ''}
   - Consider using -l flag with line count if full files are too large
   - Always use --style ${STYLE} for consistent output format
   - Use -o flag to save to ${OUTPUT_FILE}
   ${COPY_TO_CLIPBOARD ? '- Use --copy or -c flag to copy results to clipboard' : ''}

5. Report on the bundling process:
   - Explain which search patterns were used and why
   - Show the final packx command that was executed
   - Report the final token count and how it compares to the limit
   - Describe what code was included in the bundle
   - Suggest how the bundle can be used for AI analysis

Use Bash to run packx commands, Glob to understand project structure, and potentially Read to examine config files or understand the codebase better.

IMPORTANT:
- Always check token counts after each packx run (output shows token info)
- Iterate until you get close to ${MAX_TOKENS} tokens without going over
- Be strategic about search patterns - too broad wastes tokens, too narrow misses context
- Use context lines (-l flag) as a last resort to reduce size while keeping relevance
- Exclude common noise: node_modules, dist, build, .next, out, coverage are auto-excluded by packx
${EXCLUDE_TESTS ? '- Always exclude test files unless they contain implementation details needed for understanding' : ''}
- Prefer multiple specific search terms over single broad terms
- Document your decision-making process for transparency`;

  const prompt = `Create an optimized code bundle for the topic: "${SEARCH_TOPIC}"

Your goal is to create a focused bundle that:
1. Captures all relevant code related to "${SEARCH_TOPIC}"
2. Stays under ${MAX_TOKENS.toLocaleString()} tokens
3. Excludes irrelevant code and noise
4. Provides useful context for AI analysis

Follow this workflow:

**Step 1: Analyze the codebase**
- Use Glob to understand the project structure
- Identify which file types are present (TypeScript, JavaScript, Python, etc.)
- Understand the directory layout to identify where relevant code likely lives

**Step 2: Generate search strategy**
Based on the topic "${SEARCH_TOPIC}", identify:
- Primary search terms (exact function/class names if known)
- Secondary search terms (related concepts)
- Relevant file extensions to include
- Files or patterns to exclude${EXCLUDE_TESTS ? ' (always exclude test files: *test*, *spec*, __tests__)' : ''}

**Step 3: Execute initial packx search**
Run packx with your initial search strategy:
\`\`\`bash
packx -s "term1" -s "term2" -s "term3" \\
      -e "ts,tsx" \\
      ${EXCLUDE_TESTS ? '-x "test.ts" -x "spec.ts" -S "test" -S "mock" \\\n      ' : ''}-o ${OUTPUT_FILE} \\
      --style ${STYLE}${COPY_TO_CLIPBOARD ? ' \\\n      --copy' : ''}
\`\`\`

**Step 4: Check token count and refine**
After running packx, check the output for token count. Then:

- If **over ${MAX_TOKENS} tokens:**
  1. Make search more specific (add more precise terms)
  2. Limit file extensions further
  3. Add exclusions for irrelevant files
  4. Consider using -l flag to extract context windows (e.g., -l 20 for 20 lines around matches)
  5. Re-run packx and check again

- If **significantly under ${MAX_TOKENS} tokens** (e.g., < ${Math.floor(MAX_TOKENS * 0.6)} tokens):
  1. Add related search terms to capture more context
  2. Include additional relevant file types
  3. Broaden the search slightly
  4. Re-run packx and check again

- If **close to ${MAX_TOKENS} tokens** (within 80-100% of limit):
  1. Perfect! You've found the optimal bundle
  2. Proceed to final report

**Step 5: Generate final report**
Once you've optimized the bundle, provide a detailed report:

# 📦 Packx Bundle Report: ${SEARCH_TOPIC}

## 🎯 Bundling Strategy

**Search Topic:** ${SEARCH_TOPIC}

**Search Terms Used:**
- Primary: [list primary terms]
- Secondary: [list secondary terms]

**File Extensions:** [list extensions]

**Exclusions:** ${EXCLUDE_TESTS ? 'Test files, ' : ''}[other exclusions]

## 🔧 Final Packx Command

\`\`\`bash
[Show the final packx command that produced the optimal result]
\`\`\`

## 📊 Bundle Statistics

- **Token Count:** X,XXX / ${MAX_TOKENS.toLocaleString()} (XX% of limit)
- **Files Included:** N files
- **Total Lines:** ~L lines
- **Output Format:** ${STYLE}
- **Output File:** ${OUTPUT_FILE}
${COPY_TO_CLIPBOARD ? '- **Copied to Clipboard:** Yes ✓' : ''}

## 📝 What's Included

**Files bundled:**
1. path/to/file1.ts - Brief description of what this file contains
2. path/to/file2.tsx - Brief description
3. ...

**Key code areas:**
- [Feature/module 1]: X files covering [description]
- [Feature/module 2]: Y files covering [description]

## 💡 How to Use This Bundle

This bundle is optimized for:
1. **Code Review:** Understanding the ${SEARCH_TOPIC} implementation
2. **Debugging:** Analyzing issues related to ${SEARCH_TOPIC}
3. **Refactoring:** Planning improvements to ${SEARCH_TOPIC}
4. **Documentation:** Generating docs for ${SEARCH_TOPIC}
5. **AI Analysis:** Providing focused context to LLMs

**Suggested prompts to use with this bundle:**
- "Review this ${SEARCH_TOPIC} implementation for potential issues"
- "Explain how ${SEARCH_TOPIC} works in this codebase"
- "Suggest improvements to the ${SEARCH_TOPIC} implementation"
- "Generate documentation for ${SEARCH_TOPIC}"

## 🔄 Optimization Process

[Describe the iterations you went through to reach the optimal bundle]

**Initial attempt:** X tokens - [too broad/too narrow]
**Refinement 1:** Y tokens - [adjustment made]
**Refinement 2:** Z tokens - [adjustment made]
**Final result:** Z tokens - ✓ Optimal

## 🚀 Next Steps

${COPY_TO_CLIPBOARD
  ? '1. The bundle is already in your clipboard - paste it into your AI chat\n2. '
  : '1. Open ' + OUTPUT_FILE + ' to view the bundle\n2. Copy the contents to your AI tool of choice\n3. '}Use the suggested prompts above to analyze the code
${!COPY_TO_CLIPBOARD ? '3' : '2'}. Consider running packx again with refined terms if you need different focus areas

---

**Bundle created:** [timestamp]
**Agent:** Packx Bundle Optimizer

Begin by analyzing the codebase structure, then iteratively refine the packx search until you achieve the optimal bundle!`;

  try {
    const result = query({
      prompt,
      options: {
        cwd: PROJECT_PATH,
        systemPrompt,
        allowedTools: [
          'Bash',
          'Glob',
          'Grep',
          'Read',
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
          console.log('\n✅ Bundle optimization complete!');
          console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
          console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`📊 Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);

          if (message.result) {
            console.log('\n' + message.result);
          }

          console.log(`\n📄 Bundle saved to: ${OUTPUT_FILE}`);
          if (COPY_TO_CLIPBOARD) {
            console.log('📋 Bundle copied to clipboard - ready to paste!');
          }
        } else {
          console.error('\n❌ Bundle optimization failed:', message.subtype);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error running Packx Bundle Optimizer:', error);
    process.exit(1);
  }
}

main();
