#!/usr/bin/env bun

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
 *   bun agents/open-source-contribution-matchmaker.ts [--dir <path>] [--output <file>]
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

interface SkillAnalysis {
  languages: Record<string, number>; // language -> line count
  frameworks: string[];
  patterns: string[];
  experience_level: 'beginner' | 'intermediate' | 'advanced';
}

interface OpportunityMatch {
  repo: string;
  url: string;
  issue_title: string;
  issue_url: string;
  reason: string;
  difficulty: string;
}

interface ContributionPlan {
  skill_analysis: SkillAnalysis;
  opportunities: OpportunityMatch[];
  contribution_strategy: string;
  introduction_template: string;
}

async function analyzeSkills(targetDir: string): Promise<string> {
  const prompt = `Analyze the codebase in ${targetDir} to identify:
1. Primary programming languages used (with approximate percentage)
2. Frameworks and libraries in use
3. Common coding patterns and practices observed
4. Estimate the developer's experience level based on code complexity

Provide a structured analysis that can be used to match with open source opportunities.`;

  let analysis = "";

  for await (const message of query({
    prompt,
    options: {
      cwd: targetDir,
      allowedTools: ["Read", "Glob", "Grep", "Bash"],
      permissionMode: "bypassPermissions",
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          analysis += block.text;
        }
      }
    } else if (message.type === "result") {
      if (message.subtype === "success") {
        analysis += `\n\n${message.result}`;
      }
    }
  }

  return analysis;
}

async function findOpportunities(skillAnalysis: string): Promise<string> {
  const prompt = `Based on this skill analysis:

${skillAnalysis}

Search GitHub for 5-10 open source projects that would be perfect contribution opportunities. Look for:
- Projects using the same languages/frameworks
- Issues labeled "good first issue", "help wanted", or "beginner-friendly"
- Active projects with recent commits
- Projects at an appropriate difficulty level

For each opportunity, provide:
- Repository name and URL
- Specific issue title and URL
- Why it's a good match
- Estimated difficulty

Format the results as a structured list.`;

  let opportunities = "";

  for await (const message of query({
    prompt,
    options: {
      allowedTools: ["WebSearch"],
      permissionMode: "bypassPermissions",
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          opportunities += block.text;
        }
      }
    } else if (message.type === "result") {
      if (message.subtype === "success") {
        opportunities += `\n\n${message.result}`;
      }
    }
  }

  return opportunities;
}

async function generateContributionStrategy(
  skillAnalysis: string,
  opportunities: string
): Promise<string> {
  const prompt = `Based on the skill analysis and opportunities found:

SKILLS:
${skillAnalysis}

OPPORTUNITIES:
${opportunities}

Generate a comprehensive contribution plan that includes:
1. Prioritized list of opportunities (easiest to hardest)
2. Step-by-step approach for each opportunity
3. Template for introducing yourself to maintainers
4. Draft PR description template
5. Tips for successful contribution
6. Follow-up strategy after first contribution

Make it actionable and encouraging for someone breaking into open source.`;

  let strategy = "";

  for await (const message of query({
    prompt,
    options: {
      allowedTools: [],
      permissionMode: "bypassPermissions",
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          strategy += block.text;
        }
      }
    } else if (message.type === "result") {
      if (message.subtype === "success") {
        strategy += `\n\n${message.result}`;
      }
    }
  }

  return strategy;
}

async function main() {
  const args = process.argv.slice(2);
  const dirIndex = args.indexOf("--dir");
  const outputIndex = args.indexOf("--output");

  const targetDir = dirIndex !== -1 && args[dirIndex + 1] ? args[dirIndex + 1]! : process.cwd();
  const outputFile: string | null = outputIndex !== -1 && args[outputIndex + 1] ? args[outputIndex + 1]! : null;

  console.log("🔍 Open Source Contribution Matchmaker");
  console.log("=" .repeat(50));
  console.log(`\nAnalyzing codebase in: ${targetDir}\n`);

  // Step 1: Analyze skills
  console.log("📊 Step 1/3: Analyzing your coding skills...");
  const skillAnalysis = await analyzeSkills(targetDir);
  console.log("✅ Skill analysis complete\n");

  // Step 2: Find opportunities
  console.log("🔎 Step 2/3: Searching for matching opportunities...");
  const opportunities = await findOpportunities(skillAnalysis);
  console.log("✅ Found matching opportunities\n");

  // Step 3: Generate contribution strategy
  console.log("📝 Step 3/3: Creating contribution strategy...");
  const strategy = await generateContributionStrategy(skillAnalysis, opportunities);
  console.log("✅ Strategy complete\n");

  // Format the complete plan
  const completePlan = `# Open Source Contribution Plan

## Your Skill Profile
${skillAnalysis}

## Matched Opportunities
${opportunities}

## Contribution Strategy
${strategy}

---
Generated by Open Source Contribution Matchmaker
`;

  // Output results
  if (outputFile !== null) {
    await Bun.write(outputFile, completePlan);
    console.log(`\n✅ Complete plan saved to: ${outputFile}`);
  } else {
    console.log("\n" + "=".repeat(50));
    console.log(completePlan);
  }

  console.log("\n🚀 Ready to start contributing!");
  console.log("💡 Tip: Start with the easiest opportunity to build confidence");
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
