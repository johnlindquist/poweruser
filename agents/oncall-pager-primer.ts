#!/usr/bin/env -S bun run

/**
 * Oncall Pager Primer
 *
 * A practical agent that assembles everything an incoming oncall engineer needs
 * to feel confident before the pager hands off.
 *
 * Usage:
 *   bun run agents/oncall-pager-primer.ts [service-path] [options]
 *
 * Examples:
 *   bun run agents/oncall-pager-primer.ts ./services/api
 *   bun run agents/oncall-pager-primer.ts . --incidents docs/incidents --runbooks docs/runbooks
 *   bun run agents/oncall-pager-primer.ts ./service --lookback 14d --timezone America/New_York
 */

import { resolve } from "node:path";
import { claude, parsedArgs, removeAgentFlags } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface OncallPrimerOptions {
  servicePath: string;
  incidentPath?: string;
  runbookPath?: string;
  dashboardsPath?: string;
  rotationSheet?: string;
  lookbackWindow: string;
  timezone: string;
  reportFile: string;
}

const DEFAULT_LOOKBACK = "7d";
const DEFAULT_REPORT_FILE = "reports/oncall-pager-primer.md";

const defaultTimezone = (() => {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  } catch {
    return "UTC";
  }
})();

function printHelp(): void {
  console.log(`
🛎️ Oncall Pager Primer

Usage:
  bun run agents/oncall-pager-primer.ts [service-path] [options]

Arguments:
  service-path            Path to service directory (default: current directory)

Options:
  --incidents <path>      Path to incident history files
  --runbooks <path>       Path to runbook documentation
  --dashboards <path>     Path to dashboard/metrics notes
  --rotation <path>       Path to rotation schedule/notes
  --lookback <window>     Lookback window (default: ${DEFAULT_LOOKBACK})
  --timezone <tz>         Timezone for schedules (default: system timezone)
  --report <file>         Output report file (default: ${DEFAULT_REPORT_FILE})
  --help, -h              Show this help

Examples:
  bun run agents/oncall-pager-primer.ts ./services/api
  bun run agents/oncall-pager-primer.ts . --incidents docs/incidents --runbooks docs/runbooks
  bun run agents/oncall-pager-primer.ts ./service --lookback 14d --timezone America/New_York
  `);
}

function parseOptions(): OncallPrimerOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const servicePath = positionals[0] || ".";

  const rawIncidents = values.incidents;
  const rawRunbooks = values.runbooks;
  const rawDashboards = values.dashboards;
  const rawRotation = values.rotation;
  const rawLookback = values.lookback;
  const rawTimezone = values.timezone;
  const rawReport = values.report;

  const incidentPath = typeof rawIncidents === "string" && rawIncidents.length > 0
    ? resolve(rawIncidents)
    : undefined;

  const runbookPath = typeof rawRunbooks === "string" && rawRunbooks.length > 0
    ? resolve(rawRunbooks)
    : undefined;

  const dashboardsPath = typeof rawDashboards === "string" && rawDashboards.length > 0
    ? resolve(rawDashboards)
    : undefined;

  const rotationSheet = typeof rawRotation === "string" && rawRotation.length > 0
    ? resolve(rawRotation)
    : undefined;

  const lookbackWindow = typeof rawLookback === "string" && rawLookback.length > 0
    ? rawLookback
    : DEFAULT_LOOKBACK;

  const timezone = typeof rawTimezone === "string" && rawTimezone.length > 0
    ? rawTimezone
    : defaultTimezone;

  const reportFile = typeof rawReport === "string" && rawReport.length > 0
    ? rawReport
    : DEFAULT_REPORT_FILE;

  return {
    servicePath: resolve(servicePath),
    incidentPath,
    runbookPath,
    dashboardsPath,
    rotationSheet,
    lookbackWindow,
    timezone,
    reportFile,
  };
}

function buildSystemPrompt(options: OncallPrimerOptions): string {
  const { servicePath, incidentPath, rotationSheet, lookbackWindow, timezone, reportFile } = options;

  return `You are the Oncall Pager Primer, an operational readiness agent focused on giving the next responder a calm, confident start.

## Mission
- Build a single, trustworthy briefing that consolidates incidents, alerts, runbooks, dashboards, and team context.
- Highlight hot spots the new responder must watch during the upcoming shift.
- Preserve momentum by calling out stale documentation, missing diagrams, or brittle automation.
- Produce actionable checklists and communication snippets the engineer can reuse immediately.

## Operating Principles
1. **Collect Signals**
   - Sweep the service directory (${servicePath}) for alert definitions, runbooks, playbooks, dashboards, and health checks.
   - If incident timelines exist (${incidentPath ?? "none"}), summarize what happened recently.
   - Inspect rotation notes (${rotationSheet ?? "none"}) for handoff details.

2. **Synthesize Insights**
   - Cluster alerts by subsystem and flag any noisy or flaky ones from the last ${lookbackWindow} window.
   - Highlight known risky deployments, migrations, or feature flags due soon.
   - Point out missing or outdated documentation with precise file paths.

3. **Produce Outputs**
   - Create a Markdown primer at ${reportFile} with sections: Executive Summary, Key Risks, Alert Heatmap, Ready Checklists, Runbook Gaps, and Suggested Follow-ups.
   - Include a timezone-aware (${timezone}) oncall timeline with recommended check-in times.
   - Draft a Slack-ready kickoff message summarizing the top three risks.

4. **Tooling Discipline**
   - Use \`Glob\` or \`Grep\` to locate configs, monitors, and runbooks.
   - Use \`Read\` to pull context into the report.
   - Use \`Write\` (and \`Edit\` if needed) to publish the primer.
   - Use \`Bash\` for directory prep (e.g., ensure the report folder exists).

5. **Quality Bar**
   - Be concise but decisive; focus on what the responder must review in their first 30 minutes.
   - Prefer checklists, tables, and links over long prose.
   - Always note assumptions, unknowns, and data you could not find.`;
}

function buildPrompt(options: OncallPrimerOptions): string {
  const { servicePath, incidentPath, runbookPath, dashboardsPath, rotationSheet, lookbackWindow, timezone, reportFile } = options;

  return `Assemble the oncall pager primer using the options below:

- Service directory: ${servicePath}
- Incident history: ${incidentPath ?? "(not provided)"}
- Runbooks: ${runbookPath ?? "(not provided)"}
- Dashboards / Metrics notes: ${dashboardsPath ?? "(not provided)"}
- Rotation sheet: ${rotationSheet ?? "(not provided)"}
- Lookback window: ${lookbackWindow}
- Timezone: ${timezone}
- Output file: ${reportFile}

Steps:
1. Inventory the provided directories for incidents, alerts, dashboards, and runbooks.
2. Capture the most recent incidents within the lookback window with timelines and mitigation status.
3. Summarize alert hot spots, dashboard gaps, and automation risks.
4. Document ready-to-run checklists and first-hour actions.
5. Highlight missing information or unclear owners, and propose follow-up tasks.
6. Save the full primer to ${reportFile} and surface a short summary in the terminal.

Be explicit about any assumptions and outline next actions for the oncall engineer.`.trim();
}


const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🛎️  Oncall Pager Primer\n");
console.log(`Service directory: ${options.servicePath}`);
if (options.incidentPath) console.log(`Incident history: ${options.incidentPath}`);
if (options.runbookPath) console.log(`Runbooks: ${options.runbookPath}`);
if (options.dashboardsPath) console.log(`Dashboards: ${options.dashboardsPath}`);
if (options.rotationSheet) console.log(`Rotation sheet: ${options.rotationSheet}`);
console.log(`Lookback window: ${options.lookbackWindow}`);
console.log(`Timezone: ${options.timezone}`);
console.log(`Report file: ${options.reportFile}`);
console.log("");

const prompt = buildPrompt(options);
const systemPrompt = buildSystemPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Glob",
  "Grep",
  "Read",
  "Write",
  "Edit",
  "Bash",
  "TodoWrite",
];

// Collect all additional directories for permissions
const additionalDirs = [
  options.servicePath,
  options.incidentPath,
  options.runbookPath,
  options.dashboardsPath,
  options.rotationSheet,
]
  .filter((p): p is string => Boolean(p))
  .filter((p, i, arr) => arr.indexOf(p) === i); // unique only

removeAgentFlags(["incidents", "runbooks", "dashboards", "rotation", "lookback", "timezone", "report", "help", "h"]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  'append-system-prompt': systemPrompt,
  allowedTools: allowedTools.join(" "),
  "permission-mode": "acceptEdits",
  ...(additionalDirs.length > 0 ? { "add-dir": additionalDirs } : {}),
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Oncall pager primer complete!\n");
    console.log(`📄 Full report: ${options.reportFile}`);
    console.log("\nNext steps:");
    console.log("1. Review the primer for critical risks");
    console.log("2. Check the ready checklists");
    console.log("3. Follow up on any runbook gaps");
    console.log("4. Use the Slack message to announce handoff");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
