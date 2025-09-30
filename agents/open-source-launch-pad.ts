#!/usr/bin/env bun

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
 * Usage: bun run agents/open-source-launch-pad.ts [path-to-project]
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

const projectPath = process.argv[2] || process.cwd();

console.log("🚀 Open Source Launch Pad");
console.log("========================\n");
console.log(`Analyzing project at: ${projectPath}\n`);

const prompt = `You are the Open Source Launch Pad agent. Your mission is to transform this side project into a professional, welcoming open source project.

PROJECT PATH: ${projectPath}

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

Start by analyzing the project structure and creating a plan. Then execute the plan to transform this project into a professional open source repository.`;

const result = query({
  prompt,
  options: {
    cwd: projectPath,
    allowedTools: [
      "Read",
      "Write",
      "Glob",
      "Grep",
      "Bash",
      "WebSearch"
    ],
    permissionMode: "acceptEdits",
    model: "claude-sonnet-4-5-20250929"
  }
});

let lastMessage = "";

for await (const message of result) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "text") {
        lastMessage = block.text;
        console.log(block.text);
      }
    }
  } else if (message.type === "result") {
    console.log("\n" + "=".repeat(60));
    if (message.subtype === "success") {
      console.log("\n✅ Open Source Launch Pad Complete!");
      console.log(`\n📊 Stats:`);
      console.log(`   - Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
      console.log(`   - Turns: ${message.num_turns}`);
      console.log(`   - Cost: $${message.total_cost_usd.toFixed(4)}`);
      console.log(`\n📝 Check OPEN_SOURCE_SETUP_REPORT.md for next steps!`);
    } else {
      console.log("\n❌ Launch pad encountered an issue");
      console.log(`   Reason: ${message.subtype}`);
    }
    console.log("=".repeat(60) + "\n");
  }
}
