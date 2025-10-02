#!/usr/bin/env -S bun run

/**
 * Pull Request Risk Radar
 *
 * A practical everyday agent that spotlights risky pull requests before review time.
 * It analyzes git history, ownership, test signals, and diff structure to highlight
 * hotspots that deserve reviewer attention and to recommend protective steps before merge.
 *
 * Usage:
 *   bun run agents/pull-request-risk-radar.ts [compare-range] [options]
 *
 * Examples:
 *   # Compare current branch against main
 *   bun run agents/pull-request-risk-radar.ts --base main
 *
 *   # Analyze a specific PR range
 *   bun run agents/pull-request-risk-radar.ts origin/main...HEAD --report pr-risk.md
 *
 *   # Analyze a specific PR number
 *   bun run agents/pull-request-risk-radar.ts --base main --pr 123
 */

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface PullRequestRiskOptions {
  baseBranch: string;
  compareRange: string;
  reportFile: string;
  prNumber?: string;
  maxRecentCommits: number;
}

const DEFAULT_REPORT_FILE = "pull-request-risk-report.md";
const DEFAULT_BASE_BRANCH = "main";
const DEFAULT_MAX_COMMITS = 20;

function printHelp(): void {
  console.log(`
🛰️  Pull Request Risk Radar

Usage:
  bun run agents/pull-request-risk-radar.ts [compare-range] [options]

Arguments:
  compare-range          Git range to analyze (default: HEAD)

Options:
  --base <branch>        Base branch to compare against (default: ${DEFAULT_BASE_BRANCH})
  --report <file>        Output report file (default: ${DEFAULT_REPORT_FILE})
  --pr <number>          Pull request number for context
  --max-commits <n>      Ownership lookback commits (default: ${DEFAULT_MAX_COMMITS})
  --help, -h             Show this help

Examples:
  bun run agents/pull-request-risk-radar.ts --base main
  bun run agents/pull-request-risk-radar.ts origin/main...HEAD --report pr-risk.md
  bun run agents/pull-request-risk-radar.ts --base main --pr 123
  `);
}

function parseOptions(): PullRequestRiskOptions | null {
  const { positionals, values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawBase = values.base;
  const rawReport = values.report;
  const rawPr = values.pr;
  const rawMaxCommits = values['max-commits'];

  const baseBranch = typeof rawBase === "string" && rawBase.length > 0
    ? rawBase
    : DEFAULT_BASE_BRANCH;

  let compareRange = positionals[0] || "HEAD";

  const reportFile = typeof rawReport === "string" && rawReport.length > 0
    ? rawReport
    : DEFAULT_REPORT_FILE;

  const prNumber = typeof rawPr === "string" && rawPr.length > 0
    ? rawPr
    : undefined;

  let maxRecentCommits = DEFAULT_MAX_COMMITS;
  if (typeof rawMaxCommits === "string") {
    const value = Number(rawMaxCommits);
    if (!Number.isNaN(value) && value > 0) {
      maxRecentCommits = value;
    }
  }

  if (compareRange === "HEAD") {
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

function buildPrompt(options: PullRequestRiskOptions): string {
  const { baseBranch, compareRange, reportFile, prNumber, maxRecentCommits } = options;

  const prContextLine = prNumber ? `- Pull request number: ${prNumber}\n` : '';

  return `
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
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["base", "report", "pr", "max-commits", "help", "h"] as const;

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

console.log('🛰️  Pull Request Risk Radar\n');
console.log(`📂 Repo: ${process.cwd()}`);
console.log(`🔀 Compare Range: ${options.compareRange}`);
console.log(`🌳 Base Branch: ${options.baseBranch}`);
if (options.prNumber) {
  console.log(`📦 PR #: ${options.prNumber}`);
}
console.log(`🗂️  Report File: ${options.reportFile}`);
console.log(`🧭 Ownership lookback commits: ${options.maxRecentCommits}\n`);

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Bash",
  "Read",
  "Grep",
  "Glob",
  "Write",
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log('\n✅ Risk scan complete');
    console.log(`📄 Report saved to: ${options.reportFile}`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('\n❌ Error while running Pull Request Risk Radar:', error);
  process.exit(1);
}
