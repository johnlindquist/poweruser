#!/usr/bin/env bun

/**
 * Standup Snapshot Scribe
 *
 * Generates ready-to-share standup updates by mining the current repository for
 * recent activity, emerging blockers, and next-step suggestions.
 *
 * Usage:
 *   bun run agents/standup-snapshot-scribe.ts [--hours=24] [--format=slack|markdown|plain|json]
 *                                            [--team=TeamName] [--project=ProjectName]
 *                                            [--focus=infra,design] [--notes="extra context"]
 *                                            [--wins] [--prs]
 *
 * Flags:
 *   --hours=N       Look back N hours when gathering commits (default: 24, max: 96)
 *   --format=TYPE   Output style: slack, markdown, plain, or json (default: slack)
 *   --team=NAME     Include the team label in the report metadata
 *   --project=NAME  Specify the primary project or code area to emphasize
 *   --focus=list    Comma-separated focus areas to spotlight (e.g. infra,api,design)
 *   --notes=text    Extra human-provided context to weave into the summary
 *   --wins          Explicitly call out notable wins and quiet victories
 *   --prs           Prioritize open/merged PR insights when available
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

type OutputFormat = "slack" | "markdown" | "plain" | "json";

const args = process.argv.slice(2);

const getArg = (flag: string): string | undefined => {
  for (let index = 0; index < args.length; index += 1) {
    const entry = args[index];
    if (typeof entry === "undefined") {
      continue;
    }
    if (entry === flag) {
      const next = args[index + 1];
      if (next && !next.startsWith("--")) {
        return next;
      }
      return undefined;
    }
    if (entry.startsWith(`${flag}=`)) {
      return entry.slice(flag.length + 1);
    }
  }
  return undefined;
};

const parseList = (value?: string): string[] =>
  value
    ? value
        .split(",")
        .map((segment) => segment.trim())
        .filter(Boolean)
    : [];

const rawFormat = (getArg("--format") ?? "slack").toLowerCase();
const allowedFormats: OutputFormat[] = ["slack", "markdown", "plain", "json"];
const outputFormat: OutputFormat = (allowedFormats.includes(rawFormat as OutputFormat)
  ? (rawFormat as OutputFormat)
  : "slack");

const rawHours = Number.parseInt(getArg("--hours") ?? "24", 10);
const hoursLookback = Number.isFinite(rawHours)
  ? Math.min(Math.max(rawHours, 1), 96)
  : 24;

const teamName = getArg("--team") ?? "";
const projectName = getArg("--project") ?? "";
const additionalNotes = getArg("--notes") ?? "";
const focusAreas = parseList(getArg("--focus"));
const highlightWins = args.includes("--wins");
const elevatePullRequests = args.includes("--prs");

const focusBullets = focusAreas.length
  ? focusAreas.map((topic) => `- ${topic}`).join("\n")
  : "- none specified";

let formatInstructions: string;

switch (outputFormat) {
  case "markdown":
    formatInstructions = `Return the final response as GitHub-flavored markdown with level-2 headings for each section (Yesterday, Today, Blockers, Wins, Next Steps). Use bullet lists for multi-item sections and bold key callouts.`;
    break;
  case "plain":
    formatInstructions = `Return the final response as concise plain text with clear section labels followed by colon-separated summaries on single lines.`;
    break;
  case "json":
    formatInstructions = `Return the final response as a compact JSON object with keys: team, project, generated_at, yesterday, today, blockers, wins, next_steps. Values should be arrays of strings except generated_at (ISO 8601 string) and metadata fields.`;
    break;
  case "slack":
  default:
    formatInstructions = `Return the final response formatted for Slack with bold section headers, emoji anchors (e.g. :sparkles:, :construction:, :warning:), and bullet items limited to 1-2 sentences each.`;
    break;
}

const prompt = `You are the Standup Snapshot Scribe, a Claude Code agent that auto-compiles daily standup updates.

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

Craft the standup update now.`;

async function main() {
  console.log("🗞️  Standup Snapshot Scribe starting...\n");
  console.log("Configuration:");
  console.log(`  - Lookback hours: ${hoursLookback}`);
  console.log(`  - Output format: ${outputFormat}`);
  if (teamName) {
    console.log(`  - Team: ${teamName}`);
  }
  if (projectName) {
    console.log(`  - Project: ${projectName}`);
  }
  if (focusAreas.length) {
    console.log(`  - Focus areas: ${focusAreas.join(", ")}`);
  }
  if (additionalNotes) {
    console.log(`  - Extra notes: ${additionalNotes}`);
  }
  console.log(`  - Spotlight wins: ${highlightWins ? "yes" : "no"}`);
  console.log(`  - Elevate PRs: ${elevatePullRequests ? "yes" : "no"}`);
  console.log();

  const result = query({
    prompt,
    options: {
      allowedTools: ["Bash", "Read", "Write", "TodoWrite"],
      permissionMode: "default",
      includePartialMessages: false,
      maxTurns: 18,
    },
  });

  for await (const message of result) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          console.log(block.text);
        }
      }
    } else if (message.type === "result") {
      if (message.subtype === "success") {
        console.log("\n✅ Standup draft ready!");
        console.log(`  Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`  Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`  Turns: ${message.num_turns}`);
      } else {
        console.error("\n❌ Standup generation did not complete successfully.");
        process.exit(1);
      }
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
