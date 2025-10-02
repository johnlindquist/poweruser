#!/usr/bin/env -S bun run

/**
 * Open Source Contribution Matchmaker
 *
 * An agent that connects your skills with perfect open source opportunities.
 *
 * Features:
 * - Analyzes your codebase, commit history, and coding patterns
 * - Searches GitHub for projects matching your skillset
 * - Filters for "good first issue" and "help wanted"
 * - Generates personalized contribution strategies
 * - Creates draft PR descriptions
 * - Suggests how to introduce yourself to maintainers
 *
 * Usage:
 *   bun run agents/open-source-contribution-matchmaker.ts [--dir <path>] [--output <file>]
 *
 * Examples:
 *   # Analyze current directory
 *   bun run agents/open-source-contribution-matchmaker.ts
 *
 *   # Analyze specific directory
 *   bun run agents/open-source-contribution-matchmaker.ts --dir ./my-project
 *
 *   # Save results to file
 *   bun run agents/open-source-contribution-matchmaker.ts --output contribution-plan.md
 */

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface ContributionOptions {
  targetDir: string;
  outputFile?: string;
}

const DEFAULT_OUTPUT_FILE = "contribution-plan.md";

function printHelp(): void {
  console.log(`
🔍 Open Source Contribution Matchmaker

Usage:
  bun run agents/open-source-contribution-matchmaker.ts [options]

Options:
  --dir <path>            Directory to analyze (default: current directory)
  --output <file>         Save plan to file (default: print to console)
  --help, -h              Show this help

Examples:
  bun run agents/open-source-contribution-matchmaker.ts
  bun run agents/open-source-contribution-matchmaker.ts --dir ./my-project
  bun run agents/open-source-contribution-matchmaker.ts --output ${DEFAULT_OUTPUT_FILE}
  `);
}

function parseOptions(): ContributionOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawDir = values.dir;
  const rawOutput = values.output;

  const targetDir = typeof rawDir === "string" && rawDir.length > 0
    ? rawDir
    : process.cwd();

  const outputFile = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : undefined;

  return {
    targetDir,
    outputFile,
  };
}

function buildPrompt(options: ContributionOptions): string {
  const { targetDir, outputFile } = options;

  return `
You are an Open Source Contribution Matchmaker. Your goal is to help developers find perfect contribution opportunities.

Target Directory: ${targetDir}
${outputFile ? `Output File: ${outputFile}` : "Output: Console"}

Execute the following multi-phase analysis:

## Phase 1: Skill Analysis
Analyze the codebase in ${targetDir} to identify:
1. Primary programming languages used (with approximate percentage)
   - Use Glob to find file types: *.js, *.ts, *.py, *.go, etc.
   - Count files to estimate language distribution
2. Frameworks and libraries in use
   - Read package.json, requirements.txt, go.mod, Cargo.toml, etc.
   - Identify key dependencies
3. Common coding patterns and practices observed
   - Read a sample of source files
   - Note architectural patterns (MVC, functional, OOP, etc.)
4. Estimate the developer's experience level based on:
   - Code complexity
   - Project structure
   - Testing practices
   - Documentation quality

## Phase 2: Find Opportunities
Search GitHub for 5-10 open source projects that would be perfect contribution opportunities:
- Projects using the same languages/frameworks identified in Phase 1
- Issues labeled "good first issue", "help wanted", or "beginner-friendly"
- Active projects with recent commits (within last 3 months)
- Projects at an appropriate difficulty level based on the skill assessment

For each opportunity, provide:
- Repository name and URL
- Specific issue title and URL
- Why it's a good match for this developer's skills
- Estimated difficulty (Beginner/Intermediate/Advanced)
- Potential impact of the contribution

## Phase 3: Generate Contribution Strategy
Create a comprehensive contribution plan with:
1. Prioritized list of opportunities (easiest to hardest)
2. Step-by-step approach for each opportunity:
   - How to set up the development environment
   - What to read in the codebase first
   - How to approach the specific issue
3. Template for introducing yourself to maintainers
4. Draft PR description template
5. Tips for successful contribution:
   - Communication best practices
   - Code quality expectations
   - How to handle feedback
6. Follow-up strategy after first contribution

## Output Format
Generate a complete markdown document with:

# Open Source Contribution Plan

## Your Skill Profile
[Detailed analysis from Phase 1]

## Matched Opportunities
[List of 5-10 opportunities from Phase 2, ranked by fit and difficulty]

## Contribution Strategy
[Comprehensive strategy from Phase 3]

### Quick Start Guide
1. [First step]
2. [Second step]
3. [Third step]

### Communication Templates
[Templates for reaching out to maintainers]

### Next Steps
- [Actionable checklist]

---
Generated by Open Source Contribution Matchmaker

${outputFile ? `\nSave the complete plan to ${outputFile} using the Write tool.` : ""}

Make it actionable, encouraging, and personalized to this developer's actual skills and experience level.
`.trim();
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["dir", "output", "help", "h"] as const;

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

console.log("🔍 Open Source Contribution Matchmaker\n");
console.log("=" .repeat(50));
console.log(`\nAnalyzing codebase in: ${options.targetDir}`);
if (options.outputFile) {
  console.log(`Output file: ${options.outputFile}`);
}
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

// Store original cwd and change to target directory
const originalCwd = process.cwd();
process.chdir(options.targetDir);

const allowedTools = [
  "Read",
  "Glob",
  "Grep",
  "Bash",
  "WebSearch",
  "Write",
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
};

try {
  const exitCode = await claude(prompt, defaultFlags);

  // Restore original working directory
  process.chdir(originalCwd);

  if (exitCode === 0) {
    console.log("\n✨ Contribution matching complete!\n");
    if (options.outputFile) {
      console.log(`📄 Full plan saved to: ${options.outputFile}`);
    }
    console.log("\n🚀 Ready to start contributing!");
    console.log("💡 Tip: Start with the easiest opportunity to build confidence");
    console.log("💡 Tip: Read the project's CONTRIBUTING.md before starting");
    console.log("💡 Tip: Don't hesitate to ask questions in the issue comments");
  }
  process.exit(exitCode);
} catch (error) {
  // Restore original working directory on error
  process.chdir(originalCwd);
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
