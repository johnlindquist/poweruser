#!/usr/bin/env -S bun run

/**
 * Open Source Launch Pad
 *
 * Transforms your side project into a professional open source project in under 3 minutes.
 *
 * Features:
 * - Analyzes project structure to identify what's needed for open source success
 * - Generates comprehensive CONTRIBUTING.md with clear guidelines
 * - Creates issue templates for bugs, features, and questions
 * - Sets up GitHub Actions for CI/CD, testing, and automated releases
 * - Adds code of conduct and proper licensing
 * - Creates a project roadmap and identifies "good first issues" from TODO comments
 * - Generates community health files (.github/FUNDING.yml, SECURITY.md)
 *
 * Usage:
 *   bun run agents/open-source-launch-pad.ts [path-to-project] [options]
 *
 * Examples:
 *   # Launch pad for current directory
 *   bun run agents/open-source-launch-pad.ts
 *
 *   # Launch pad for specific project
 *   bun run agents/open-source-launch-pad.ts /path/to/project
 *
 *   # Skip interactive prompts and accept all defaults
 *   bun run agents/open-source-launch-pad.ts --auto
 */

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface LaunchPadOptions {
  projectPath: string;
  auto: boolean;
}

function printHelp(): void {
  console.log(`
🚀 Open Source Launch Pad

Usage:
  bun run agents/open-source-launch-pad.ts [path-to-project] [options]

Arguments:
  path-to-project         Path to the project directory (default: current directory)

Options:
  --auto                  Skip interactive prompts and accept all defaults
  --help, -h              Show this help

Examples:
  bun run agents/open-source-launch-pad.ts
  bun run agents/open-source-launch-pad.ts /path/to/my-project
  bun run agents/open-source-launch-pad.ts --auto
  `);
}

function parseOptions(): LaunchPadOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawProjectPath = positionals[0];
  const projectPath = rawProjectPath
    ? resolve(rawProjectPath)
    : process.cwd();

  const auto = values.auto === true;

  return {
    projectPath,
    auto,
  };
}

function buildPrompt(options: LaunchPadOptions): string {
  const { projectPath, auto } = options;

  return `You are the Open Source Launch Pad agent. Your mission is to transform this side project into a professional, welcoming open source project.

PROJECT PATH: ${projectPath}${auto ? "\nMODE: Automatic (skip confirmations where safe)" : ""}

INSTRUCTIONS:

1. ANALYZE THE PROJECT
   - Use Glob to understand the project structure
   - Use Read to examine package.json, README.md, and main source files
   - Identify the tech stack, project type, and main functionality
   - Use Grep to find all TODO/FIXME comments for "good first issues"

2. DETERMINE WHAT'S MISSING
   Check if the project already has:
   - LICENSE file
   - CODE_OF_CONDUCT.md
   - CONTRIBUTING.md
   - Issue templates (.github/ISSUE_TEMPLATE/)
   - Pull request template (.github/pull_request_template.md)
   - GitHub Actions (.github/workflows/)
   - SECURITY.md
   - FUNDING.yml
   - A comprehensive README.md

3. GENERATE MISSING FILES
   For each missing file:

   a) LICENSE (if missing)
      - Suggest MIT or Apache 2.0 based on project type
      - Generate the license file with current year and project info

   b) CODE_OF_CONDUCT.md
      - Use the Contributor Covenant template
      - Customize with project contact information

   c) CONTRIBUTING.md
      - Explain how to set up the dev environment
      - Describe the git workflow (fork, branch, PR)
      - Include code style guidelines
      - Explain how to run tests
      - Describe the PR review process

   d) Issue Templates
      - Create bug_report.md with sections: Description, Steps to Reproduce, Expected/Actual Behavior, Environment
      - Create feature_request.md with sections: Problem, Proposed Solution, Alternatives Considered
      - Create question.md for general questions

   e) Pull Request Template
      - Include checklist: tests added, docs updated, follows style guide
      - Add sections: Description, Related Issues, Testing Done, Screenshots (if applicable)

   f) GitHub Actions (create appropriate workflows based on project type)
      - CI workflow for running tests on PRs
      - Release workflow for automated versioning and publishing
      - CodeQL for security scanning (if applicable)

   g) SECURITY.md
      - Explain how to report security vulnerabilities
      - List supported versions
      - Describe security update process

   h) .github/FUNDING.yml
      - Create template with commented options for GitHub Sponsors, Patreon, etc.
      - Let user fill in their details later

   i) ROADMAP.md
      - Analyze TODO/FIXME comments and create a roadmap
      - Organize by: Completed, In Progress, Planned, Ideas
      - Mark simple TODOs as "good first issues"

4. ENHANCE README.md
   If README is basic, enhance it with:
   - Eye-catching badges (build status, version, license, etc.)
   - Clear description of what the project does
   - Demo/screenshots section (placeholder if needed)
   - Quick start guide
   - Installation instructions
   - Usage examples
   - API documentation link or overview
   - Contributing section linking to CONTRIBUTING.md
   - License section
   - Acknowledgments/Credits section

5. GENERATE SUMMARY REPORT
   Create a file called OPEN_SOURCE_SETUP_REPORT.md that lists:
   - What was generated
   - What already existed
   - Next steps for the maintainer
   - Checklist of things to customize (funding links, contact info, etc.)
   - Tips for attracting contributors

IMPORTANT:
- Only create files that don't exist or need significant improvement
- Ask before overwriting existing files
- Use WebSearch to find current best practices for open source projects
- Be respectful of existing project conventions
- Make the project welcoming and accessible to new contributors

Start by analyzing the project structure and creating a plan. Then execute the plan to transform this project into a professional open source repository.`.trim();
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["auto", "help", "h"] as const;

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

console.log("🚀 Open Source Launch Pad");
console.log("========================\n");
console.log(`Analyzing project at: ${options.projectPath}`);
console.log(`Mode: ${options.auto ? "Automatic" : "Interactive"}\n`);

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Read",
  "Write",
  "Glob",
  "Grep",
  "Bash",
  "WebSearch",
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "acceptEdits",
};

// Change to project directory before running claude
const originalCwd = process.cwd();
process.chdir(options.projectPath);

try {
  const exitCode = await claude(prompt, defaultFlags);

  // Restore original directory
  process.chdir(originalCwd);

  if (exitCode === 0) {
    console.log("\n✨ Open Source Launch Pad complete!\n");
    console.log("📝 Check OPEN_SOURCE_SETUP_REPORT.md for next steps!");
    console.log("\nNext steps:");
    console.log("1. Review all generated files");
    console.log("2. Customize funding and contact information");
    console.log("3. Update README.md with screenshots/demos");
    console.log("4. Push changes to GitHub");
    console.log("5. Enable GitHub Actions and issue templates");
  }
  process.exit(exitCode);
} catch (error) {
  process.chdir(originalCwd);
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
