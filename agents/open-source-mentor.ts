#!/usr/bin/env -S bun run

/**
 * Open Source Mentor Agent
 *
 * Helps developers contribute to major open source projects by:
 * - Analyzing repositories to understand contribution patterns
 * - Identifying beginner-friendly issues with full context
 * - Generating comprehensive contribution guides
 * - Drafting professional PR descriptions
 * - Building personalized contributor roadmaps
 *
 * Usage:
 *   bun run agents/open-source-mentor.ts <repository> [options]
 *
 * Examples:
 *   # Find beginner-friendly issues in React
 *   bun run agents/open-source-mentor.ts facebook/react
 *
 *   # Get guidance on a specific Next.js issue
 *   bun run agents/open-source-mentor.ts vercel/next.js --issue 12345
 *
 *   # Create personalized roadmap for contributing to VS Code
 *   bun run agents/open-source-mentor.ts microsoft/vscode --username yourname --roadmap
 */

import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface MentorOptions {
  repository: string;
  issueNumber?: number;
  githubUsername?: string;
  generateRoadmap?: boolean;
}

const SYSTEM_PROMPT = `
You are the Open Source Mentor, an expert guide for developers who want to contribute to major open source projects.

Your mission is to transform intimidating large codebases into approachable contribution opportunities and help developers achieve their dream of becoming recognized open source contributors.

## Your Approach

1. **Repository Analysis**: Understand the project structure, contribution patterns, and community culture
2. **Issue Identification**: Find beginner-friendly issues or suggest good first contributions
3. **Contribution Guide**: Generate step-by-step setup and implementation guides
4. **Professional Communication**: Draft PR descriptions that follow project conventions
5. **Roadmap Building**: Create personalized paths from first contribution to becoming a regular contributor

## Key Principles

- Break down intimidating codebases into manageable chunks
- Provide full context about why changes matter, not just what to change
- Help developers understand the "big picture" of how their contribution fits
- Teach best practices for engaging with maintainers professionally
- Build confidence by celebrating progress and normalizing mistakes
- Focus on sustainable contribution patterns, not one-off PRs

## Tools You'll Use

- **Bash**: Clone repos, run tests, use gh CLI for GitHub operations
- **WebFetch**: Get issue details, repo info, contribution guidelines
- **Read**: Analyze code structure, understand existing patterns
- **Grep**: Find similar implementations, locate relevant files
- **Write**: Generate contribution guides, setup instructions, PR templates

Remember: Your goal is to empower developers to contribute confidently and meaningfully to open source.
`.trim();

function buildPrompt(options: MentorOptions): string {
  const { repository, issueNumber, githubUsername, generateRoadmap } = options;

  return `I want to contribute to the ${repository} open source project. ${
    issueNumber
      ? `Specifically, I'm interested in working on issue #${issueNumber}.`
      : `I'm not sure where to start.`
  }

Please:${
    issueNumber
      ? `
1. Fetch the issue details using gh CLI or WebFetch
2. Analyze the repository structure to understand where the change should be made
3. Identify related code patterns and similar implementations
4. Generate a detailed contribution guide including:
   - Local setup instructions with all dependencies
   - Step-by-step implementation approach
   - Testing strategy and commands to run
   - Common pitfalls to avoid
5. Draft a professional PR description following the project's conventions
6. Provide tips for engaging with maintainers during code review

Focus on making this approachable and building my confidence to actually submit the PR.`
      : `
1. Analyze the repository using gh CLI and WebFetch to understand:
   - Project structure and tech stack
   - Contribution guidelines and process
   - Code review culture (how maintainers communicate)
2. Identify 3-5 beginner-friendly issues or areas where I could contribute, with:
   - Full context about what needs to be done and why it matters
   - Estimated difficulty and time investment
   - What I'll learn from each contribution
3. For the most promising opportunity, provide a detailed getting-started guide${
  githubUsername
    ? `
4. Analyze my GitHub profile (${githubUsername}) and suggest which contribution would best complement my existing skills and experience`
    : ''
}${
  generateRoadmap
    ? `
${githubUsername ? '5' : '4'}. Create a 90-day roadmap for going from first-time contributor to recognized contributor in this project, including:
   - Milestones and suggested contributions at each stage
   - Skills to develop along the way
   - Community engagement strategies (discussions, issues, reviews)
   - How to build relationships with maintainers`
    : ''
}`
  }

Generate all guides as markdown files in a './contribution-guides/' directory for easy reference.`;
}

function printHelp(): void {
  console.log(`
🎯 Open Source Mentor - Your guide to contributing to major OSS projects

Usage:
  bun run agents/open-source-mentor.ts <repository> [options]

Arguments:
  <repository>          GitHub repository (owner/repo format, e.g., 'facebook/react')

Options:
  --issue <number>      Analyze a specific issue and generate a contribution guide
  --username <github>   Your GitHub username for personalized recommendations
  --roadmap             Generate a 90-day contributor roadmap
  --help, -h            Show this help message

Examples:
  # Find beginner-friendly issues in React
  bun run agents/open-source-mentor.ts facebook/react

  # Get guidance on a specific Next.js issue
  bun run agents/open-source-mentor.ts vercel/next.js --issue 12345

  # Create personalized roadmap for contributing to VS Code
  bun run agents/open-source-mentor.ts microsoft/vscode --username yourname --roadmap

  # Full analysis with everything
  bun run agents/open-source-mentor.ts vuejs/core --username yourname --issue 789 --roadmap
  `);
}

function parseOptions(): MentorOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const repository = positionals[0];
  if (!repository || !repository.includes('/')) {
    console.error('❌ Error: Please provide a valid repository in owner/repo format (e.g., facebook/react)');
    printHelp();
    process.exit(1);
  }

  const rawIssue = values.issue;
  const issueNumber = typeof rawIssue === 'string' && rawIssue.length > 0
    ? parseInt(rawIssue, 10)
    : undefined;

  const rawUsername = values.username;
  const githubUsername = typeof rawUsername === 'string' && rawUsername.length > 0
    ? rawUsername
    : undefined;

  const generateRoadmap = values.roadmap === true;

  return {
    repository,
    issueNumber,
    githubUsername,
    generateRoadmap,
  };
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🎯 Open Source Mentor\n");
console.log(`Repository: ${options.repository}`);
if (options.issueNumber) console.log(`Issue: #${options.issueNumber}`);
if (options.githubUsername) console.log(`GitHub Username: ${options.githubUsername}`);
console.log(`Roadmap: ${options.generateRoadmap ? "Enabled" : "Disabled"}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Bash",
  "Read",
  "Write",
  "Grep",
  "Glob",
  "WebFetch",
  "TodoWrite",
];

removeAgentFlags([
    "issue", "username", "roadmap", "help", "h"
  ]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
  "append-system-prompt": SYSTEM_PROMPT,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Open source mentoring complete!\n");
    console.log("📁 Check ./contribution-guides/ for generated guides");
    console.log("\nNext steps:");
    console.log("1. Review the contribution guides");
    console.log("2. Set up your local development environment");
    console.log("3. Start with the recommended first contribution");
    console.log("4. Engage with the community and maintainers");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}