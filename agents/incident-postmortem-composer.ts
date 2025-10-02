#!/usr/bin/env -S bun run

/**
 * Incident Postmortem Composer
 *
 * A practical agent that transforms fragmented outage evidence into an actionable, blameless postmortem package.
 *
 * Key capabilities:
 * - Correlates alerts, chat transcripts, dashboards, and commit history into a unified incident timeline
 * - Performs causal analysis to surface primary/root causes, contributing factors, and detection gaps
 * - Produces audience-tailored summaries for engineers, leadership, and customer-facing teams
 * - Enumerates remediation tasks with owners, sequencing, and measurable verification signals
 * - Links related historical incidents to highlight recurring patterns and systemic risks
 * - Generates ready-to-share artifacts (longform report and optional customer comms draft)
 *
 * Usage:
 *   bun run agents/incident-postmortem-composer.ts [incidentWorkspace]
 *     --incident-id INC-1234
 *     --output reports/postmortem.md
 *     --channels engineering,leadership,customer
 *     --timezone UTC
 *     [--no-customer-comms]
 *     [--no-metrics]
 *     [--help]
 */

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface IncidentPostmortemOptions {
  workspacePath: string;
  incidentId?: string;
  outputPath: string;
  audienceChannels: string[];
  timezone: string;
  includeCustomerComms: boolean;
  includeMetrics: boolean;
}

const DEFAULT_OUTPUT_FILE = "incident-postmortem.md";
const DEFAULT_CHANNELS = ["engineering", "leadership", "customer-success"];

function printHelp(): void {
  console.log(`
🚨 Incident Postmortem Composer

Usage:
  bun run agents/incident-postmortem-composer.ts [workspace] [options]

Arguments:
  workspace               Path to incident workspace (default: current directory)

Options:
  --incident-id <id>      Incident identifier (e.g., INC-1234)
  --output <file>         Output file (default: ${DEFAULT_OUTPUT_FILE})
  --channels <list>       Comma-separated audience channels (default: ${DEFAULT_CHANNELS.join(",")})
  --timezone <tz>         Timezone for timestamps (default: system timezone)
  --no-customer-comms     Skip customer communications draft
  --no-metrics            Skip quantitative metrics analysis
  --help, -h              Show this help

Examples:
  bun run agents/incident-postmortem-composer.ts
  bun run agents/incident-postmortem-composer.ts ./incidents/inc-123
  bun run agents/incident-postmortem-composer.ts --incident-id INC-1234 --output reports/postmortem.md
  bun run agents/incident-postmortem-composer.ts --channels engineering,leadership --no-customer-comms
  `);
}

function parseOptions(): IncidentPostmortemOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const workspacePath = positionals[0]
    ? resolve(positionals[0])
    : process.cwd();

  const rawIncidentId = values["incident-id"];
  const incidentId = typeof rawIncidentId === "string" && rawIncidentId.length > 0
    ? rawIncidentId
    : undefined;

  const rawOutput = values.output;
  const outputPath = resolve(
    workspacePath,
    typeof rawOutput === "string" && rawOutput.length > 0
      ? rawOutput
      : DEFAULT_OUTPUT_FILE
  );

  const rawChannels = values.channels;
  const audienceChannels = typeof rawChannels === "string" && rawChannels.length > 0
    ? rawChannels.split(",").map((ch) => ch.trim()).filter(Boolean)
    : DEFAULT_CHANNELS;

  const rawTimezone = values.timezone;
  const timezone = typeof rawTimezone === "string" && rawTimezone.length > 0
    ? rawTimezone
    : (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

  const includeCustomerComms = values["no-customer-comms"] !== true;
  const includeMetrics = values["no-metrics"] !== true;

  return {
    workspacePath,
    incidentId,
    outputPath,
    audienceChannels,
    timezone,
    includeCustomerComms,
    includeMetrics,
  };
}

function formatChannels(channels: string[]): string {
  return channels.join(", ");
}

function buildSystemPrompt(options: IncidentPostmortemOptions): string {
  const channelSummary = formatChannels(options.audienceChannels);

  return `You are the Incident Postmortem Composer, an elite SRE/operations analyst that turns noisy incident artifacts into a crisp, blameless retrospective.

Core directives:
- Operate inside the incident workspace at ${options.workspacePath}.
- Use Bash, Grep, and Read to gather evidence from logs, dashboards exports, runbooks, transcripts, and tickets.
- Correlate timestamps across sources using the ${options.timezone} timezone. Normalize and call out any clock drift.
- Build a precise incident timeline covering detection, escalation, mitigation, and resolution.
- Perform causal analysis to separate primary/root cause, contributing factors, and detection/control gaps.
- Summarize impact in terms of customers, SLIs/SLOs, and business outcomes. Quantify where possible.
- Enumerate remediation work with owners, due dates, and verification signals. Use TodoWrite when helpful.
- Compare with historical incidents in the workspace to spot recurring patterns or follow-up gaps.
- Always produce a blameless tone; focus on systems and safeguards, never individuals.
- Save the polished postmortem report to ${options.outputPath} via the Write tool. Overwrite existing content.
- If customer communications are requested, draft a separate section with externally appropriate language.

Constraints:
- Never fabricate data. If evidence is missing, flag the gap and suggest how to obtain it.
- Link back to file paths, ticket IDs, or log excerpts for every key claim.
- All timestamps in output must note the ${options.timezone} timezone.
- Provide both executive summary and deep-dive sections tailored to ${channelSummary}.
- Keep remediation tasks realistic and measurable.`;
}

function buildPrompt(options: IncidentPostmortemOptions): string {
  const channelSummary = formatChannels(options.audienceChannels);

  return `Assemble a complete incident postmortem for the workspace at ${options.workspacePath}.

Inputs:
- Incident identifier: ${options.incidentId ?? "Detect from evidence (alerts, transcripts, filenames)."}
- Preferred timezone: ${options.timezone}
- Audience channels requiring tailored framing: ${channelSummary}
- Metrics expectations: ${options.includeMetrics ? "Include availability/error-rate/latency metrics, MTTR, customer impact counts, and oncall load." : "Skip quantitative metrics; focus on qualitative analysis and verified observations."}
- Customer communications: ${options.includeCustomerComms ? "Provide an externally-ready customer update draft summarizing impact, mitigation, and next steps." : "Do not produce a customer-facing draft."}

Deliverables:
1. Executive summary: detection, impact, resolution, and current status in <= 6 bullets.
2. Detailed timeline table with timestamps (${options.timezone}), owners, actions, and evidence references.
3. Root cause analysis: primary cause, contributing factors, and detection/control gaps.
4. Impact analysis: affected services, customer segments, SLO breaches, and business KPIs (note unknowns).
5. Remediation plan: prioritized actions with owners, due dates, and verification signals.
6. Knowledge links: related incidents, runbooks, dashboards, and tickets.
7. ${options.includeCustomerComms ? "Customer comms draft" : "Internal communications guidance"}.
8. Next review cadence: suggest follow-up review or drill.

Use Write to persist the final report to ${options.outputPath}. Include callouts for missing data or recommended next data pulls.`;
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["incident-id", "output", "channels", "timezone", "no-customer-comms", "no-metrics", "help", "h"] as const;

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

console.log("🚨 Incident Postmortem Composer\n");
console.log(`📁 Workspace: ${options.workspacePath}`);
console.log(`🆔 Incident ID: ${options.incidentId ?? "(auto-detect from evidence)"}`);
console.log(`🕑 Timezone: ${options.timezone}`);
console.log(`🧑‍🤝‍🧑 Audience channels: ${formatChannels(options.audienceChannels)}`);
console.log(`📝 Output file: ${options.outputPath}`);
console.log(`📊 Metrics: ${options.includeMetrics ? "included" : "skipped"}`);
console.log(`📨 Customer comms draft: ${options.includeCustomerComms ? "included" : "skipped"}`);
console.log("");

const prompt = buildPrompt(options);
const systemPrompt = buildSystemPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Read",
  "Grep",
  "Glob",
  "Write",
  "TodoWrite",
  "Bash",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  "append-system-prompt": systemPrompt,
  allowedTools: allowedTools.join(" "),
  "permission-mode": "acceptEdits",
};

// Change to the workspace directory before running claude
const originalCwd = process.cwd();
process.chdir(options.workspacePath);

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Postmortem composed successfully!\n");
    console.log(`📄 Full report: ${options.outputPath}`);
    console.log("\nNext steps:");
    console.log("1. Review the postmortem report for completeness");
    console.log("2. Share with stakeholders on appropriate channels");
    console.log("3. Track remediation tasks to completion");
    console.log("4. Schedule follow-up review or incident drill");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
} finally {
  process.chdir(originalCwd);
}
