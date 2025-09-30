#!/usr/bin/env bun

/**
 * Architecture Decision Logger
 *
 * Automatically documents the "why" behind your architectural decisions by:
 * - Analyzing git commits, PR discussions, and code comments
 * - Generating Architecture Decision Records (ADRs) in standard format
 * - Identifying when significant architectural changes occurred
 * - Linking decisions to specific code changes
 * - Creating a searchable knowledge base of past decisions
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

const PROMPT = `You are an Architecture Decision Logger agent that helps teams document the "why" behind architectural decisions.

Your task is to analyze the git history and codebase to identify significant architectural decisions and generate Architecture Decision Records (ADRs).

## Process:

1. **Analyze Git History**: Use Bash to get git log and identify commits related to architectural decisions:
   - Look for keywords: "refactor", "architecture", "redesign", "migrate", "rewrite", "performance", "scalability"
   - Focus on commits with significant file changes or that touch core system files
   - Identify merge commits from PRs that might indicate larger decisions

2. **Extract Context**: For each significant decision:
   - Read the commit message and full diff if needed
   - Look for related code comments that explain "why"
   - Check for TODO/FIXME comments that might indicate decision rationale
   - Identify which files/modules were affected

3. **Generate ADR**: Create an ADR document for each decision in this format:
   \`\`\`markdown
   # ADR-[NUMBER]: [Title]

   ## Status
   Accepted | Proposed | Deprecated | Superseded

   ## Context
   [What is the issue that we're seeing that is motivating this decision?]

   ## Decision
   [What is the change that we're proposing/announcing?]

   ## Consequences
   ### Positive
   - [Good consequence 1]
   - [Good consequence 2]

   ### Negative
   - [Bad consequence 1]
   - [Bad consequence 2]

   ### Neutral
   - [Neutral consequence]

   ## Related Commits
   - [commit hash]: [commit message]

   ## Date
   [Decision date from commit]
   \`\`\`

4. **Save ADRs**: Write ADR files to \`docs/adr/\` directory (create if doesn't exist):
   - Name format: \`NNNN-title-in-kebab-case.md\`
   - Start numbering from 0001

5. **Create Index**: Generate a \`docs/adr/README.md\` file that lists all ADRs with:
   - Links to each ADR
   - Brief one-line summary
   - Status and date

## Guidelines:

- Focus on decisions that had significant impact on the system architecture
- Be concise but thorough in explaining the "why"
- Link concrete code changes to decisions
- Don't document trivial changes (like formatting or typo fixes)
- Look for patterns across multiple commits that indicate a larger decision
- If a decision supersedes an older one, note that relationship
- Target 5-10 ADRs for a typical project (don't over-document)

## Output:

Your final message should:
1. Summarize how many architectural decisions you found
2. List the ADR titles and numbers
3. Provide the path to the generated ADR directory
4. Suggest how the team can use these ADRs going forward

Start by analyzing the git history to find significant architectural decisions.`;

async function main() {
  console.log("🏛️  Architecture Decision Logger");
  console.log("=====================================\n");

  const result = query({
    prompt: PROMPT,
    options: {
      cwd: process.cwd(),
      allowedTools: ["Bash", "Read", "Write", "Glob", "Grep"],
      model: "claude-sonnet-4-5-20250929",
      permissionMode: "acceptEdits",
      maxTurns: 30,
    },
  });

  for await (const message of result) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          console.log(block.text);
        }
      }
    }

    if (message.type === "result") {
      if (message.subtype === "success") {
        console.log("\n✅ Architecture Decision Logger completed successfully!");
        console.log(`📊 Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
      } else {
        console.error("\n❌ Error:", message.subtype);
      }
    }
  }
}

main().catch(console.error);
