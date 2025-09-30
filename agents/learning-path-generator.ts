#!/usr/bin/env bun

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
 *   bun run agents/learning-path-generator.ts [directory] [target-role]
 *
 * Examples:
 *   bun run agents/learning-path-generator.ts
 *   bun run agents/learning-path-generator.ts . "Senior Frontend Engineer"
 *   bun run agents/learning-path-generator.ts ~/projects/my-app "Full Stack Developer"
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";

// Parse command-line arguments
const args = process.argv.slice(2);
const targetDir = args[0] ? resolve(args[0]) : process.cwd();
const targetRole = args[1] || "Senior Software Engineer";

console.log("🎓 Learning Path Generator");
console.log("=".repeat(50));
console.log(`📁 Analyzing directory: ${targetDir}`);
console.log(`🎯 Target role: ${targetRole}`);
console.log("=".repeat(50));
console.log();

const prompt = `You are a Learning Path Generator that helps developers create personalized learning roadmaps.

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
Generate a comprehensive markdown document named \`learning-path-${new Date().toISOString().split('T')[0]}.md\` with all the information above, beautifully formatted with:
- Executive summary at the top
- Clear sections with headings and subheadings
- Bullet points and numbered lists
- Links to resources
- Checkboxes for tracking progress
- Motivational language to keep developers engaged

Be specific, actionable, and encouraging. This roadmap should transform aimless learning into a strategic career investment.

IMPORTANT: Write the final learning path to a file using the Write tool.`;

async function main() {
  try {
    const startTime = Date.now();

    // Execute the query
    const result = query({
      prompt,
      options: {
        cwd: targetDir,
        allowedTools: [
          "Bash",
          "Read",
          "Grep",
          "Glob",
          "WebSearch",
          "Write"
        ],
        permissionMode: "bypassPermissions",
        model: "claude-sonnet-4-5-20250929",
      },
    });

    // Process streaming results
    let assistantMessages: string[] = [];

    for await (const message of result) {
      if (message.type === "assistant") {
        // Extract text content from assistant messages
        for (const block of message.message.content) {
          if (block.type === "text") {
            assistantMessages.push(block.text);
          }
        }
      } else if (message.type === "result") {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log();
        console.log("=".repeat(50));
        console.log("✅ Learning Path Generated Successfully!");
        console.log("=".repeat(50));
        console.log(`⏱️  Completed in ${duration}s`);
        console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`🔄 Turns: ${message.num_turns}`);
        console.log(`📊 Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);
        console.log();

        if (message.subtype === "success") {
          console.log("📄 Summary:");
          console.log(message.result);
        } else if (message.subtype === "error_max_turns") {
          console.error("⚠️  Warning: Reached maximum turns limit");
        } else if (message.subtype === "error_during_execution") {
          console.error("❌ Error occurred during execution");
        }
      }
    }

  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
