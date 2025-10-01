#!/usr/bin/env bun

/**
 * Pull Request Risk Radar
 *
 * A practical everyday agent that spotlights risky pull requests before review time.
 * It analyzes git history, ownership, test signals, and diff structure to highlight
 * hotspots that deserve reviewer attention and to recommend protective steps before merge.
 *
 * Usage:
 *   bun run agents/pull-request-risk-radar.ts [compare-range] [--base main] [--report risk.md]
 *
 * Examples:
 *   # Compare current branch against main
 *   bun run agents/pull-request-risk-radar.ts --base main
 *
 *   # Analyze a specific PR range
 *   bun run agents/pull-request-risk-radar.ts origin/main...HEAD --report pr-risk.md
 */

import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import { parseArgs } from 'util';

interface CliOptions {
  baseBranch: string;
  compareRange: string;
  reportFile: string;
  prNumber?: string;
  maxRecentCommits: number;
}

function getCliOptions(): CliOptions {
  const { positionals, values } = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: {
      base: { type: 'string' },
      report: { type: 'string' },
      pr: { type: 'string' },
      'max-commits': { type: 'string' },
    },
  });

  const baseBranch = (values.base as string | undefined) || 'main';
  let compareRange = positionals[0] || 'HEAD';
  const reportFile = (values.report as string | undefined) || 'pull-request-risk-report.md';
  const prNumber = values.pr as string | undefined;

  let maxRecentCommits = 20;
  if (values['max-commits']) {
    const value = Number(values['max-commits']);
    if (!Number.isNaN(value) && value > 0) {
      maxRecentCommits = value;
    }
  }

  if (compareRange === 'HEAD') {
    compareRange = `${baseBranch}...HEAD`;
  }

  return {
    baseBranch,
    compareRange,
    reportFile,
    prNumber,
    maxRecentCommits,
  };
}

async function main() {
  const { baseBranch, compareRange, reportFile, prNumber, maxRecentCommits } = getCliOptions();

  console.log('🛰️  Pull Request Risk Radar\n');
  console.log(`📂 Repo: ${process.cwd()}`);
  console.log(`🔀 Compare Range: ${compareRange}`);
  console.log(`🌳 Base Branch: ${baseBranch}`);
  if (prNumber) {
    console.log(`📦 PR #: ${prNumber}`);
  }
  console.log(`🗂️  Report File: ${reportFile}`);
  console.log(`🧭 Ownership lookback commits: ${maxRecentCommits}\n`);

  const prContextLine = prNumber ? `- Pull request number: ${prNumber}\n` : '';

  const prompt = `
You are the Pull Request Risk Radar agent. Your mission is to inspect the current repository and produce a
concise but thorough risk briefing for reviewers before they look at the pull request.

## Repository Context
- Working directory: ${process.cwd()}
- Base branch: ${baseBranch}
- Diff range to analyze: ${compareRange}
${prContextLine}- Ownership lookback window: ${maxRecentCommits} commits

## Core Objectives
1. Quantify review risk by combining change surface area, historical instability, and ownership data.
2. Detect files that no core maintainer has touched recently ("orphaned" code paths).
3. Highlight untested or under-tested code paths by correlating diff hunks with recent test failures or missing coverage.
4. Identify config, schema, dependency, or infrastructure changes that demand extra attention.
5. Summarize potential blast radius and recommend specific reviewers, test suites, and manual checks.

## Investigation Playbook
- Run \`git fetch --all --prune\` to ensure references are current.
- Use \`git diff --stat ${compareRange}\` for a quick surface area overview.
- Produce focused diffs (\`git diff ${compareRange} --unified=0\`) to locate risky hunks.
- For each changed file, gather ownership history via \`git log -n ${maxRecentCommits} --format="%an|%ae" -- ${'$'}file\` and pair it with \`git blame\` snapshots.
- Inspect test signal health:
  - Identify touched test files
  - Compare against recent CI logs or artifacts stored locally
  - Call out code paths without nearby tests
- Map dependency, schema, and config changes to their downstream consumers.
- Calculate a risk score (0-100) that rolls up severity, uncertainty, and blast radius. Document how the score was derived.

## Report Requirements
Write a markdown report to "${reportFile}" with the following structure:

\`\`\`markdown
# Pull Request Risk Radar

## Executive Summary
- **Overall Risk Level**: [Low|Medium|High] ([score]/100)
- **Primary Risk Drivers**:
  - [Driver 1]
  - [Driver 2]
- **Recommended Immediate Actions**:
  - [Action 1]
  - [Action 2]

## Change Surface Overview
- Files Touched: [count]
- Lines Added / Removed: [added] / [removed]
- Modules with Highest Churn:
  - [Module] -> [Reason]

## Hotspot Files
| File | Risk Score | Why It's Risky | Suggested Reviewer |
| ---- | ---------- | -------------- | ------------------ |
| path.ts | 85 | orphaned module + large diff | @maintainer |

## Test & Coverage Gaps
- Missing or flaky test suites: [list]
- Manual scenarios to run before merge: [list]
- Coverage notes: [where coverage drops or is unknown]

## Dependency & Config Changes
- [List relevant manifest/config updates with expected blast radius]

## Recommended Follow-ups
1. [Action → Suggested owner → Timing]
2. [Action → Suggested owner → Timing]

## Appendix
- Risk scoring formula summary
- Key commands executed
\`\`\`

If any hotspot scores 70 or higher, record follow-up tasks using the \`TodoWrite\` tool with clear descriptions and priority.

Close the session by outputting a brief text summary (<=5 sentences) that reiterates the top three reviewer actions.
`.trim();

  const sdkOptions: Options = {
    cwd: process.cwd(),
    permissionMode: 'bypassPermissions',
    allowedTools: [
      'Bash',
      'Read',
      'Grep',
      'Glob',
      'Write',
      'TodoWrite',
    ],
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
    },
    maxTurns: 60,
    hooks: {
      PreToolUse: [
        {
          hooks: [
            async (input: any) => {
              if (input.hook_event_name === 'PreToolUse') {
                if (input.tool_name === 'Bash') {
                  const toolInput = input.tool_input as { command?: string };
                  const command = toolInput?.command;
                  if (typeof command === 'string') {
                    console.log(`🛠️  Running: ${command}`);
                  } else {
                    console.log('🛠️  Running Bash command');
                  }
                } else if (input.tool_name === 'Write') {
                  console.log(`📝 Writing risk report to ${reportFile}`);
                } else if (input.tool_name === 'TodoWrite') {
                  console.log('✅ Capturing high-priority follow-up tasks');
                }
              }
              return { continue: true };
            },
          ],
        },
      ],
      PostToolUse: [
        {
          hooks: [
            async (input: any) => {
              if (input.hook_event_name === 'PostToolUse') {
                if (input.tool_name === 'Write') {
                  console.log('📄 Risk report updated');
                } else if (input.tool_name === 'TodoWrite') {
                  console.log('🗒️  Follow-up checklist ready');
                }
              }
              return { continue: true };
            },
          ],
        },
      ],
    },
  };

  try {
    for await (const message of query({ prompt, options: sdkOptions })) {
      if (message.type === 'assistant') {
        for (const content of message.message.content) {
          if (content.type === 'text') {
            const text = content.text.trim();
            if (text.length > 0) {
              console.log(text);
            }
          }
        }
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          console.log('\n✅ Risk scan complete');
          console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
          console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`🔢 Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);
          console.log(`📄 Report saved to: ${reportFile}`);
        } else {
          console.error(`\n❌ Risk analysis ended with subtype: ${message.subtype}`);
        }
      }
    }
  } catch (error) {
    console.error('\n❌ Error while running Pull Request Risk Radar:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unhandled error in Pull Request Risk Radar:', error);
  process.exit(1);
});
