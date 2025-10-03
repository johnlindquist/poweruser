#!/usr/bin/env -S bun run

/**
 * Integration Data Seed Curator
 *
 * Generates production-representative integration seed kits by learning from real defect signals.
 * - Audits bug reports, support tickets, and analytics exports to spotlight high-impact workflows
 * - Maps database models, factories, and fixtures tied to those flows
 * - Designs deterministic seed scripts for relational data, queues, and third-party mocks
 * - Detects schema drift and environment mismatches that would sabotage the seed run
 * - Emits documentation and Slack-ready briefings so the whole team knows what's refreshed
 *
 * Usage:
 *   bun run agents/integration-data-seed-curator.ts [options]
 *
 * Options:
 *   --project <path>         Project root to analyze (default: current directory)
 *   --tickets <path>         Directory containing bug reports or support digests
 *   --analytics <path>       Directory containing analytics exports or event logs
 *   --feature-flags <path>   Optional feature flag configuration directory
 *   --environment <name>     Target environment name (default: integration)
 *   --seed-out <path>        Where to write the generated seed toolkit (default: ./seeds/integration-seed-kit.ts)
 *   --report-out <path>      Markdown report output path (default: ./docs/integration-seed-report.md)
 *   --slack-out <path>       Slack summary snippet output path (default: ./docs/integration-seed-slack.md)
 *   --max-age <days>         Only consider incidents/events newer than N days (default: 21)
 *   --no-third-party         Skip generating third-party mock scaffolding
 *   -h, --help               Show usage help
 */

import { resolve } from "node:path";
import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface IntegrationSeedOptions {
  projectPath: string;
  ticketsPath?: string;
  analyticsPath?: string;
  featureFlagPath?: string;
  environmentName: string;
  seedScriptPath: string;
  reportPath: string;
  slackPath?: string;
  maxEventAgeDays: number;
  includeThirdPartyMocks: boolean;
}

const DEFAULT_ENVIRONMENT = "integration";
const DEFAULT_SEED_OUT = "./seeds/integration-seed-kit.ts";
const DEFAULT_REPORT_OUT = "./docs/integration-seed-report.md";
const DEFAULT_SLACK_OUT = "./docs/integration-seed-slack.md";
const DEFAULT_MAX_AGE = 21;

function printHelp(): void {
  console.log(`
🌱 Integration Data Seed Curator

Usage:
  bun run agents/integration-data-seed-curator.ts [options]

Options:
  --project <path>         Project root to analyze (default: current directory)
  --tickets <path>         Directory containing bug reports or support digests
  --analytics <path>       Directory containing analytics exports or event logs
  --feature-flags <path>   Optional feature flag configuration directory
  --environment <name>     Target environment name (default: ${DEFAULT_ENVIRONMENT})
  --seed-out <path>        Seed toolkit output path (default: ${DEFAULT_SEED_OUT})
  --report-out <path>      Markdown report output path (default: ${DEFAULT_REPORT_OUT})
  --slack-out <path>       Slack summary snippet output path (default: ${DEFAULT_SLACK_OUT})
  --max-age <days>         Only consider incidents/events newer than N days (default: ${DEFAULT_MAX_AGE})
  --no-third-party         Skip generating third-party mock scaffolding
  --help, -h               Show this help

Examples:
  bun run agents/integration-data-seed-curator.ts
  bun run agents/integration-data-seed-curator.ts --project ./my-app
  bun run agents/integration-data-seed-curator.ts --tickets ./support --analytics ./data
  bun run agents/integration-data-seed-curator.ts --environment staging --max-age 30
  `);
}

function parseOptions(): IntegrationSeedOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawProject = values.project;
  const rawTickets = values.tickets;
  const rawAnalytics = values.analytics;
  const rawFeatureFlags = values["feature-flags"];
  const rawEnvironment = values.environment;
  const rawSeedOut = values["seed-out"];
  const rawReportOut = values["report-out"];
  const rawSlackOut = values["slack-out"];
  const rawMaxAge = values["max-age"];
  const noThirdParty = values["no-third-party"] === true;

  const projectPath = typeof rawProject === "string" && rawProject.length > 0
    ? resolve(rawProject)
    : process.cwd();

  const ticketsPath = typeof rawTickets === "string" && rawTickets.length > 0
    ? resolve(rawTickets)
    : undefined;

  const analyticsPath = typeof rawAnalytics === "string" && rawAnalytics.length > 0
    ? resolve(rawAnalytics)
    : undefined;

  const featureFlagPath = typeof rawFeatureFlags === "string" && rawFeatureFlags.length > 0
    ? resolve(rawFeatureFlags)
    : undefined;

  const environmentName = typeof rawEnvironment === "string" && rawEnvironment.length > 0
    ? rawEnvironment
    : DEFAULT_ENVIRONMENT;

  const seedScriptPath = typeof rawSeedOut === "string" && rawSeedOut.length > 0
    ? rawSeedOut
    : DEFAULT_SEED_OUT;

  const reportPath = typeof rawReportOut === "string" && rawReportOut.length > 0
    ? rawReportOut
    : DEFAULT_REPORT_OUT;

  const slackPath = typeof rawSlackOut === "string" && rawSlackOut.length > 0
    ? rawSlackOut
    : undefined;

  const maxAge = typeof rawMaxAge === "string" ? Number.parseInt(rawMaxAge, 10) : DEFAULT_MAX_AGE;
  const maxEventAgeDays = Number.isNaN(maxAge) ? DEFAULT_MAX_AGE : maxAge;

  return {
    projectPath,
    ticketsPath,
    analyticsPath,
    featureFlagPath,
    environmentName,
    seedScriptPath,
    reportPath,
    slackPath,
    maxEventAgeDays,
    includeThirdPartyMocks: !noThirdParty,
  };
}

function buildSystemPrompt(options: IntegrationSeedOptions): string {
  const thirdPartyDirective = options.includeThirdPartyMocks
    ? 'Include third-party integrations and queue payload templates in the seed kit.'
    : 'Skip third-party mock scaffolding unless absolutely required by core workflows.';

  return `You are the Integration Data Seed Curator for environment "${options.environmentName}".

Your mission: transform recent defect signals into a deterministic integration data refresh that mirrors production pain points without running any live seed commands.

## Investigation Goals
1. **Incident Mining**
   - Scan issue trackers, support digests, QA notes, and analytics funnels for incidents within the last ${options.maxEventAgeDays} days.
   - Cluster incidents by workflow (e.g., subscription upgrade, checkout, onboarding) and capture frequency + severity.
   - Identify the essential data artifacts each workflow needs (users, orders, feature flags, background jobs, third-party tokens).

2. **Data Surface Mapping**
   - Use Glob and Grep to find ORM models, factories, fixtures, Prisma seeds, SQL migrations, queue producers, and API mocks tied to those workflows.
   - Detect schema drift between migrations and existing seed scripts; note missing columns, enum updates, or relationship changes.
   - Inspect feature flag configuration and environment settings that gate those workflows.

3. **Seed Kit Architecture**
   - Design a modular TypeScript seed toolkit and write it to "${options.seedScriptPath}" using the \`Write\` tool.
   - The toolkit should export a helper named buildIntegrationSeedPlan() that:
     * Outlines ordered phases (reset, core data, edge cases, queues, ${options.includeThirdPartyMocks ? 'third-party mocks, ' : ''}post-checks).
     * Provides idempotent operations (truncate/insert, upserts, queue enqueue stubs).
     * Documents required environment variables and safety guards.
   - Provide inline TODO markers when manual decisions are required.

4. **Environment Parity Audit**
   - Produce a markdown report at "${options.reportPath}" summarizing:
     * Top workflows covered and why they matter.
     * Schema or configuration mismatches that require human follow-up.
     * Test coverage gaps and proposed regression scenarios.
     * Rollback or cleanup guidance after running the seeds.
   - Recommend validation commands (SQL queries, API smoke tests) to confirm seeds landed correctly.

5. **Stakeholder Broadcast**
   - Draft a Slack-ready update${options.slackPath ? ` at "${options.slackPath}"` : ''} written in 4-6 bullet points:
     * What changed
     * What QA/product should verify
     * When to rerun the seed kit
     * How to escalate issues

## Tooling Expectations
- Prefer \`Glob\` to scope relevant files (\`**/*.{ts,tsx,sql,prisma,rb,py}\`).
- Use \`Read\` for deep file inspection and \`Grep\` for pattern discovery.
- Use \`Bash\` only for safe listing commands (migrations, seeds) — never execute destructive DB commands.
- Use \`TodoWrite\` when open follow-ups remain.
- ${thirdPartyDirective}
- Never run the generated seed kit; only produce artifacts and guidance.

## Delivery Format
- Stream findings conversationally for the operator.
- Ensure generated files are well-commented, type-safe, and align with existing project conventions when detectable.
- Close with a concise checklist of recommended next actions for the human operator.`;
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🌱 Integration Data Seed Curator\n");
console.log(`Project root: ${options.projectPath}`);
console.log(`Target environment: ${options.environmentName}`);
console.log(`Seed toolkit output: ${options.seedScriptPath}`);
console.log(`Report output: ${options.reportPath}`);
if (options.slackPath) {
  console.log(`Slack summary output: ${options.slackPath}`);
}
console.log(`Incident lookback window: ${options.maxEventAgeDays} days`);
console.log(`Include third-party mocks: ${options.includeThirdPartyMocks ? "yes" : "no"}`);
console.log("");

const ticketInfo = options.ticketsPath
  ? `Bug/support archives: ${options.ticketsPath}`
  : 'Bug/support archives: not provided (synthesize based on available repo context).';
const analyticsInfo = options.analyticsPath
  ? `Analytics exports: ${options.analyticsPath}`
  : 'Analytics exports: not provided (infer from code instrumentation).';
const flagInfo = options.featureFlagPath
  ? `Feature flag config: ${options.featureFlagPath}`
  : 'Feature flag config: discover in repo if present (look for config, YAML, or JSON files).';

const prompt = `Project root: ${options.projectPath}
${ticketInfo}
${analyticsInfo}
${flagInfo}`;

const systemPrompt = buildSystemPrompt(options);
const settings: Settings = {};

const additionalDirectories = [
  options.ticketsPath,
  options.analyticsPath,
  options.featureFlagPath,
].filter((value): value is string => Boolean(value));

const allowedTools = [
  "Read",
  "Write",
  "Grep",
  "Glob",
  "Bash",
  "TodoWrite",
  "Task",
];

// Define agents for the Task tool
const agentsConfig = {
  agents: {
    "incident-analyst": {
      description: "Synthesizes defect signals from support tickets, QA notes, and analytics funnels.",
      tools: ["Read", "Grep", "Glob"],
      prompt: "Study support transcripts, issue templates, and analytics exports to identify the workflows that recently failed and capture concrete reproduction data.",
      model: "haiku",
    },
    "fixture-cartographer": {
      description: "Maps ORM models, fixtures, and migrations for workflows the analyst surfaces.",
      tools: ["Read", "Grep", "Glob", "Bash"],
      prompt: "Discover the database schemas, factories, and background job producers that power the targeted workflows. Highlight schema drift or missing relationships.",
      model: "sonnet",
    },
    "seed-architect": {
      description: "Designs the TypeScript seed toolkit and supporting docs.",
      tools: ["Read", "Write", "TodoWrite"],
      prompt: "Translate the mapped workflows into a deterministic seed plan. Focus on idempotence, environment safety, and rich inline documentation.",
      model: "sonnet",
    },
  },
};

removeAgentFlags([
    "project",
    "tickets",
    "analytics",
    "feature-flags",
    "environment",
    "seed-out",
    "report-out",
    "slack-out",
    "max-age",
    "no-third-party",
    "help",
    "h"
  ]);

// Change to project directory
const originalCwd = process.cwd();
if (options.projectPath !== originalCwd) {
  process.chdir(options.projectPath);
}

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify({ ...settings, ...agentsConfig }),
  allowedTools: allowedTools.join(" "),
  "append-system-prompt": systemPrompt,
  "permission-mode": "default",
  ...(additionalDirectories.length > 0 ? { "add-dir": additionalDirectories } : {}),
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Integration data seed curation complete!\n");
    console.log(`📄 Seed toolkit: ${options.seedScriptPath}`);
    console.log(`📄 Report: ${options.reportPath}`);
    if (options.slackPath) {
      console.log(`📄 Slack summary: ${options.slackPath}`);
    }
    console.log("\nNext steps:");
    console.log("1. Review the generated seed toolkit");
    console.log("2. Check the audit report for schema mismatches");
    console.log("3. Validate environment configuration");
    console.log("4. Test the seed kit in a safe environment");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
} finally {
  // Restore original cwd
  if (options.projectPath !== originalCwd) {
    process.chdir(originalCwd);
  }
}
