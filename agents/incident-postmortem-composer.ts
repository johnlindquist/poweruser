#!/usr/bin/env bun

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
 *   bun agents/incident-postmortem-composer.ts [incidentWorkspace]
 *     --incident-id INC-1234
 *     --output reports/postmortem.md
 *     --channels engineering,leadership,customer
 *     --timezone UTC
 *     [--no-customer-comms]
 *     [--no-metrics]
 */

import path from "node:path";
import process from "node:process";
import { query } from "@anthropic-ai/claude-agent-sdk";

interface CliOptions {
  workspacePath: string;
  incidentId?: string;
  outputPath: string;
  audienceChannels: string[];
  timezone: string;
  includeCustomerComms: boolean;
  includeMetrics: boolean;
}

function parseCliArgs(argv: string[]): CliOptions {
  const positional: string[] = [];
  let incidentId: string | undefined;
  let channels: string[] | undefined;
  let timezone: string | undefined;
  let includeCustomerComms = true;
  let includeMetrics = true;
  let outputValue: string | undefined;

  const expectValue = (args: string[], index: number, flag: string): string => {
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`);
    }
    return value;
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) {
      continue;
    }

    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    switch (arg) {
      case "--incident-id": {
        incidentId = expectValue(argv, i, "--incident-id");
        i += 1;
        break;
      }
      case "--channels": {
        const value = expectValue(argv, i, "--channels");
        channels = value.split(",").map((chunk) => chunk.trim()).filter(Boolean);
        i += 1;
        break;
      }
      case "--timezone": {
        timezone = expectValue(argv, i, "--timezone");
        i += 1;
        break;
      }
      case "--output": {
        outputValue = expectValue(argv, i, "--output");
        i += 1;
        break;
      }
      case "--no-customer-comms": {
        includeCustomerComms = false;
        break;
      }
      case "--no-metrics": {
        includeMetrics = false;
        break;
      }
      default: {
        throw new Error(`Unknown flag: ${arg}`);
      }
    }
  }

  const resolvedWorkspace = positional.length > 0
    ? path.resolve(process.cwd(), positional[0]!)
    : process.cwd();

  const resolvedOutput = path.resolve(
    resolvedWorkspace,
    outputValue ?? "incident-postmortem.md",
  );

  return {
    workspacePath: resolvedWorkspace,
    incidentId,
    outputPath: resolvedOutput,
    audienceChannels: channels && channels.length > 0
      ? channels
      : ["engineering", "leadership", "customer-success"],
    timezone: timezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"),
    includeCustomerComms,
    includeMetrics,
  };
}

function formatChannels(channels: string[]): string {
  return channels.map((entry) => entry.trim()).filter(Boolean).join(", ");
}

async function main(): Promise<void> {
  let options: CliOptions;

  try {
    options = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Failed to parse arguments:", message);
    console.error(
      "Usage: bun agents/incident-postmortem-composer.ts [incidentWorkspace] --incident-id INC-123 --output reports/postmortem.md --channels engineering,leadership,customer --timezone UTC [--no-customer-comms] [--no-metrics]",
    );
    process.exit(1);
    return;
  }

  console.log("🚨 Incident Postmortem Composer");
  console.log("================================\n");
  console.log(`📁 Workspace: ${options.workspacePath}`);
  console.log(`🆔 Incident ID: ${options.incidentId ?? "(auto-detect from evidence)"}`);
  console.log(`🕑 Timezone: ${options.timezone}`);
  console.log(`🧑‍🤝‍🧑 Audience channels: ${formatChannels(options.audienceChannels)}`);
  console.log(`📝 Output file: ${options.outputPath}`);
  console.log(`📊 Metrics: ${options.includeMetrics ? "included" : "skipped"}`);
  console.log(`📨 Customer comms draft: ${options.includeCustomerComms ? "included" : "skipped"}`);
  console.log();

  const systemPrompt = `You are the Incident Postmortem Composer, an elite SRE/operations analyst that turns noisy incident artifacts into a crisp, blameless retrospective.

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
- Provide both executive summary and deep-dive sections tailored to ${formatChannels(options.audienceChannels)}.
- Keep remediation tasks realistic and measurable.`;

  const channelSummary = options.audienceChannels.join(", ");

  const userPrompt = `Assemble a complete incident postmortem for the workspace at ${options.workspacePath}.

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

  const result = query({
    prompt: userPrompt,
    options: {
      systemPrompt,
      model: "claude-sonnet-4-5-20250929",
      cwd: options.workspacePath,
      allowedTools: ["Read", "Grep", "Write", "TodoWrite", "Bash", "Glob"],
      permissionMode: "acceptEdits",
    },
  });

  for await (const message of result) {
    if (message.type === "assistant") {
      for (const content of message.message.content) {
        if (content.type === "text") {
          console.log(content.text);
        }
        if (content.type === "tool_use") {
          console.log(`\n🔧 Using tool: ${content.name}`);
        }
      }
    }

    if (message.type === "result") {
      if (message.subtype === "success") {
        console.log("\n" + "=".repeat(60));
        console.log("✅ Postmortem composed successfully");
        console.log("=".repeat(60));
        console.log(message.result);
        console.log(`\n💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`🔄 Turns: ${message.num_turns}`);
      } else {
        console.error("\n❌ Postmortem generation failed:", message.subtype);
        process.exit(1);
      }
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
