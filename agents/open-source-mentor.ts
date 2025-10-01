#!/usr/bin/env bun

/**
 * Open Source Mentor Agent
 *
 * Helps developers contribute to major open source projects by:
 * - Analyzing repositories to understand contribution patterns
 * - Identifying beginner-friendly issues with full context
 * - Generating comprehensive contribution guides
 * - Drafting professional PR descriptions
 * - Building personalized contributor roadmaps
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

interface MentorOptions {
  repository: string;
  issueNumber?: number;
  githubUsername?: string;
  generateRoadmap?: boolean;
}

async function runOpenSourceMentor(options: MentorOptions) {
  const { repository, issueNumber, githubUsername, generateRoadmap = false } = options;

  console.log(`🎯 Open Source Mentor: Analyzing ${repository}...\n`);

  const prompt = buildPrompt(options);

  const result = query({
    prompt,
    options: {
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: `
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
`
      },
      allowedTools: [
        'Bash',
        'Read',
        'Write',
        'Grep',
        'Glob',
        'WebFetch',
        'TodoWrite'
      ],
      permissionMode: 'bypassPermissions',
    },
  });

  let finalResult = '';

  for await (const message of result) {
    if (message.type === 'assistant') {
      for (const content of message.message.content) {
        if (content.type === 'text') {
          process.stdout.write(content.text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        finalResult = message.result;
        console.log('\n\n✅ Analysis Complete!\n');
        console.log(`Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
      } else {
        console.error('\n\n❌ Error during analysis');
      }
    }
  }

  return finalResult;
}

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

// CLI Interface
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
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
  process.exit(0);
}

const repository = args[0];

if (!repository || !repository.includes('/')) {
  console.error('❌ Error: Please provide a valid repository in owner/repo format (e.g., facebook/react)');
  process.exit(1);
}

const issueIndex = args.indexOf('--issue');
const issueArg = issueIndex !== -1 ? args[issueIndex + 1] : undefined;
const issueNumber = issueArg ? parseInt(issueArg) : undefined;

const usernameIndex = args.indexOf('--username');
const githubUsername = usernameIndex !== -1 && args[usernameIndex + 1]
  ? args[usernameIndex + 1]
  : undefined;

const generateRoadmap = args.includes('--roadmap');

runOpenSourceMentor({
  repository,
  issueNumber,
  githubUsername,
  generateRoadmap,
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});