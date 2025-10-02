#!/usr/bin/env -S bun run

/**
 * Learning Path Generator
 *
 * An outside-the-box agent that creates personalized learning roadmaps based on your code.
 *
 * Features:
 * - Analyzes your current codebase and tech stack to understand your skill level
 * - Identifies gaps in your knowledge based on modern best practices and industry trends
 * - Generates a structured learning path with curated resources, exercises, and projects
 * - Suggests open source contributions aligned with your learning goals
 * - Tracks progress by analyzing your new commits and projects over time
 * - Creates portfolio projects that demonstrate your growing expertise
 * - Connects learning objectives to real career opportunities and job requirements
 *
 * Perfect for developers who want to level up but don't know where to focus.
 *
 * Usage:
 *   bun run agents/learning-path-generator.ts [directory] [target-role] [options]
 *
 * Examples:
 *   bun run agents/learning-path-generator.ts
 *   bun run agents/learning-path-generator.ts . "Senior Frontend Engineer"
 *   bun run agents/learning-path-generator.ts ~/projects/my-app "Full Stack Developer"
 *   bun run agents/learning-path-generator.ts . --report custom-path.md
 */

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface LearningPathOptions {
  targetDir: string;
  targetRole: string;
  reportFile: string;
}

const DEFAULT_ROLE = "Senior Software Engineer";
const DEFAULT_REPORT_PREFIX = "learning-path";

function printHelp(): void {
  console.log(`
🎓 Learning Path Generator

Usage:
  bun run agents/learning-path-generator.ts [directory] [target-role] [options]

Arguments:
  directory               Directory to analyze (default: current directory)
  target-role            Target role/position (default: ${DEFAULT_ROLE})

Options:
  --report <file>        Output report filename (default: ${DEFAULT_REPORT_PREFIX}-YYYY-MM-DD.md)
  --help, -h             Show this help

Examples:
  bun run agents/learning-path-generator.ts
  bun run agents/learning-path-generator.ts . "Senior Frontend Engineer"
  bun run agents/learning-path-generator.ts ~/projects/my-app "Full Stack Developer"
  bun run agents/learning-path-generator.ts . "Tech Lead" --report my-path.md
  `);
}

function parseOptions(): LearningPathOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const targetDir = positionals[0] ? resolve(positionals[0]) : process.cwd();
  const targetRole = positionals[1] || DEFAULT_ROLE;

  const rawReport = values.report;
  const reportFile = typeof rawReport === "string" && rawReport.length > 0
    ? rawReport
    : `${DEFAULT_REPORT_PREFIX}-${new Date().toISOString().split('T')[0]}.md`;

  return {
    targetDir,
    targetRole,
    reportFile,
  };
}

function buildPrompt(options: LearningPathOptions): string {
  const { targetDir, targetRole, reportFile } = options;

  return `You are a Learning Path Generator that helps developers create personalized learning roadmaps.

Analyze the codebase at: ${targetDir}

Target role: ${targetRole}

Please perform the following analysis:

1. **Tech Stack Analysis**
   - Identify all languages, frameworks, and tools used in the codebase
   - Use Grep and Glob to find package.json, requirements.txt, Gemfile, go.mod, etc.
   - Analyze the code patterns and architecture to understand skill level
   - Determine which technologies are used most heavily

2. **Skill Gap Identification**
   - Based on the current tech stack, identify what's missing for the target role
   - Use WebSearch to research modern best practices for the target role
   - Compare current skills with industry trends and in-demand technologies
   - Identify specific knowledge gaps (e.g., testing, performance, security, etc.)

3. **Learning Path Generation**
   Create a structured learning roadmap with:
   - 3-5 major learning objectives prioritized by impact
   - For each objective:
     * Why it matters for the target role
     * Estimated time to learn (be realistic)
     * Curated resources (official docs, courses, books, articles)
     * Hands-on exercises and projects to practice
     * How to demonstrate this skill in your portfolio

4. **Open Source Contribution Suggestions**
   - Suggest 5-10 open source projects aligned with learning goals
   - Use WebSearch to find projects in the same tech stack
   - Prioritize projects with "good first issue" tags
   - Explain how contributing to each project will help skill development

5. **Portfolio Project Ideas**
   - Suggest 2-3 portfolio projects that fill skill gaps
   - Projects should demonstrate new skills to potential employers
   - Include: problem statement, tech stack, key features, complexity estimate

6. **Career Connection**
   - Map the learning path to job requirements (use WebSearch for job postings)
   - Estimate timeline to become competitive for target role
   - Suggest how to showcase progress (blog posts, GitHub, LinkedIn)

7. **Progress Tracking Plan**
   - Suggest how to track progress using git commits and projects
   - Create milestones for the first 30, 60, and 90 days
   - Set up a system for regular self-assessment

**Output Format:**
Generate a comprehensive markdown document named \`${reportFile}\` with all the information above, beautifully formatted with:
- Executive summary at the top
- Clear sections with headings and subheadings
- Bullet points and numbered lists
- Links to resources
- Checkboxes for tracking progress
- Motivational language to keep developers engaged

Be specific, actionable, and encouraging. This roadmap should transform aimless learning into a strategic career investment.

IMPORTANT: Write the final learning path to a file using the Write tool.`;
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["report", "help", "h"] as const;

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

console.log("🎓 Learning Path Generator\n");
console.log(`📁 Analyzing directory: ${options.targetDir}`);
console.log(`🎯 Target role: ${options.targetRole}`);
console.log(`📄 Report: ${options.reportFile}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Bash",
  "Read",
  "Grep",
  "Glob",
  "WebSearch",
  "Write",
  "TodoWrite",
];

removeAgentFlags();

// Change working directory to target
const originalCwd = process.cwd();
if (options.targetDir !== originalCwd) {
  process.chdir(options.targetDir);
}

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
  "append-system-prompt": prompt,
};

try {
  const exitCode = await claude("", defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Learning path generated successfully!\n");
    console.log(`📄 Full report: ${options.reportFile}`);
    console.log("\nNext steps:");
    console.log("1. Review your personalized learning roadmap");
    console.log("2. Bookmark recommended resources");
    console.log("3. Set up progress tracking system");
    console.log("4. Start with the first learning objective");
    console.log("5. Consider contributing to suggested open source projects");
  }

  // Restore original working directory
  if (options.targetDir !== originalCwd) {
    process.chdir(originalCwd);
  }

  process.exit(exitCode);
} catch (error) {
  // Restore original working directory on error
  if (options.targetDir !== originalCwd) {
    process.chdir(originalCwd);
  }
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
