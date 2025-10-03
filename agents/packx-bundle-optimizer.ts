#!/usr/bin/env -S bun run

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
 *
 * Usage:
 *   bun run agents/packx-bundle-optimizer.ts [project-path] <search-topic> [options]
 *
 * Examples:
 *   bun run agents/packx-bundle-optimizer.ts . "authentication" --copy
 *   bun run agents/packx-bundle-optimizer.ts ./src "useState hooks" --max-tokens=30000
 *   bun run agents/packx-bundle-optimizer.ts . "API endpoints" --style=xml --output=api-bundle.xml
 */

import { resolve } from "node:path";
import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type OutputStyle = "markdown" | "xml" | "plain";

interface PackxBundleOptions {
  projectPath: string;
  searchTopic: string;
  maxTokens: number;
  outputFile: string;
  copyToClipboard: boolean;
  style: OutputStyle;
  includeTests: boolean;
}

const DEFAULT_MAX_TOKENS = 50000;
const DEFAULT_OUTPUT_FILE = "packx-bundle.md";
const DEFAULT_STYLE: OutputStyle = "markdown";

function printHelp(): void {
  console.log(`
📦 Packx Bundle Optimizer

Usage:
  bun run agents/packx-bundle-optimizer.ts [project-path] <search-topic> [options]

Arguments:
  project-path            Path to project directory (default: current directory)
  search-topic            Topic to search for (required)

Options:
  --max-tokens <n>        Maximum token count (default: ${DEFAULT_MAX_TOKENS})
  --output <file>         Output file name (default: ${DEFAULT_OUTPUT_FILE})
  --copy                  Copy result to clipboard
  --style <format>        Output format: markdown, xml, plain (default: ${DEFAULT_STYLE})
  --include-tests         Include test files in the bundle
  --help, -h              Show this help

Examples:
  bun run agents/packx-bundle-optimizer.ts . "authentication" --copy
  bun run agents/packx-bundle-optimizer.ts ./src "useState hooks" --max-tokens=30000
  bun run agents/packx-bundle-optimizer.ts . "API endpoints" --style=xml --output=api-bundle.xml
  `);
}

function parseOptions(): PackxBundleOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const projectPath = positionals[0] || process.cwd();
  const searchTopic = positionals[1];

  if (!searchTopic) {
    console.error("❌ Error: Search topic is required");
    printHelp();
    process.exit(1);
  }

  const rawMaxTokens = values["max-tokens"] || values.maxTokens;
  const rawOutput = values.output;
  const rawStyle = values.style;
  const copyToClipboard = values.copy === true;
  const includeTests = values["include-tests"] === true || values.includeTests === true;

  const maxTokens = typeof rawMaxTokens === "string" || typeof rawMaxTokens === "number"
    ? parseInt(String(rawMaxTokens))
    : DEFAULT_MAX_TOKENS;

  const outputFile = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : DEFAULT_OUTPUT_FILE;

  let style: OutputStyle = DEFAULT_STYLE;
  if (typeof rawStyle === "string" && rawStyle.length > 0) {
    const lowerStyle = rawStyle.toLowerCase();
    if (lowerStyle === "markdown" || lowerStyle === "xml" || lowerStyle === "plain") {
      style = lowerStyle;
    } else {
      console.error("❌ Error: Invalid style. Must be markdown, xml, or plain");
      process.exit(1);
    }
  }

  return {
    projectPath: resolve(projectPath),
    searchTopic,
    maxTokens,
    outputFile,
    copyToClipboard,
    style,
    includeTests,
  };
}

function buildSystemPrompt(options: PackxBundleOptions): string {
  const { maxTokens, style, outputFile, copyToClipboard, includeTests } = options;
  const excludeTests = !includeTests;

  return `You are a Packx Bundle Optimizer agent that creates focused, token-efficient code bundles for AI analysis.

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
   - Check if the result is under ${maxTokens} tokens
   - If over the limit, refine the search to be more specific:
     * Add more specific search terms to narrow results
     * Limit to specific file extensions
     * Add exclusion patterns for irrelevant files
     * Use context lines (-l flag) to extract focused snippets instead of full files
   - If under the limit by a large margin, consider broadening to include related code:
     * Add related search terms
     * Include additional relevant file types
   - Iterate until you achieve an optimal bundle close to but under ${maxTokens} tokens

4. Optimize the packx command:
   - Use multiple -s flags for search strings related to the topic
   - Specify relevant -e flags for file extensions
   - Use -x flags to exclude test files${excludeTests ? ' (spec.ts, test.ts, .test.js, .spec.js, __tests__)' : ' if needed'}
   - Use -S flags to exclude files containing irrelevant strings (test, mock, fixture)${excludeTests ? ' if not already excluded' : ''}
   - Consider using -l flag with line count if full files are too large
   - Always use --style ${style} for consistent output format
   - Use -o flag to save to ${outputFile}
   ${copyToClipboard ? '- Use --copy or -c flag to copy results to clipboard' : ''}

5. Report on the bundling process:
   - Explain which search patterns were used and why
   - Show the final packx command that was executed
   - Report the final token count and how it compares to the limit
   - Describe what code was included in the bundle
   - Suggest how the bundle can be used for AI analysis

Use Bash to run packx commands, Glob to understand project structure, and potentially Read to examine config files or understand the codebase better.

IMPORTANT:
- Always check token counts after each packx run (output shows token info)
- Iterate until you get close to ${maxTokens} tokens without going over
- Be strategic about search patterns - too broad wastes tokens, too narrow misses context
- Use context lines (-l flag) as a last resort to reduce size while keeping relevance
- Exclude common noise: node_modules, dist, build, .next, out, coverage are auto-excluded by packx
${excludeTests ? '- Always exclude test files unless they contain implementation details needed for understanding' : ''}
- Prefer multiple specific search terms over single broad terms
- Document your decision-making process for transparency`;
}

function buildPrompt(options: PackxBundleOptions): string {
  const { searchTopic, maxTokens, outputFile, style, copyToClipboard, includeTests } = options;
  const excludeTests = !includeTests;

  return `Create an optimized code bundle for the topic: "${searchTopic}"

Your goal is to create a focused bundle that:
1. Captures all relevant code related to "${searchTopic}"
2. Stays under ${maxTokens.toLocaleString()} tokens
3. Excludes irrelevant code and noise
4. Provides useful context for AI analysis

Follow this workflow:

**Step 1: Analyze the codebase**
- Use Glob to understand the project structure
- Identify which file types are present (TypeScript, JavaScript, Python, etc.)
- Understand the directory layout to identify where relevant code likely lives

**Step 2: Generate search strategy**
Based on the topic "${searchTopic}", identify:
- Primary search terms (exact function/class names if known)
- Secondary search terms (related concepts)
- Relevant file extensions to include
- Files or patterns to exclude${excludeTests ? ' (always exclude test files: *test*, *spec*, __tests__)' : ''}

**Step 3: Execute initial packx search**
Run packx with your initial search strategy:
\`\`\`bash
packx -s "term1" -s "term2" -s "term3" \\
      -e "ts,tsx" \\
      ${excludeTests ? '-x "test.ts" -x "spec.ts" -S "test" -S "mock" \\\n      ' : ''}-o ${outputFile} \\
      --style ${style}${copyToClipboard ? ' \\\n      --copy' : ''}
\`\`\`

**Step 4: Check token count and refine**
After running packx, check the output for token count. Then:

- If **over ${maxTokens} tokens:**
  1. Make search more specific (add more precise terms)
  2. Limit file extensions further
  3. Add exclusions for irrelevant files
  4. Consider using -l flag to extract context windows (e.g., -l 20 for 20 lines around matches)
  5. Re-run packx and check again

- If **significantly under ${maxTokens} tokens** (e.g., < ${Math.floor(maxTokens * 0.6)} tokens):
  1. Add related search terms to capture more context
  2. Include additional relevant file types
  3. Broaden the search slightly
  4. Re-run packx and check again

- If **close to ${maxTokens} tokens** (within 80-100% of limit):
  1. Perfect! You've found the optimal bundle
  2. Proceed to final report

**Step 5: Generate final report**
Once you've optimized the bundle, provide a detailed report:

# 📦 Packx Bundle Report: ${searchTopic}

## 🎯 Bundling Strategy

**Search Topic:** ${searchTopic}

**Search Terms Used:**
- Primary: [list primary terms]
- Secondary: [list secondary terms]

**File Extensions:** [list extensions]

**Exclusions:** ${excludeTests ? 'Test files, ' : ''}[other exclusions]

## 🔧 Final Packx Command

\`\`\`bash
[Show the final packx command that produced the optimal result]
\`\`\`

## 📊 Bundle Statistics

- **Token Count:** X,XXX / ${maxTokens.toLocaleString()} (XX% of limit)
- **Files Included:** N files
- **Total Lines:** ~L lines
- **Output Format:** ${style}
- **Output File:** ${outputFile}
${copyToClipboard ? '- **Copied to Clipboard:** Yes ✓' : ''}

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
1. **Code Review:** Understanding the ${searchTopic} implementation
2. **Debugging:** Analyzing issues related to ${searchTopic}
3. **Refactoring:** Planning improvements to ${searchTopic}
4. **Documentation:** Generating docs for ${searchTopic}
5. **AI Analysis:** Providing focused context to LLMs

**Suggested prompts to use with this bundle:**
- "Review this ${searchTopic} implementation for potential issues"
- "Explain how ${searchTopic} works in this codebase"
- "Suggest improvements to the ${searchTopic} implementation"
- "Generate documentation for ${searchTopic}"

## 🔄 Optimization Process

[Describe the iterations you went through to reach the optimal bundle]

**Initial attempt:** X tokens - [too broad/too narrow]
**Refinement 1:** Y tokens - [adjustment made]
**Refinement 2:** Z tokens - [adjustment made]
**Final result:** Z tokens - ✓ Optimal

## 🚀 Next Steps

${copyToClipboard
  ? '1. The bundle is already in your clipboard - paste it into your AI chat\n2. '
  : '1. Open ' + outputFile + ' to view the bundle\n2. Copy the contents to your AI tool of choice\n3. '}Use the suggested prompts above to analyze the code
${!copyToClipboard ? '3' : '2'}. Consider running packx again with refined terms if you need different focus areas

---

**Bundle created:** [timestamp]
**Agent:** Packx Bundle Optimizer

Begin by analyzing the codebase structure, then iteratively refine the packx search until you achieve the optimal bundle!`;
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("📦 Packx Bundle Optimizer\n");
console.log(`📁 Project: ${options.projectPath}`);
console.log(`🔍 Search topic: "${options.searchTopic}"`);
console.log(`🎯 Max tokens: ${options.maxTokens.toLocaleString()}`);
console.log(`📄 Output: ${options.outputFile} (${options.style} format)`);
if (options.copyToClipboard) {
  console.log("📋 Will copy to clipboard");
}
if (!options.includeTests) {
  console.log("🚫 Excluding test files");
}
console.log("");

const systemPrompt = buildSystemPrompt(options);
const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Bash",
  "Glob",
  "Grep",
  "Read",
  "Write",
  "TodoWrite",
];

removeAgentFlags([
    "max-tokens",
    "maxTokens",
    "output",
    "copy",
    "style",
    "include-tests",
    "includeTests",
    "help",
    "h"
  ]);

// Change to project directory before running claude
process.chdir(options.projectPath);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
  "append-system-prompt": systemPrompt,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Bundle optimization complete!\n");
    console.log(`📄 Bundle saved to: ${options.outputFile}`);
    if (options.copyToClipboard) {
      console.log("📋 Bundle copied to clipboard - ready to paste!");
    }
    console.log("\nNext steps:");
    console.log("1. Review the generated bundle");
    console.log("2. Copy to your AI tool of choice");
    console.log("3. Use suggested prompts to analyze the code");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
