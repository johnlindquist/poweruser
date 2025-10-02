#!/usr/bin/env -S bun run

/**
 * Sprint Debrief Synthesizer Agent
 *
 * A practical everyday agent that turns sprint chaos into crisp, stakeholder-ready updates:
 * - Aggregates merged PRs, issue tracker movements, and deployment notes into a single timeline
 * - Highlights scope changes, carryover work, and blockers with owner callouts pulled from commit metadata
 * - Surfaces metrics like lead time, review turnaround, and bug reopen rates with trend deltas
 * - Drafts narrative summaries tailored to engineers, PMs, and leadership with adjustable tone presets
 * - Suggests celebratory shout-outs and follow-up todos so nothing falls through the cracks in retro
 * - Perfect for teams who want consistent debriefs without sacrificing engineering time
 *
 * Usage:
 *   bun run agents/sprint-debrief-synthesizer.ts [projectPath] [options]
 *
 * Examples:
 *   # Basic sprint debrief for current directory
 *   bun run agents/sprint-debrief-synthesizer.ts
 *
 *   # Debrief for specific project with date range
 *   bun run agents/sprint-debrief-synthesizer.ts ./my-project --since "2 weeks ago" --until "now"
 *
 *   # Generate executive report
 *   bun run agents/sprint-debrief-synthesizer.ts --audience exec --format slack
 */

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type Audience = "engineering" | "pm" | "exec" | "mixed";
type OutputFormat = "markdown" | "slack" | "html";

interface SprintDebriefOptions {
  projectPath: string;
  since?: string;
  until?: string;
  outputFile: string;
  audience: Audience;
  format: OutputFormat;
  includeShoutouts: boolean;
  includeMetrics: boolean;
  includeRetroPrompts: boolean;
}

const DEFAULT_OUTPUT_FILE = "sprint-debrief.md";
const DEFAULT_AUDIENCE: Audience = "mixed";
const DEFAULT_FORMAT: OutputFormat = "markdown";

function printHelp(): void {
  console.log(`
🗂️  Sprint Debrief Synthesizer

Usage:
  bun run agents/sprint-debrief-synthesizer.ts [projectPath] [options]

Arguments:
  projectPath             Path to project (default: current directory)

Options:
  --since <range>         Start of sprint window (e.g., "2 weeks ago")
  --until <date>          End of sprint window (e.g., "now")
  --output <file>         Output file (default: ${DEFAULT_OUTPUT_FILE})
  --audience <type>       Target audience: engineering, pm, exec, mixed (default: ${DEFAULT_AUDIENCE})
  --format <type>         Output format: markdown, slack, html (default: ${DEFAULT_FORMAT})
  --no-shoutouts          Exclude celebratory shout-outs
  --no-metrics            Skip detailed metrics calculations
  --no-retro              Omit retro prompts
  --help, -h              Show this help

Examples:
  bun run agents/sprint-debrief-synthesizer.ts
  bun run agents/sprint-debrief-synthesizer.ts ./my-project --since "2 weeks ago"
  bun run agents/sprint-debrief-synthesizer.ts --audience exec --format slack
  bun run agents/sprint-debrief-synthesizer.ts --output sprint-summary.md --no-shoutouts
  `);
}

function parseOptions(): SprintDebriefOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const projectPath = positionals[0]
    ? resolve(positionals[0])
    : process.cwd();

  const rawSince = values.since;
  const rawUntil = values.until;
  const rawOutput = values.output;
  const rawAudience = values.audience;
  const rawFormat = values.format;

  const since = typeof rawSince === "string" && rawSince.length > 0
    ? rawSince
    : undefined;

  const until = typeof rawUntil === "string" && rawUntil.length > 0
    ? rawUntil
    : undefined;

  const outputFile = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : DEFAULT_OUTPUT_FILE;

  const audience = typeof rawAudience === "string" && rawAudience.length > 0
    ? (rawAudience.toLowerCase() as Audience)
    : DEFAULT_AUDIENCE;

  if (!(["engineering", "pm", "exec", "mixed"] as const).includes(audience)) {
    console.error("❌ Error: Invalid audience. Must be engineering, pm, exec, or mixed");
    process.exit(1);
  }

  const format = typeof rawFormat === "string" && rawFormat.length > 0
    ? (rawFormat.toLowerCase() as OutputFormat)
    : DEFAULT_FORMAT;

  if (!(["markdown", "slack", "html"] as const).includes(format)) {
    console.error("❌ Error: Invalid format. Must be markdown, slack, or html");
    process.exit(1);
  }

  const includeShoutouts = values["no-shoutouts"] !== true;
  const includeMetrics = values["no-metrics"] !== true;
  const includeRetroPrompts = values["no-retro"] !== true;

  return {
    projectPath,
    since,
    until,
    outputFile,
    audience,
    format,
    includeShoutouts,
    includeMetrics,
    includeRetroPrompts,
  };
}

function buildPrompt(options: SprintDebriefOptions): string {
  const { projectPath, since, until, outputFile, audience, format, includeShoutouts, includeMetrics, includeRetroPrompts } = options;
  const resolvedOutputPath = resolve(projectPath, outputFile);

  const timeframeSummary = since || until
    ? `${since ? `since ${since}` : ''}${since && until ? ' ' : ''}${until ? `until ${until}` : ''}`.trim()
    : 'auto-detect the most recent sprint window (default to the last 2 weeks if unsure)';

  return `Prepare a sprint debrief for project at ${projectPath}.

Context window: ${timeframeSummary}.

Deliverables:
1. A succinct executive summary (bullets + narrative) aligned to the ${audience} audience.
2. Chronological sprint timeline covering merges, releases, and major issue updates.
3. ${includeMetrics ? 'Sprint health metrics (lead time, review turnaround, bug reopen rate, deployment frequency) with comparisons to previous sprint if possible.' : 'Skip detailed metric calculations; focus on qualitative highlights.'}
4. ${includeShoutouts ? 'Celebratory shout-outs highlighting contributors and cross-team assists.' : 'Do not include shout-outs or celebration notes.'}
5. ${includeRetroPrompts ? 'Follow-up actions and retro prompts grouped by owner with due dates or checkpoints.' : 'Skip retro prompts; only list critical next steps.'}
6. Format the final deliverable for ${format} consumption (structure markdown tables vs Slack-ready sections accordingly).
7. Persist the final report to ${resolvedOutputPath} via the Write tool (overwrite existing content).

Research workflow suggestions:
- Use Bash with git commands (git log --merges, git shortlog, git show) narrowed to the sprint window to understand PR flow.
- Use Glob/Grep to locate issue tracker exports (e.g., *.linear.json, jira-export*.csv, docs/sprint-notes.md) and summarize updates.
- Inspect deployment manifests, CHANGELOG entries, or release notes to capture production changes.
- Cross-reference review durations using git log --pretty and file metadata; highlight outliers.
- Note scope changes by identifying issues reopened or re-estimated mid-sprint.

Style:
- Keep tone professional yet celebratory where applicable.
- Include tables for metrics when format=${format === 'markdown' ? 'markdown tables' : format}.
- Close with a clear CTA section (e.g., "Next Sprint Prep", "Risks to Monitor").

Double-check that every section requested above is included and that the written report references concrete data sources.`;
}

function buildSystemPrompt(options: SprintDebriefOptions): string {
  const { projectPath, outputFile, audience, format } = options;
  const resolvedOutputPath = resolve(projectPath, outputFile);

  return `You are the Sprint Debrief Synthesizer, an expert agent that consolidates sprint activity into actionable narratives for mixed technical and product audiences.

Responsibilities:
- Reconstruct the sprint timeline using git merges, branch activity, and deployment tags
- Pull in issue tracker context (Linear, Jira, GitHub issues, etc.) by reading local docs and JSON exports when available
- Highlight meaningful scope changes, spillover work, and blockers with responsible owners
- Surface sprint health metrics: lead time, cycle time, review duration, bug reopen counts, and deployment frequency
- Tailor storytelling for the requested audience profile (${audience}) and the desired broadcast format (${format})
- Always save the final deliverable to ${resolvedOutputPath}
- Use Bash, Grep, Glob, and Read to gather evidence; write the recap with Write. Use TodoWrite if you need to push follow-up tasks.

Guardrails:
- Prefer concrete evidence (commit hashes, issue IDs, deployment tags) and cite file paths when making claims
- Provide balanced signal: wins, learnings, risks, and next steps
- Keep timelines chronological and note date boundaries clearly`;
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = [
    "since",
    "until",
    "output",
    "audience",
    "format",
    "no-shoutouts",
    "no-metrics",
    "no-retro",
    "help",
    "h"
  ] as const;

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

const resolvedOutputPath = resolve(options.projectPath, options.outputFile);

console.log("🗂️  Sprint Debrief Synthesizer\n");
console.log(`📁 Project: ${options.projectPath}`);
if (options.since || options.until) {
  console.log(`🕰️  Timeframe: ${options.since ? `since ${options.since}` : ''}${options.since && options.until ? ' ' : ''}${options.until ? `until ${options.until}` : ''}`.trim());
} else {
  console.log('🕰️  Timeframe: auto-detect last completed sprint or recent 2 weeks');
}
console.log(`👥 Audience: ${options.audience}`);
console.log(`📝 Format: ${options.format}`);
console.log(`📄 Output: ${resolvedOutputPath}`);
console.log(`🎉 Shout-outs: ${options.includeShoutouts ? 'enabled' : 'disabled'}`);
console.log(`📈 Metrics: ${options.includeMetrics ? 'enabled' : 'disabled'}`);
console.log(`🔁 Retro prompts: ${options.includeRetroPrompts ? 'enabled' : 'disabled'}`);
console.log();

const prompt = buildPrompt(options);
const systemPrompt = buildSystemPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Bash",
  "Grep",
  "Glob",
  "Read",
  "Write",
  "TodoWrite",
  "Edit",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  'append-system-prompt': systemPrompt,
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
};

// Change to project directory before running
const originalCwd = process.cwd();
process.chdir(options.projectPath);

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Sprint debrief synthesis complete!\n");
    console.log(`📄 Report saved to: ${resolvedOutputPath}`);
    console.log("\nNext steps:");
    console.log("1. Review the sprint debrief report");
    console.log("2. Share with team and stakeholders");
    console.log("3. Use insights for next sprint planning");
  }
  process.chdir(originalCwd);
  process.exit(exitCode);
} catch (error) {
  process.chdir(originalCwd);
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
