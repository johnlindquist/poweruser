#!/usr/bin/env -S bun run

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
 *
 * Usage:
 *   bun run agents/duplicate-code-detector.ts [path] [options]
 *
 * Examples:
 *   # Detect duplicates in current directory
 *   bun run agents/duplicate-code-detector.ts
 *
 *   # Scan specific project
 *   bun run agents/duplicate-code-detector.ts /path/to/project
 *
 *   # Customize detection parameters
 *   bun run agents/duplicate-code-detector.ts --min-lines 10 --similarity 90
 *
 *   # Custom output file
 *   bun run agents/duplicate-code-detector.ts --output my-report.md
 */

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface DuplicateDetectorOptions {
  projectPath: string;
  minLines: number;
  similarityThreshold: number;
  outputFile: string;
}

const DEFAULT_MIN_LINES = 5;
const DEFAULT_SIMILARITY = 85;
const DEFAULT_OUTPUT_FILE = "duplicate-code-report.md";

function printHelp(): void {
  console.log(`
🔍 Duplicate Code Detector

Usage:
  bun run agents/duplicate-code-detector.ts [path] [options]

Arguments:
  path                    Project path to scan (default: current directory)

Options:
  --min-lines <number>    Minimum lines for duplicate detection (default: ${DEFAULT_MIN_LINES})
  --similarity <number>   Similarity threshold percentage (default: ${DEFAULT_SIMILARITY})
  --output <file>         Output report file (default: ${DEFAULT_OUTPUT_FILE})
  --help, -h              Show this help

Examples:
  bun run agents/duplicate-code-detector.ts
  bun run agents/duplicate-code-detector.ts ./src
  bun run agents/duplicate-code-detector.ts --min-lines 10 --similarity 90
  bun run agents/duplicate-code-detector.ts --output my-report.md
  `);
}

function parseOptions(): DuplicateDetectorOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const projectPath = positionals[0] ? resolve(positionals[0]) : process.cwd();

  const rawMinLines = values["min-lines"] || values.minLines;
  const rawSimilarity = values.similarity;
  const rawOutput = values.output;

  const minLines = typeof rawMinLines === "string" && rawMinLines.length > 0
    ? parseInt(rawMinLines, 10)
    : DEFAULT_MIN_LINES;

  const similarityThreshold = typeof rawSimilarity === "string" && rawSimilarity.length > 0
    ? parseInt(rawSimilarity, 10)
    : DEFAULT_SIMILARITY;

  const outputFile = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : DEFAULT_OUTPUT_FILE;

  if (isNaN(minLines) || minLines < 1) {
    console.error("❌ Error: min-lines must be a positive number");
    process.exit(1);
  }

  if (isNaN(similarityThreshold) || similarityThreshold < 0 || similarityThreshold > 100) {
    console.error("❌ Error: similarity must be between 0 and 100");
    process.exit(1);
  }

  return {
    projectPath,
    minLines,
    similarityThreshold,
    outputFile,
  };
}

function buildSystemPrompt(options: DuplicateDetectorOptions): string {
  const { minLines, similarityThreshold } = options;

  return `You are a Duplicate Code Detector agent that helps developers find copy-pasted code.

Your task is to:
1. Scan the codebase for duplicate or near-duplicate code blocks:
   - Focus on functions, methods, and significant code blocks (${minLines}+ lines)
   - Look for exact duplicates and near-duplicates (${similarityThreshold}%+ similar)
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
   - Low: Small blocks (${minLines}-20 lines) duplicated 2+ times

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
}

function buildPrompt(options: DuplicateDetectorOptions): string {
  const { projectPath, minLines, similarityThreshold, outputFile } = options;

  return `Scan the project at: ${projectPath} to find duplicate code blocks.

Configuration:
- Minimum lines for detection: ${minLines}
- Similarity threshold: ${similarityThreshold}%
- Output file: ${outputFile}

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
For each potential duplicate (minimum ${minLines}+ lines):
- Read the full code context
- Compare blocks for similarity
- Calculate similarity percentage (exact match = 100%, minor differences = ${similarityThreshold}-99%)
- Identify what's different between copies
- Determine if differences are intentional or bugs

## Step 4: Categorize by Impact
Prioritize by:
1. Size (lines of code in each duplicate)
2. Complexity (nested logic, number of operations)
3. Frequency (how many times duplicated)
4. Maintenance risk (has the code diverged?)

## Step 5: Generate Report
Save as '${outputFile}' with:

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

Focus on finding meaningful duplicates that justify refactoring. Be thorough but finish quickly.`;
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["min-lines", "minLines", "similarity", "output", "help", "h"] as const;

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

console.log("🔍 Duplicate Code Detector\n");
console.log(`📁 Project: ${options.projectPath}`);
console.log(`📏 Minimum lines: ${options.minLines}`);
console.log(`🎯 Similarity threshold: ${options.similarityThreshold}%`);
console.log(`📄 Output file: ${options.outputFile}`);
console.log("");

// Change to project directory if different from cwd
const originalCwd = process.cwd();
if (options.projectPath !== originalCwd) {
  process.chdir(options.projectPath);
}

const prompt = buildPrompt(options);
const systemPrompt = buildSystemPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Glob",
  "Grep",
  "Read",
  "Bash",
  "Write",
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  'append-system-prompt': systemPrompt,
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
};

try {
  const exitCode = await claude(prompt, defaultFlags);

  // Restore original directory
  if (options.projectPath !== originalCwd) {
    process.chdir(originalCwd);
  }

  if (exitCode === 0) {
    console.log("\n✅ Duplicate detection complete!\n");
    console.log(`📄 Report saved to: ${options.outputFile}`);
    console.log("\n💡 Tips:");
    console.log("  - Focus on high-priority duplicates first");
    console.log("  - Check divergent duplicates for potential bugs");
    console.log("  - Extract common patterns to shared utilities");
  }
  process.exit(exitCode);
} catch (error) {
  // Restore original directory on error
  if (options.projectPath !== originalCwd) {
    process.chdir(originalCwd);
  }
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
