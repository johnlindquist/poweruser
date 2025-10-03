#!/usr/bin/env -S bun run

/**
 * Standup Snapshot Scribe
 *
 * Generates ready-to-share standup updates by mining the current repository for
 * recent activity, emerging blockers, and next-step suggestions.
 *
 * Usage:
 *   bun run agents/standup-snapshot-scribe.ts [options]
 *
 * Options:
 *   --hours=N       Look back N hours when gathering commits (default: 24, max: 96)
 *   --format=TYPE   Output style: slack, markdown, plain, or json (default: slack)
 *   --team=NAME     Include the team label in the report metadata
 *   --project=NAME  Specify the primary project or code area to emphasize
 *   --focus=list    Comma-separated focus areas to spotlight (e.g. infra,api,design)
 *   --notes=text    Extra human-provided context to weave into the summary
 *   --wins          Explicitly call out notable wins and quiet victories
 *   --prs           Prioritize open/merged PR insights when available
 *   --help, -h      Show this help
 *
 * Examples:
 *   bun run agents/standup-snapshot-scribe.ts
 *   bun run agents/standup-snapshot-scribe.ts --hours=48 --format=markdown
 *   bun run agents/standup-snapshot-scribe.ts --team="Platform Team" --project="Auth Service"
 *   bun run agents/standup-snapshot-scribe.ts --focus=infra,api --wins --prs
 */

import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type OutputFormat = "slack" | "markdown" | "plain" | "json";

interface StandupOptions {
  hoursLookback: number;
  outputFormat: OutputFormat;
  teamName: string;
  projectName: string;
  additionalNotes: string;
  focusAreas: string[];
  highlightWins: boolean;
  elevatePullRequests: boolean;
}

const DEFAULT_HOURS = 24;
const DEFAULT_FORMAT: OutputFormat = "slack";
const MAX_HOURS = 96;

function printHelp(): void {
  console.log(`
🗞️  Standup Snapshot Scribe

Usage:
  bun run agents/standup-snapshot-scribe.ts [options]

Options:
  --hours=N       Look back N hours when gathering commits (default: ${DEFAULT_HOURS}, max: ${MAX_HOURS})
  --format=TYPE   Output style: slack, markdown, plain, or json (default: ${DEFAULT_FORMAT})
  --team=NAME     Include the team label in the report metadata
  --project=NAME  Specify the primary project or code area to emphasize
  --focus=list    Comma-separated focus areas to spotlight (e.g. infra,api,design)
  --notes=text    Extra human-provided context to weave into the summary
  --wins          Explicitly call out notable wins and quiet victories
  --prs           Prioritize open/merged PR insights when available
  --help, -h      Show this help

Examples:
  bun run agents/standup-snapshot-scribe.ts
  bun run agents/standup-snapshot-scribe.ts --hours=48 --format=markdown
  bun run agents/standup-snapshot-scribe.ts --team="Platform Team" --project="Auth Service"
  bun run agents/standup-snapshot-scribe.ts --focus=infra,api --wins --prs
  `);
}

function parseList(value?: string): string[] {
  return value
    ? value
        .split(",")
        .map((segment) => segment.trim())
        .filter(Boolean)
    : [];
}

function parseOptions(): StandupOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawFormat = typeof values.format === "string"
    ? values.format.toLowerCase()
    : DEFAULT_FORMAT;
  const allowedFormats: OutputFormat[] = ["slack", "markdown", "plain", "json"];
  const outputFormat: OutputFormat = allowedFormats.includes(rawFormat as OutputFormat)
    ? (rawFormat as OutputFormat)
    : DEFAULT_FORMAT;

  const rawHours = typeof values.hours === "string"
    ? Number.parseInt(values.hours, 10)
    : DEFAULT_HOURS;
  const hoursLookback = Number.isFinite(rawHours)
    ? Math.min(Math.max(rawHours, 1), MAX_HOURS)
    : DEFAULT_HOURS;

  const teamName = typeof values.team === "string" ? values.team : "";
  const projectName = typeof values.project === "string" ? values.project : "";
  const additionalNotes = typeof values.notes === "string" ? values.notes : "";
  const focusAreas = parseList(typeof values.focus === "string" ? values.focus : undefined);
  const highlightWins = values.wins === true;
  const elevatePullRequests = values.prs === true;

  return {
    hoursLookback,
    outputFormat,
    teamName,
    projectName,
    additionalNotes,
    focusAreas,
    highlightWins,
    elevatePullRequests,
  };
}

function buildFormatInstructions(format: OutputFormat): string {
  switch (format) {
    case "markdown":
      return `Return the final response as GitHub-flavored markdown with level-2 headings for each section (Yesterday, Today, Blockers, Wins, Next Steps). Use bullet lists for multi-item sections and bold key callouts.`;
    case "plain":
      return `Return the final response as concise plain text with clear section labels followed by colon-separated summaries on single lines.`;
    case "json":
      return `Return the final response as a compact JSON object with keys: team, project, generated_at, yesterday, today, blockers, wins, next_steps. Values should be arrays of strings except generated_at (ISO 8601 string) and metadata fields.`;
    case "slack":
    default:
      return `Return the final response formatted for Slack with bold section headers, emoji anchors (e.g. :sparkles:, :construction:, :warning:), and bullet items limited to 1-2 sentences each.`;
  }
}

function buildPrompt(options: StandupOptions): string {
  const {
    hoursLookback,
    outputFormat,
    teamName,
    projectName,
    additionalNotes,
    focusAreas,
    highlightWins,
    elevatePullRequests,
  } = options;

  const focusBullets = focusAreas.length
    ? focusAreas.map((topic) => `- ${topic}`).join("\n")
    : "- none specified";

  const formatInstructions = buildFormatInstructions(outputFormat);

  return `You are the Standup Snapshot Scribe, a Claude Code agent that auto-compiles daily standup updates.

## Mission
Synthesize activity from the repository in the current working directory and produce a polished standup summary that the developer can paste into Slack, email, or status reports.

## Configuration
- Team: ${teamName || "unspecified"}
- Project: ${projectName || "unspecified"}
- Lookback window: last ${hoursLookback} hours
- Output format: ${outputFormat}
- Highlight wins aggressively: ${highlightWins ? "yes" : "no"}
- Prioritize pull request insights: ${elevatePullRequests ? "yes" : "only if relevant"}
- Focus areas:\n${focusBullets}

## Core Responsibilities
1. Collect signals about recent work: commits, merged/open PRs, TODO updates, failing CI logs, and noteworthy comments.
2. Distill the findings into yesterday's accomplishments, today's plan, blockers, and next-step recommendations.
3. If wins should be highlighted, ensure meaningful achievements get their own short celebratory bullet.
4. Translate raw data into a human tone that keeps the update positive yet honest.

## Data Collection Guidelines
- Prefer \`Bash\` commands like \`git log --since="${hoursLookback} hours ago" --stat\`, \`git status --short\`, and \`git branch --show-current\` for version control insights.
- Use \`Read\` to open local planning docs, TODO lists, or standup note files if they exist (e.g. README standup sections, docs/standup.md, project-specific trackers).
- When the \`--prs\` flag is set, surface open pull requests by parsing \`git log origin/HEAD..HEAD --oneline\` or local metadata (avoid hitting remote APIs unless already configured locally).
- Capture emerging blockers by scanning recent test logs, TODO comments tagged with BLOCKER/BLOCKED, or CI artifacts in the repo.
- Keep commands read-only—never mutate the repository state or push changes.

## Narrative Expectations
- Mention the most relevant branches or files that changed, but avoid overwhelming detail.
- Link related effort across commits when it helps tell a coherent story.
- Suggest one focused next action for momentum (e.g. which ticket to pick up next, which PR to review, or which test to rerun).
- If there is truly no activity, produce a gentle placeholder update and note recommended priorities.

## Additional Human Notes
${additionalNotes || "(none provided)"}

## Output Requirements
${formatInstructions}
- Always include the sections: Yesterday, Today, Blockers. Add Wins only when there is something to celebrate or when --wins is provided.
- End with a short "Next Steps" segment that blends the gathered context with the configured focus areas.
- Keep the entire response scannable in under 12 lines for Slack/plain formats, or concise bullets for markdown/json.

## Safety
- Do not run long-running scripts, package installers, or destructive git commands.
- Respect repositories without CI or TODO files by inferring plans from the commit messages alone.
- If information is missing, note the gap transparently instead of fabricating details.

Craft the standup update now.`.trim();
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🗞️  Standup Snapshot Scribe starting...\n");
console.log("Configuration:");
console.log(`  - Lookback hours: ${options.hoursLookback}`);
console.log(`  - Output format: ${options.outputFormat}`);
if (options.teamName) {
  console.log(`  - Team: ${options.teamName}`);
}
if (options.projectName) {
  console.log(`  - Project: ${options.projectName}`);
}
if (options.focusAreas.length) {
  console.log(`  - Focus areas: ${options.focusAreas.join(", ")}`);
}
if (options.additionalNotes) {
  console.log(`  - Extra notes: ${options.additionalNotes}`);
}
console.log(`  - Spotlight wins: ${options.highlightWins ? "yes" : "no"}`);
console.log(`  - Elevate PRs: ${options.elevatePullRequests ? "yes" : "no"}`);
console.log();

const prompt = buildPrompt(options);
const settings: Settings = {};

removeAgentFlags([
    "hours",
    "format",
    "team",
    "project",
    "focus",
    "notes",
    "wins",
    "prs",
    "help",
    "h",
  ]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: "Bash Read Write TodoWrite",
  "permission-mode": "default",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✅ Standup draft ready!");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
