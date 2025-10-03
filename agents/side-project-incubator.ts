#!/usr/bin/env -S bun run

/**
 * Side Project Incubator Agent
 *
 * An outside-the-box agent that transforms your skills into actionable side project ideas:
 * - Analyzes your codebase, commit history, and tech stack to identify your strongest skills
 * - Researches current market trends and monetization opportunities
 * - Generates 3-5 complete side project concepts tailored to your skillset
 * - Creates detailed project briefs with problem statements, target audiences, and tech stacks
 * - Develops 90-day MVP roadmaps with weekly milestones
 * - Suggests go-to-market strategies and pricing models
 * - Identifies potential competitors and differentiation strategies
 *
 * Usage:
 *   bun run agents/side-project-incubator.ts [options]
 *
 * Examples:
 *   # Generate ideas from current codebase
 *   bun run agents/side-project-incubator.ts
 *
 *   # Focus on a specific niche
 *   bun run agents/side-project-incubator.ts --niche "developer tools"
 *
 *   # Analyze a different directory
 *   bun run agents/side-project-incubator.ts --path ../my-project
 *
 *   # Specify custom output file
 *   bun run agents/side-project-incubator.ts --output my-ideas.md
 */

import { resolve } from "node:path";
import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface SideProjectOptions {
  projectPath: string;
  niche?: string;
  outputFile: string;
}

const DEFAULT_OUTPUT_FILE = "side-project-ideas.md";

function printHelp(): void {
  console.log(`
🚀 Side Project Incubator

Usage:
  bun run agents/side-project-incubator.ts [options]

Options:
  --niche <domain>        Focus on a specific market niche or domain
  --path <directory>      Path to project/codebase to analyze (default: current directory)
  --output <file>         Output file for ideas (default: ${DEFAULT_OUTPUT_FILE})
  --help, -h              Show this help

Examples:
  bun run agents/side-project-incubator.ts
  bun run agents/side-project-incubator.ts --niche "developer productivity"
  bun run agents/side-project-incubator.ts --path ../my-project --output ideas.md
  `);
}

function parseOptions(): SideProjectOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawPath = values.path;
  const rawNiche = values.niche;
  const rawOutput = values.output;

  const projectPath = typeof rawPath === "string" && rawPath.length > 0
    ? resolve(rawPath)
    : process.cwd();

  const niche = typeof rawNiche === "string" && rawNiche.length > 0
    ? rawNiche
    : undefined;

  const outputFile = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : DEFAULT_OUTPUT_FILE;

  return {
    projectPath,
    niche,
    outputFile,
  };
}

function buildPrompt(options: SideProjectOptions): string {
  const { niche, outputFile } = options;

  return `You are a Side Project Incubator helping a developer discover and plan their next meaningful side project.

Your mission is to:

1. **Analyze their skills** (20% of time):
   - Use Bash to analyze git commit history (git log --pretty=format:"%s" --all | head -50)
   - Read package.json, requirements.txt, go.mod, Cargo.toml, or similar to identify tech stack
   - Use Glob and Grep to identify primary languages, frameworks, and patterns they use
   - Summarize: What are they good at? What do they enjoy building?

2. **Research market opportunities** (30% of time):
   - Use WebSearch to find:
     * Current trends in their tech stack
     * Common pain points developers/users are experiencing
     * Emerging technologies and monetization opportunities
     * Gaps in existing tools/products
   ${niche ? `- Focus specifically on opportunities in the "${niche}" domain` : '- Look broadly across domains where their skills apply'}

3. **Generate 3-5 side project concepts** (50% of time):
   For each idea, create:
   - **Name & Tagline**: Catchy, memorable name with a one-liner
   - **Problem Statement**: What specific problem does this solve?
   - **Target Audience**: Who would pay for/use this?
   - **Core Features**: 5-7 essential features for MVP
   - **Tech Stack**: Recommended stack based on their existing skills
   - **Differentiation**: How is this different from competitors?
   - **Monetization Strategy**: Freemium, SaaS, one-time purchase, ads, etc.
   - **90-Day Roadmap**: Weekly milestones to reach MVP
   - **Go-to-Market**: Initial user acquisition channels and marketing approach
   - **Effort Estimate**: Realistic time commitment (hours per week)
   - **Revenue Potential**: Ballpark estimate based on market research

4. **Write comprehensive report**:
   - Create a file called "${outputFile}" with all findings
   - Include market research insights
   - Add links to competitors and inspiration
   - Provide next steps for getting started

Focus on ideas that:
- Match their existing skills (80% familiar, 20% stretch)
- Solve real problems they or others face
- Can reach MVP in 3 months with part-time effort
- Have clear monetization paths
- Are exciting and motivating to build

Be realistic, encouraging, and specific. This should be a document they can act on immediately.`;
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🚀 Side Project Incubator\n");
console.log(`Project Path: ${options.projectPath}`);
if (options.niche) console.log(`Niche Focus: ${options.niche}`);
console.log(`Output File: ${options.outputFile}`);
console.log("\nAnalyzing your skills and generating personalized project ideas...\n");

// Change to the project directory if different from current
const originalCwd = process.cwd();
if (options.projectPath !== originalCwd) {
  process.chdir(options.projectPath);
}

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Bash",
  "Read",
  "Glob",
  "Grep",
  "WebSearch",
  "WebFetch",
  "Write",
  "TodoWrite",
];

removeAgentFlags([
    "niche", "path", "output", "help", "h"
  ]);

const systemPromptAppend = `You are an expert at identifying market opportunities, understanding developer skills, and creating actionable side project plans. You combine technical expertise with business acumen to help developers build meaningful products.`;

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "acceptEdits",
  "append-system-prompt": systemPromptAppend,
};

try {
  const exitCode = await claude(prompt, defaultFlags);

  // Restore original directory
  if (options.projectPath !== originalCwd) {
    process.chdir(originalCwd);
  }

  if (exitCode === 0) {
    console.log("\n✨ Side project ideas generated!\n");
    console.log(`📄 Full report: ${options.outputFile}`);
    console.log("\nNext steps:");
    console.log("1. Review the generated ideas");
    console.log("2. Pick the idea that excites you most");
    console.log("3. Follow the 90-day roadmap");
    console.log("4. Start building your MVP!");
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
