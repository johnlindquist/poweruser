#!/usr/bin/env bun

/**
 * Oncall Pager Primer
 *
 * A practical agent that assembles everything an incoming oncall engineer needs
 * to feel confident before the pager hands off.
 *
 * Usage:
 *   bun agents/oncall-pager-primer.ts [service-path] [--incidents=path] [--runbooks=path]
 *                                      [--dashboards=path] [--rotation=path] [--lookback=7d]
 *                                      [--timezone=America/Los_Angeles]
 */

import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";

type CliOptions = {
  servicePath: string;
  incidentPath?: string;
  runbookPath?: string;
  dashboardsPath?: string;
  rotationSheet?: string;
  lookbackWindow: string;
  timezone: string;
};

const defaultTimezone = (() => {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  } catch {
    return "UTC";
  }
})();

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    servicePath: ".",
    lookbackWindow: "7d",
    timezone: defaultTimezone,
  };

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      if (options.servicePath === ".") {
        options.servicePath = arg;
      } else {
        console.warn(`Ignoring extra positional argument: ${arg}`);
      }
      continue;
    }

    const [flag, rawValue] = arg.split("=", 2);
    const value = rawValue?.trim();

    switch (flag) {
      case "--incidents":
        if (value) options.incidentPath = value;
        break;
      case "--runbooks":
        if (value) options.runbookPath = value;
        break;
      case "--dashboards":
        if (value) options.dashboardsPath = value;
        break;
      case "--rotation":
        if (value) options.rotationSheet = value;
        break;
      case "--lookback":
        if (value) options.lookbackWindow = value;
        break;
      case "--timezone":
        if (value) options.timezone = value;
        break;
      default:
        console.warn(`Ignoring unknown flag: ${flag}`);
        break;
    }
  }

  return options;
}

const cli = parseArgs(process.argv.slice(2));
const resolvedPaths = [
  cli.servicePath,
  cli.incidentPath,
  cli.runbookPath,
  cli.dashboardsPath,
  cli.rotationSheet,
]
  .filter((p): p is string => Boolean(p))
  .map((p) => path.resolve(p));

const uniqueAdditionalDirectories = Array.from(new Set(resolvedPaths));

const outputPath = path.resolve("reports/oncall-pager-primer.md");

const systemPrompt = `You are the Oncall Pager Primer, an operational readiness agent focused on giving the next responder a calm, confident start.

## Mission
- Build a single, trustworthy briefing that consolidates incidents, alerts, runbooks, dashboards, and team context.
- Highlight hot spots the new responder must watch during the upcoming shift.
- Preserve momentum by calling out stale documentation, missing diagrams, or brittle automation.
- Produce actionable checklists and communication snippets the engineer can reuse immediately.

## Operating Principles
1. **Collect Signals**
   - Sweep the service directory (${cli.servicePath}) for alert definitions, runbooks, playbooks, dashboards, and health checks.
   - If incident timelines exist (${cli.incidentPath ?? "none"}), summarize what happened recently.
   - Inspect rotation notes (${cli.rotationSheet ?? "none"}) for handoff details.

2. **Synthesize Insights**
   - Cluster alerts by subsystem and flag any noisy or flaky ones from the last ${cli.lookbackWindow} window.
   - Highlight known risky deployments, migrations, or feature flags due soon.
   - Point out missing or outdated documentation with precise file paths.

3. **Produce Outputs**
   - Create a Markdown primer at ${outputPath} with sections: Executive Summary, Key Risks, Alert Heatmap, Ready Checklists, Runbook Gaps, and Suggested Follow-ups.
   - Include a timezone-aware (${cli.timezone}) oncall timeline with recommended check-in times.
   - Draft a Slack-ready kickoff message summarizing the top three risks.

4. **Tooling Discipline**
   - Use \`Glob\` or \`Grep\` to locate configs, monitors, and runbooks.
   - Use \`Read\` to pull context into the report.
   - Use \`Write\` (and \`Edit\` if needed) to publish the primer.
   - Use \`Bash\` for directory prep (e.g., ensure the report folder exists).

5. **Quality Bar**
   - Be concise but decisive; focus on what the responder must review in their first 30 minutes.
   - Prefer checklists, tables, and links over long prose.
   - Always note assumptions, unknowns, and data you could not find.
`;

const userPrompt = `Assemble the oncall pager primer using the options below:

- Service directory: ${path.resolve(cli.servicePath)}
- Incident history: ${cli.incidentPath ? path.resolve(cli.incidentPath) : "(not provided)"}
- Runbooks: ${cli.runbookPath ? path.resolve(cli.runbookPath) : "(not provided)"}
- Dashboards / Metrics notes: ${cli.dashboardsPath ? path.resolve(cli.dashboardsPath) : "(not provided)"}
- Rotation sheet: ${cli.rotationSheet ? path.resolve(cli.rotationSheet) : "(not provided)"}
- Lookback window: ${cli.lookbackWindow}
- Timezone: ${cli.timezone}
- Output file: ${outputPath}

Steps:
1. Inventory the provided directories for incidents, alerts, dashboards, and runbooks.
2. Capture the most recent incidents within the lookback window with timelines and mitigation status.
3. Summarize alert hot spots, dashboard gaps, and automation risks.
4. Document ready-to-run checklists and first-hour actions.
5. Highlight missing information or unclear owners, and propose follow-up tasks.
6. Save the full primer to ${outputPath} and surface a short summary in the terminal.

Be explicit about any assumptions and outline next actions for the oncall engineer.`;

async function main() {
  console.log("🛎️ Oncall Pager Primer");
  console.log("=======================\n");
  console.log(`Service directory: ${path.resolve(cli.servicePath)}`);
  console.log(`Lookback window: ${cli.lookbackWindow}`);
  console.log(`Timezone: ${cli.timezone}`);
  console.log(`Output path: ${outputPath}\n`);

  const result = query({
    prompt: userPrompt,
    options: {
      systemPrompt,
      model: "claude-sonnet-4-5-20250929",
      allowedTools: [
        "Glob",
        "Grep",
        "Read",
        "Write",
        "Edit",
        "Bash",
        "TodoWrite"
      ],
      permissionMode: "acceptEdits",
      cwd: process.cwd(),
      additionalDirectories: uniqueAdditionalDirectories,
      includePartialMessages: false,
    },
  });

  for await (const message of result) {
    if (message.type === "assistant") {
      for (const content of message.message.content) {
        if (content.type === "text") {
          console.log(content.text);
        } else if (content.type === "tool_use") {
          console.log(`\n🔧 Using tool: ${content.name}`);
        }
      }
    } else if (message.type === "result") {
      if (message.subtype === "success") {
        console.log("\n" + "=".repeat(48));
        console.log("✅ Primer Ready");
        console.log("=".repeat(48));
        console.log(message.result);
        console.log(`\n💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`⏱️ Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`🔄 Turns: ${message.num_turns}`);
      } else {
        console.error("\n❌ Primer generation failed:", message.subtype);
        process.exit(1);
      }
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
