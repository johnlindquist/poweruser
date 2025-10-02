#!/usr/bin/env -S bun run

/**
 * Meeting Cliff Notes Composer
 *
 * Distills engineering meetings into high-signal briefings, decisions, action items,
 * and follow-ups tailored for the audiences you care about.
 *
 * Usage:
 *   bun run agents/meeting-cliff-notes-composer.ts \
 *     --title "Sprint Review" \
 *     --date 2024-06-01 \
 *     --timezone "America/Los_Angeles" \
 *     --attendees "Alice,Bob,Chen" \
 *     --transcript path/to/transcript.md \
 *     --doc path/to/board-export.md \
 *     --note "QA needs staging credentials refreshed" \
 *     --format slack \
 *     --summary-length digest \
 *     --focus delivery,quality \
 *     --followup-days 5 \
 *     --highlight-risks \
 *     --include-quotes
 *
 * Flags:
 *   --title <text>              Meeting title (default: "Engineering Meeting")
 *   --date <ISO>                Meeting date (e.g. 2024-06-01)
 *   --timezone <tz>             IANA timezone (e.g. America/New_York)
 *   --team <name>               Team or group name
 *   --project <name>            Primary project or initiative discussed
 *   --attendee <name>           Attendee (repeatable)
 *   --attendees <list>          Comma-separated attendee list
 *   --focus <list>              Comma-separated focus areas or hot topics
 *   --transcript <path>         Transcript file (repeatable)
 *   --doc <path>                Supplemental document or artifact (repeatable)
 *   --note <text>               Manual highlight to include (repeatable)
 *   --summary-length <mode>     digest | standard | deep (default: standard)
 *   --format <mode>             slack | markdown | notion | email (default: markdown)
 *   --followup-days <number>    Default due-date window for follow-ups (default: 5)
 *   --highlight-risks           Emphasize risks in the output (default: on)
 *   --no-highlight-risks        Disable risk emphasis
 *   --include-quotes            Include short verbatim quotes when useful
 *   --extra <text>              Additional instructions for the agent (repeatable)
 *   --help                      Show this help message
 */

import { promises as fs } from "node:fs";
import { resolve, basename } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type OutputFormat = "slack" | "markdown" | "notion" | "email";
type SummaryLength = "digest" | "standard" | "deep";

type LoadedResource = {
  label: string;
  path: string;
  content: string;
};

interface MeetingCliffNotesOptions {
  title: string;
  meetingDate?: string;
  timezone?: string;
  team?: string;
  project?: string;
  attendees: string[];
  focusAreas: string[];
  transcriptPaths: string[];
  docPaths: string[];
  manualNotes: string[];
  extraInstructions: string[];
  followupWindowDays?: number;
  summaryLength: SummaryLength;
  format: OutputFormat;
  highlightRisks: boolean;
  includeQuotes: boolean;
}

function printHelp(): void {
  console.log(`
🗒️  Meeting Cliff Notes Composer

Usage:
  bun run agents/meeting-cliff-notes-composer.ts [options]

Arguments:
  Positional arguments are treated as manual notes

Options:
  --title <text>              Meeting title (default: "Engineering Meeting")
  --date <ISO>                Meeting date (e.g. 2024-06-01)
  --timezone <tz>             IANA timezone (e.g. America/New_York)
  --team <name>               Team or group name
  --project <name>            Primary project or initiative discussed
  --attendee <name>           Attendee (repeatable)
  --attendees <list>          Comma-separated attendee list
  --focus <list>              Comma-separated focus areas or hot topics
  --transcript <path>         Transcript file (repeatable)
  --doc <path>                Supplemental document or artifact (repeatable)
  --note <text>               Manual highlight to include (repeatable)
  --summary-length <mode>     digest | standard | deep (default: standard)
  --format <mode>             slack | markdown | notion | email (default: markdown)
  --followup-days <number>    Default due-date window for follow-ups (default: 5)
  --highlight-risks           Emphasize risks in the output (default: on)
  --no-highlight-risks        Disable risk emphasis
  --include-quotes            Include short verbatim quotes when useful
  --extra <text>              Additional instructions for the agent (repeatable)
  --help, -h                  Show this help message

Examples:
  bun run agents/meeting-cliff-notes-composer.ts --title "Sprint Review"
  bun run agents/meeting-cliff-notes-composer.ts --transcript meeting.txt --format slack
  bun run agents/meeting-cliff-notes-composer.ts --attendees "Alice,Bob" --highlight-risks
  `);
}

function parseList(input: string | undefined): string[] {
  if (!input) {
    return [];
  }
  return input
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseOptions(): MeetingCliffNotesOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawTitle = values.title;
  const title = typeof rawTitle === "string" && rawTitle.length > 0
    ? rawTitle
    : "Engineering Meeting";

  const rawSummaryLength = values["summary-length"];
  const summaryLength = typeof rawSummaryLength === "string" && rawSummaryLength.length > 0
    ? rawSummaryLength
    : "standard";

  if (summaryLength !== "digest" && summaryLength !== "standard" && summaryLength !== "deep") {
    console.error("❌ Error: --summary-length must be digest, standard, or deep");
    process.exit(1);
  }

  const rawFormat = values.format;
  const format = typeof rawFormat === "string" && rawFormat.length > 0
    ? rawFormat
    : "markdown";

  if (format !== "slack" && format !== "markdown" && format !== "notion" && format !== "email") {
    console.error("❌ Error: --format must be slack, markdown, notion, or email");
    process.exit(1);
  }

  const rawFollowupDays = values["followup-days"];
  const followupDaysStr = typeof rawFollowupDays === "string" && rawFollowupDays.length > 0
    ? rawFollowupDays
    : "5";
  const followupDays = Number.parseInt(followupDaysStr, 10);

  if (Number.isNaN(followupDays) || followupDays <= 0) {
    console.error("❌ Error: --followup-days must be a positive integer");
    process.exit(1);
  }

  const attendees: string[] = [];
  const rawAttendee = values.attendee;
  if (Array.isArray(rawAttendee)) {
    attendees.push(...rawAttendee);
  } else if (typeof rawAttendee === "string") {
    attendees.push(rawAttendee);
  }

  const rawAttendees = values.attendees;
  if (typeof rawAttendees === "string") {
    attendees.push(...parseList(rawAttendees));
  }

  const rawFocus = values.focus;
  const focusAreas = typeof rawFocus === "string" ? parseList(rawFocus) : [];

  const noHighlightRisks = values["no-highlight-risks"] === true;
  const highlightRisks = !noHighlightRisks;

  const includeQuotes = values["include-quotes"] === true;

  const rawTranscript = values.transcript;
  const transcriptPaths: string[] = [];
  if (Array.isArray(rawTranscript)) {
    transcriptPaths.push(...rawTranscript);
  } else if (typeof rawTranscript === "string") {
    transcriptPaths.push(rawTranscript);
  }

  const rawDoc = values.doc;
  const docPaths: string[] = [];
  if (Array.isArray(rawDoc)) {
    docPaths.push(...rawDoc);
  } else if (typeof rawDoc === "string") {
    docPaths.push(rawDoc);
  }

  const rawNote = values.note;
  const manualNotes: string[] = [];
  if (Array.isArray(rawNote)) {
    manualNotes.push(...rawNote);
  } else if (typeof rawNote === "string") {
    manualNotes.push(rawNote);
  }
  manualNotes.push(...positionals);

  const rawExtra = values.extra;
  const extraInstructions: string[] = [];
  if (Array.isArray(rawExtra)) {
    extraInstructions.push(...rawExtra);
  } else if (typeof rawExtra === "string") {
    extraInstructions.push(rawExtra);
  }

  const rawDate = values.date;
  const meetingDate = typeof rawDate === "string" && rawDate.length > 0 ? rawDate : undefined;

  const rawTimezone = values.timezone;
  const timezone = typeof rawTimezone === "string" && rawTimezone.length > 0 ? rawTimezone : undefined;

  const rawTeam = values.team;
  const team = typeof rawTeam === "string" && rawTeam.length > 0 ? rawTeam : undefined;

  const rawProject = values.project;
  const project = typeof rawProject === "string" && rawProject.length > 0 ? rawProject : undefined;

  return {
    title,
    meetingDate,
    timezone,
    team,
    project,
    attendees,
    focusAreas,
    transcriptPaths,
    docPaths,
    manualNotes,
    extraInstructions,
    followupWindowDays: followupDays,
    summaryLength: summaryLength as SummaryLength,
    format: format as OutputFormat,
    highlightRisks,
    includeQuotes,
  };
}

async function readResources(paths: string[], kind: "Transcript" | "Document"): Promise<LoadedResource[]> {
  const resources: LoadedResource[] = [];

  for (const relativePath of paths) {
    const resolved = resolve(relativePath);
    try {
      const content = await fs.readFile(resolved, "utf8");
      resources.push({
        label: `${kind}: ${basename(resolved)}`,
        path: resolved,
        content: content.trim(),
      });
    } catch (error) {
      throw new Error(`Unable to read ${kind.toLowerCase()} at ${resolved}: ${(error as Error).message}`);
    }
  }

  return resources;
}

function buildManualNotes(notes: string[]): LoadedResource[] {
  return notes.map((note, index) => ({
    label: `Manual Note ${index + 1}`,
    path: "inline",
    content: note.trim(),
  }));
}

function buildFormatGuide(format: OutputFormat): string {
  switch (format) {
    case "slack":
      return "Format the briefing as a Slack message with emoji headers, bullet lists, and bold section titles. Keep line lengths short.";
    case "notion":
      return "Use Markdown-compatible headings (##) and bullet lists that render cleanly in Notion. Provide a table-style list for action items using pipes.";
    case "email":
      return "Write a crisp email body including Subject, Greeting, Body, and Sign-off. Body sections should mirror the requested outline.";
    case "markdown":
    default:
      return "Produce GitHub-flavored Markdown with clear headings, bullet lists, and tables where helpful.";
  }
}

function buildLengthGuide(summaryLength: SummaryLength): string {
  switch (summaryLength) {
    case "digest":
      return "Prioritize only the most critical 3 insights per section. Keep the overall briefing under 200 words.";
    case "deep":
      return "Provide thorough detail with evidence, timestamps, and context. Up to 6 bullet points per section.";
    case "standard":
    default:
      return "Balance clarity and depth with 3-4 concise bullet points per section.";
  }
}

function buildPrompt(
  options: MeetingCliffNotesOptions,
  transcripts: LoadedResource[],
  docs: LoadedResource[],
  manualNotes: LoadedResource[],
): string {
  const metadataLines: string[] = [
    `Title: ${options.title}`,
  ];

  if (options.meetingDate) {
    metadataLines.push(`Date: ${options.meetingDate}`);
  }

  if (options.timezone) {
    metadataLines.push(`Timezone: ${options.timezone}`);
  }

  if (options.team) {
    metadataLines.push(`Team: ${options.team}`);
  }

  if (options.project) {
    metadataLines.push(`Project: ${options.project}`);
  }

  if (options.attendees.length > 0) {
    metadataLines.push(`Attendees: ${options.attendees.join(", ")}`);
  }

  if (options.focusAreas.length > 0) {
    metadataLines.push(`Focus Areas: ${options.focusAreas.join(", ")}`);
  }

  if (typeof options.followupWindowDays === "number") {
    metadataLines.push(`Default Follow-up Due Window: ${options.followupWindowDays} day(s)`);
  }

  metadataLines.push(`Highlight Risks: ${options.highlightRisks ? "yes" : "no"}`);
  metadataLines.push(`Include Quotes: ${options.includeQuotes ? "yes" : "no"}`);
  metadataLines.push(`Summary Depth: ${options.summaryLength}`);
  metadataLines.push(`Output Format: ${options.format}`);

  const extraInstructionBlock = options.extraInstructions.length > 0
    ? options.extraInstructions.map((line, index) => `${index + 1}. ${line}`).join("\n")
    : "(none)";

  const resourceBlocks: string[] = [];

  for (const resource of [...transcripts, ...docs, ...manualNotes]) {
    if (resource.content.length === 0) {
      continue;
    }

    resourceBlocks.push(
      `<<<${resource.label}>>>\n${resource.content}\n<<<END ${resource.label}>>>`
    );
  }

  const resourcesSection = resourceBlocks.length > 0
    ? resourceBlocks.join("\n\n")
    : "(No source material supplied. Base your response on standard meeting best practices and flag the missing context.)";

  const formatGuide = buildFormatGuide(options.format);
  const lengthGuide = buildLengthGuide(options.summaryLength);

  return `You are the Meeting Cliff Notes Composer, a diligent staff-level communications partner who transforms raw meeting material into clear deliverables for busy engineering teams.

# Meeting Metadata
${metadataLines.map((line) => `- ${line}`).join("\n")}

# Output Directives
- ${formatGuide}
- ${lengthGuide}
- Always begin with a two-line executive highlight.
- Follow with clearly headed sections: Quick Summary, Decisions & Outcomes, Action Items, Risks & Watchpoints, Open Questions, Signals & Follow-ups.
- In Action Items, include owner, due date (default to +${options.followupWindowDays ?? 5} days if missing), and the triggering context.
- If ${options.includeQuotes ? "appropriate quotes exist" : "no quotes are explicit"}, ${options.includeQuotes ? "include up to two short verbatim quotes to reinforce key points." : "only paraphrase context rather than inventing quotes."}
- ${options.highlightRisks ? "Call out risk gradients and confidence levels." : "Mention risks only if they are explicit; otherwise focus on positive momentum and next steps."}
- Close with a one-line broadcast recommendation indicating who should read the recap beyond attendees.
- If information is missing, acknowledge it transparently and suggest what data is needed.

# Extra Human Instructions
${extraInstructionBlock}

# Source Material
${resourcesSection}

Deliver the final briefing only, without preamble or tool logs.`;
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = [
    "title",
    "date",
    "timezone",
    "team",
    "project",
    "attendee",
    "attendees",
    "focus",
    "transcript",
    "doc",
    "note",
    "extra",
    "summary-length",
    "format",
    "followup-days",
    "highlight-risks",
    "no-highlight-risks",
    "include-quotes",
    "help",
    "h",
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

console.log("🗒️  Meeting Cliff Notes Composer\n");
console.log(`Title: ${options.title}`);
if (options.meetingDate) console.log(`Date: ${options.meetingDate}`);
if (options.timezone) console.log(`Timezone: ${options.timezone}`);
if (options.team) console.log(`Team: ${options.team}`);
if (options.project) console.log(`Project: ${options.project}`);
if (options.attendees.length > 0) console.log(`Attendees: ${options.attendees.join(", ")}`);
console.log(`Format: ${options.format}`);
console.log(`Summary Length: ${options.summaryLength}`);
console.log("");

if (
  options.transcriptPaths.length === 0 &&
  options.docPaths.length === 0 &&
  options.manualNotes.length === 0
) {
  console.warn("⚠️  No transcripts, documents, or notes supplied. The agent will rely on defaults.\n");
}

const [transcripts, docs, notes] = await Promise.all([
  readResources(options.transcriptPaths, "Transcript"),
  readResources(options.docPaths, "Document"),
  Promise.resolve(buildManualNotes(options.manualNotes)),
]);

const prompt = buildPrompt(options, transcripts, docs, notes);
const settings: Settings = {};

const allowedTools = [
  "Read",
  "Grep",
  "Glob",
  "TodoWrite",
  "Write",
  "WebFetch",
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
    console.log("\n✅ Briefing ready.");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Unable to compose meeting cliff notes:");
  console.error((error as Error).message);
  process.exit(1);
}
