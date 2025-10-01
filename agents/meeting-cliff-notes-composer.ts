#!/usr/bin/env bun

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

import fs from "node:fs/promises";
import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";

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
  console.log(`\nMeeting Cliff Notes Composer\n\nUsage:\n  bun run agents/meeting-cliff-notes-composer.ts [options]\n\nFor detailed flag descriptions see the file header.\n`);
}

function expectValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
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

function parseArgs(argv: string[]): MeetingCliffNotesOptions {
  if (argv.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  const options: MeetingCliffNotesOptions = {
    title: "Engineering Meeting",
    attendees: [],
    focusAreas: [],
    transcriptPaths: [],
    docPaths: [],
    manualNotes: [],
    extraInstructions: [],
    followupWindowDays: 5,
    summaryLength: "standard",
    format: "markdown",
    highlightRisks: true,
    includeQuotes: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (typeof token === "undefined") {
      continue;
    }

    switch (token) {
      case "--title": {
        options.title = expectValue(argv, ++index, "--title");
        break;
      }
      case "--date": {
        options.meetingDate = expectValue(argv, ++index, "--date");
        break;
      }
      case "--timezone": {
        options.timezone = expectValue(argv, ++index, "--timezone");
        break;
      }
      case "--team": {
        options.team = expectValue(argv, ++index, "--team");
        break;
      }
      case "--project": {
        options.project = expectValue(argv, ++index, "--project");
        break;
      }
      case "--attendee": {
        options.attendees.push(expectValue(argv, ++index, "--attendee"));
        break;
      }
      case "--attendees": {
        const listValue = expectValue(argv, ++index, "--attendees");
        options.attendees.push(...parseList(listValue));
        break;
      }
      case "--focus": {
        const focusValue = expectValue(argv, ++index, "--focus");
        options.focusAreas = [...options.focusAreas, ...parseList(focusValue)];
        break;
      }
      case "--transcript": {
        options.transcriptPaths.push(expectValue(argv, ++index, "--transcript"));
        break;
      }
      case "--doc": {
        options.docPaths.push(expectValue(argv, ++index, "--doc"));
        break;
      }
      case "--note": {
        options.manualNotes.push(expectValue(argv, ++index, "--note"));
        break;
      }
      case "--extra": {
        options.extraInstructions.push(expectValue(argv, ++index, "--extra"));
        break;
      }
      case "--summary-length": {
        const value = expectValue(argv, ++index, "--summary-length");
        if (value !== "digest" && value !== "standard" && value !== "deep") {
          throw new Error("--summary-length must be digest, standard, or deep");
        }
        options.summaryLength = value;
        break;
      }
      case "--format": {
        const value = expectValue(argv, ++index, "--format");
        if (value !== "slack" && value !== "markdown" && value !== "notion" && value !== "email") {
          throw new Error("--format must be slack, markdown, notion, or email");
        }
        options.format = value;
        break;
      }
      case "--followup-days": {
        const raw = expectValue(argv, ++index, "--followup-days");
        const parsed = Number.parseInt(raw, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
          throw new Error("--followup-days must be a positive integer");
        }
        options.followupWindowDays = parsed;
        break;
      }
      case "--highlight-risks": {
        options.highlightRisks = true;
        break;
      }
      case "--no-highlight-risks": {
        options.highlightRisks = false;
        break;
      }
      case "--include-quotes": {
        options.includeQuotes = true;
        break;
      }
      default: {
        if (token.startsWith("--")) {
          throw new Error(`Unknown flag: ${token}`);
        }
        options.manualNotes.push(token);
      }
    }
  }

  return options;
}

async function readResources(paths: string[], kind: "Transcript" | "Document"): Promise<LoadedResource[]> {
  const resources: LoadedResource[] = [];

  for (const relativePath of paths) {
    const resolved = path.resolve(relativePath);
    try {
      const content = await fs.readFile(resolved, "utf8");
      resources.push({
        label: `${kind}: ${path.basename(resolved)}`,
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

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (
      options.transcriptPaths.length === 0 &&
      options.docPaths.length === 0 &&
      options.manualNotes.length === 0
    ) {
      console.warn("⚠️  No transcripts, documents, or notes supplied. The agent will rely on defaults.");
    }

    const [transcripts, docs, notes] = await Promise.all([
      readResources(options.transcriptPaths, "Transcript"),
      readResources(options.docPaths, "Document"),
      Promise.resolve(buildManualNotes(options.manualNotes)),
    ]);

    const prompt = buildPrompt(options, transcripts, docs, notes);

    console.log("🗒️  Composing meeting cliff notes...\n");

    const result = query({
      prompt,
      options: {
        allowedTools: ["Read", "Grep", "Glob", "TodoWrite", "Write", "WebFetch"],
        permissionMode: "bypassPermissions",
        maxTurns: 8,
      },
    });

    let finalReport = "";

    for await (const message of result) {
      if (message.type === "result" && message.subtype === "success") {
        finalReport = message.result;
      }
    }

    if (finalReport.length === 0) {
      throw new Error("No output produced by the agent.");
    }

    console.log(finalReport);
    console.log("\n✅ Briefing ready.");
  } catch (error) {
    console.error("❌ Unable to compose meeting cliff notes:");
    console.error((error as Error).message);
    process.exit(1);
  }
}

await main();
