#!/usr/bin/env -S bun run

/**
 * Schema Drift Radar Agent
 *
 * A practical everyday agent that keeps your database schemas, migrations, and code in harmony:
 * - Crawls migration folders, ORM models, and production schema dumps to build a unified catalog
 * - Highlights drift between local, staging, and production environments with severity scoring
 * - Flags unused tables, columns, and indices plus pending deprecations mentioned in tickets or ADRs
 * - Generates SQL patches or migration stubs to realign mismatched fields, types, and constraints
 * - Verifies API/GraphQL types to ensure they mirror the latest database changes and enums
 * - Produces a Slack-ready digest with timeline of schema events, owners, and suggested next steps
 * - Perfect for multi-service teams that can't afford schema surprises breaking deployments
 *
 * Usage:
 *   bun run agents/schema-drift-radar.ts [options]
 *
 * Options:
 *   --project <path>            Path to the service or monorepo (default: cwd)
 *   --schema-dump env=path      Register a schema dump for an environment (repeatable)
 *   --orm <name>                Hint ORM/framework in use (repeatable)
 *   --output <file>             Markdown file to write the drift report (default: schema-drift-report.md)
 *   --generate-migrations       Ask the agent to draft SQL/ORM migration snippets
 *   --no-dry-run                Allow the agent to stage file edits (still never run migrations)
 *   --severity <low|medium|high>Focus attention on issues at or above this severity (default: medium)
 *   --ticket <id>               Link ticket/ADR identifiers for additional context (repeatable)
 *   --help                      Show this help text
 */

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type SeverityLevel = 'low' | 'medium' | 'high';

interface SchemaSource {
  env: string;
  path: string;
}

interface SchemaDriftRadarOptions {
  projectPath: string;
  schemaSources: SchemaSource[];
  orms: string[];
  outputFile: string;
  generateMigrations: boolean;
  dryRun: boolean;
  severity: SeverityLevel;
  ticketHints: string[];
}

const DEFAULT_OUTPUT_FILE = "schema-drift-report.md";
const DEFAULT_SEVERITY: SeverityLevel = "medium";

function printHelp(): void {
  console.log(`
🔍 Schema Drift Radar

Usage:
  bun run agents/schema-drift-radar.ts [options]

Options:
  --project <path>            Path to the service or monorepo (default: cwd)
  --schema-dump env=path      Register a schema dump for an environment (repeatable)
  --orm <name>                Hint ORM/framework in use (repeatable)
  --output <file>             Markdown file to write the drift report (default: ${DEFAULT_OUTPUT_FILE})
  --generate-migrations       Ask the agent to draft SQL/ORM migration snippets
  --no-dry-run                Allow the agent to stage file edits (still never run migrations)
  --severity <low|medium|high>Focus attention on issues at or above this severity (default: ${DEFAULT_SEVERITY})
  --ticket <id>               Link ticket/ADR identifiers for additional context (repeatable)
  --help, -h                  Show this help text

Examples:
  bun run agents/schema-drift-radar.ts
  bun run agents/schema-drift-radar.ts --project ./services/api
  bun run agents/schema-drift-radar.ts --schema-dump prod=./prod-schema.sql --schema-dump staging=./staging-schema.sql
  bun run agents/schema-drift-radar.ts --orm prisma --orm typeorm --severity high
  bun run agents/schema-drift-radar.ts --generate-migrations --no-dry-run --output drift-report.md
  `);
}

function parseOptions(): SchemaDriftRadarOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawProject = values.project;
  const rawSchemaDumps = values['schema-dump'];
  const rawOrms = values.orm;
  const rawOutput = values.output;
  const rawSeverity = values.severity;
  const rawTickets = values.ticket;
  const generateMigrations = values['generate-migrations'] === true;
  const dryRun = !(values['no-dry-run'] === true);

  const projectPath = typeof rawProject === "string" && rawProject.length > 0
    ? resolve(rawProject)
    : process.cwd();

  const outputFile = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : DEFAULT_OUTPUT_FILE;

  // Parse schema-dump values which have env=path format
  const schemaSources: SchemaSource[] = [];
  const unknownArgs: string[] = [];

  if (rawSchemaDumps) {
    const dumps = Array.isArray(rawSchemaDumps) ? rawSchemaDumps : [rawSchemaDumps];
    for (const dump of dumps) {
      if (typeof dump !== 'string') continue;
      const equalsIndex = dump.indexOf('=');
      if (equalsIndex === -1) {
        unknownArgs.push(`--schema-dump ${dump}`);
        continue;
      }
      const env = dump.slice(0, equalsIndex).trim();
      const path = dump.slice(equalsIndex + 1).trim();
      if (!env || !path) {
        unknownArgs.push(`--schema-dump ${dump}`);
        continue;
      }
      schemaSources.push({ env, path });
    }
  }

  // Parse ORMs
  const orms: string[] = rawOrms
    ? (Array.isArray(rawOrms) ? rawOrms : [rawOrms]).filter((v): v is string => typeof v === "string")
    : [];

  // Parse tickets
  const ticketHints: string[] = rawTickets
    ? (Array.isArray(rawTickets) ? rawTickets : [rawTickets]).filter((v): v is string => typeof v === "string")
    : [];

  // Validate severity
  let severity: SeverityLevel = DEFAULT_SEVERITY;
  if (typeof rawSeverity === "string" && rawSeverity.length > 0) {
    if (rawSeverity === 'low' || rawSeverity === 'medium' || rawSeverity === 'high') {
      severity = rawSeverity;
    } else {
      console.error(`❌ Error: Invalid severity level. Must be low, medium, or high`);
      process.exit(1);
    }
  }

  if (unknownArgs.length > 0) {
    console.warn('[warn]  Ignored malformed arguments:', unknownArgs.join(', '));
  }

  return {
    projectPath,
    schemaSources,
    orms,
    outputFile,
    generateMigrations,
    dryRun,
    severity,
    ticketHints,
  };
}

function buildPrompt(options: SchemaDriftRadarOptions): string {
  const schemaSourceDescription =
    options.schemaSources.length > 0
      ? options.schemaSources
          .map((source: SchemaSource) => `    - ${source.env}: ${source.path}`)
          .join('\n')
      : '    - auto-detect dumps via Glob (*/schema.sql, dump/*.sql, prisma/migrations/*, etc.)';

  const ormDescription = options.orms.length > 0 ? options.orms.join(', ') : 'auto-detect (Prisma, TypeORM, Sequelize, ActiveRecord, Knex, etc.)';
  const ticketDescription = options.ticketHints.length > 0 ? options.ticketHints.join(', ') : 'none provided';
  const patchFileSuggestion = options.generateMigrations
    ? `${options.outputFile.replace(/\.md$/i, '') || 'schema-drift-report'}-patch.sql`
    : undefined;

  return `You are Schema Drift Radar, a database observability agent.

MANDATE
-------
Keep database schemas, migrations, and application type definitions in sync across environments without running destructive commands.

OPERATING MODES
---------------
- Project path: ${options.projectPath}
- Primary ORM hints: ${ormDescription}
- Severity focus: ${options.severity}
- Ticket anchors: ${ticketDescription}
- Dry run: ${options.dryRun ? 'YES - never execute migration commands, only analyze and propose fixes.' : 'NO - you may stage file edits via Write/Edit, but never execute shell commands that mutate data.'}
- Schema sources:
${schemaSourceDescription}
- Report file: ${options.outputFile}
${patchFileSuggestion ? `- Patch file target: ${patchFileSuggestion}` : ''}

INVESTIGATION PLAN
------------------
1. Inventory schema references:
   - Use Glob/Grep to locate migration folders, schema.prisma, models, SQL dumps, and GraphQL schema definitions.
   - Parse environment-specific dumps listed above. If missing, prompt the user for manual upload or note in report.
   - Identify naming conventions for migrations to understand chronology.

2. Build the unified schema timeline:
   - Derive the latest structural definition per environment (tables, columns, indexes, constraints, enums, triggers).
   - Compare ORM/GraphQL definitions against actual SQL structures.
   - Flag pending deprecations mentioned in commit messages, ADRs, or tickets (${ticketDescription}).

3. Detect drift and categorize severity (${options.severity} threshold):
   - Missing or extra columns, type mismatches, constraint differences, default discrepancies.
   - Divergent indexes (missing, extra, or misaligned) and sequence settings.
   - Orphaned tables or enums unused in code.
   - Drift in generated artifacts (Prisma client, TypeScript types, API/GQL schemas).

4. Summarize impact:
   - For each finding, include environment scope, impacted services/files, business risk, and remediation difficulty.
   - Provide timeline context (when drift likely introduced) using migration history.
   - Recommend owners based on git blame or module ownership cues.

5. Output deliverables:
   - Write a rich markdown report to ${options.outputFile} with sections:
     * Executive summary
     * Environment matrix (local vs staging vs production)
     * Detailed findings grouped by severity
     * Suggested remediation plan with prioritized checklist
     * Appendix of raw diffs and metadata
   - Include Slack-ready digest (bullet list) inside the report.
   - ${options.generateMigrations ? `Draft migration snippets (SQL or ORM) and, if appropriate, write them to ${patchFileSuggestion}.` : 'Provide migration snippets inline in the report, but do not create files.'}
   - Create TODOs via TodoWrite when immediate follow-ups are obvious.

SAFETY RULES
------------
- Never run migrations, apply DDL, or drop data.
- If evidence is inconclusive, ask for clarification or mark as "needs input".
- Respect dry-run mode (${options.dryRun ? 'no file edits unless writing the report' : 'writes allowed but still no destructive shell commands'}).
- Document assumptions and data gaps explicitly.

TOOLS & EXECUTION GUIDANCE
---------------------------
- Grep/Glob for locating schema artifacts (migrations, schema.prisma, *.graphql, docs).
- Read to inspect files, SQL dumps, and config.
- Bash for safe metadata commands only (e.g., \`ls\`, \`head\`, \`diff\`); never run psql/mysql updates.
- Write to produce the report and optional patch file.
- TodoWrite to surface immediate follow-up tasks, referencing ticket IDs when supplied.

Please begin the drift reconnaissance now and keep output concise but actionable.`.trim();
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = [
    "project",
    "schema-dump",
    "orm",
    "output",
    "generate-migrations",
    "no-dry-run",
    "severity",
    "ticket",
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

const schemaSourceDescription =
  options.schemaSources.length > 0
    ? options.schemaSources
        .map((source: SchemaSource) => `    - ${source.env}: ${source.path}`)
        .join('\n')
    : '    - auto-detect dumps via Glob';

const ormDescription = options.orms.length > 0 ? options.orms.join(', ') : 'auto-detect';
const ticketDescription = options.ticketHints.length > 0 ? options.ticketHints.join(', ') : 'none';
const patchFileSuggestion = options.generateMigrations
  ? `${options.outputFile.replace(/\.md$/i, '') || 'schema-drift-report'}-patch.sql`
  : undefined;

console.log('🔍 Schema Drift Radar\n');
console.log('Configuration:');
console.log(`  - Project path: ${options.projectPath}`);
console.log(`  - Output report: ${options.outputFile}`);
console.log(`  - Dry run mode: ${options.dryRun ? 'ON (analysis only)' : 'OFF (writes allowed)'}`);
console.log(`  - Generate migrations: ${options.generateMigrations ? 'YES' : 'NO'}`);
console.log(`  - Severity focus: ${options.severity}`);
console.log(`  - ORM hints: ${ormDescription}`);
console.log(`  - Ticket references: ${ticketDescription}`);
console.log('  - Schema sources:');
console.log(schemaSourceDescription);
if (patchFileSuggestion) {
  console.log(`  - Suggested patch file: ${patchFileSuggestion}`);
}
console.log();

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Bash",
  "Read",
  "Write",
  "Grep",
  "Glob",
  "TodoWrite",
  ...(options.dryRun ? [] : ["Edit"]),
];

// Change working directory if needed
const originalCwd = process.cwd();
if (options.projectPath !== originalCwd) {
  process.chdir(options.projectPath);
}

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": options.dryRun ? "default" : "acceptEdits",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Schema drift analysis complete!\n");
    console.log(`📄 Full report: ${options.outputFile}`);
    if (options.generateMigrations) {
      console.log("📝 Migration snippets included in report");
      if (patchFileSuggestion) {
        console.log(`   Patch file: ${patchFileSuggestion}`);
      }
    }
    console.log("\nNext steps:");
    console.log("1. Review the drift report");
    console.log("2. Prioritize critical drift issues");
    console.log("3. Apply recommended fixes or migrations");
    console.log("4. Re-run analysis to verify");
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
