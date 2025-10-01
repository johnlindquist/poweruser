#!/usr/bin/env bun

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

import { query } from '@anthropic-ai/claude-agent-sdk';
import { parseArgs } from 'util';

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
  showHelp: boolean;
  unknownArgs: string[];
}

function printUsage() {
  console.log(`\nSchema Drift Radar\n===================\n\n`);
  console.log(`Usage: bun run agents/schema-drift-radar.ts [options]\n`);
  console.log(`Options:`);
  console.log(`  --project <path>            Path to the service or monorepo (default: cwd)`);
  console.log(`  --schema-dump env=path      Register a schema dump for an environment (repeatable)`);
  console.log(`  --orm <name>                Hint ORM/framework in use (repeatable)`);
  console.log(`  --output <file>             Markdown file to write the drift report (default: schema-drift-report.md)`);
  console.log(`  --generate-migrations       Ask the agent to draft SQL/ORM migration snippets`);
  console.log(`  --no-dry-run                Allow the agent to stage file edits (still never run migrations)`);
  console.log(`  --severity <low|medium|high>Focus attention on issues at or above this severity (default: medium)`);
  console.log(`  --ticket <id>               Link ticket/ADR identifiers for additional context (repeatable)`);
  console.log(`  --help                      Show this help text\n`);
}

function parseArgsCustom(args: string[]): SchemaDriftRadarOptions {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      project: { type: 'string' },
      'schema-dump': { type: 'string', multiple: true },
      orm: { type: 'string', multiple: true },
      output: { type: 'string' },
      'generate-migrations': { type: 'boolean' },
      'no-dry-run': { type: 'boolean' },
      severity: { type: 'string' },
      ticket: { type: 'string', multiple: true },
    },
    strict: false,
  });

  const options: SchemaDriftRadarOptions = {
    projectPath: (values.project as string | undefined) ?? process.cwd(),
    schemaSources: [],
    orms: (values.orm as string[] | undefined) ?? [],
    outputFile: (values.output as string | undefined) ?? 'schema-drift-report.md',
    generateMigrations: (values['generate-migrations'] as boolean | undefined) ?? false,
    dryRun: !((values['no-dry-run'] as boolean | undefined) ?? false),
    severity: 'medium',
    ticketHints: (values.ticket as string[] | undefined) ?? [],
    showHelp: (values.help as boolean | undefined) ?? false,
    unknownArgs: [],
  };

  // Parse schema-dump values which have env=path format
  const schemaDumps = values['schema-dump'];
  if (schemaDumps) {
    const dumps = Array.isArray(schemaDumps) ? schemaDumps : [schemaDumps];
    for (const dump of dumps) {
      if (typeof dump !== 'string') continue;
      const equalsIndex = dump.indexOf('=');
      if (equalsIndex === -1) {
        options.unknownArgs.push(`--schema-dump ${dump}`);
        continue;
      }
      const env = dump.slice(0, equalsIndex).trim();
      const path = dump.slice(equalsIndex + 1).trim();
      if (!env || !path) {
        options.unknownArgs.push(`--schema-dump ${dump}`);
        continue;
      }
      options.schemaSources.push({ env, path });
    }
  }

  // Validate severity
  const severityValue = values.severity as string | undefined;
  if (severityValue) {
    if (severityValue === 'low' || severityValue === 'medium' || severityValue === 'high') {
      options.severity = severityValue;
    } else {
      options.unknownArgs.push(`--severity ${severityValue}`);
    }
  }

  // Collect any unknown positional arguments
  options.unknownArgs.push(...positionals);

  return options;
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgsCustom(args);

  if (options.showHelp) {
    printUsage();
    return;
  }

  if (options.unknownArgs.length > 0) {
    console.warn('[warn]  Ignored unknown arguments:', options.unknownArgs.join(', '));
  }

  const schemaSourceDescription =
    options.schemaSources.length > 0
      ? options.schemaSources
          .map((source) => `    - ${source.env}: ${source.path}`)
          .join('\n')
      : '    - auto-detect dumps via Glob (*/schema.sql, dump/*.sql, prisma/migrations/*, etc.)';

  const ormDescription = options.orms.length > 0 ? options.orms.join(', ') : 'auto-detect (Prisma, TypeORM, Sequelize, ActiveRecord, Knex, etc.)';
  const ticketDescription = options.ticketHints.length > 0 ? options.ticketHints.join(', ') : 'none provided';
  const patchFileSuggestion = options.generateMigrations
    ? `${options.outputFile.replace(/\.md$/i, '') || 'schema-drift-report'}-patch.sql`
    : undefined;

  console.log('[Schema Drift Radar]  Schema Drift Radar\n');
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

  const missionBrief = `You are Schema Drift Radar, a database observability agent.

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
- Schema sources:\n${schemaSourceDescription}
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

Please begin the drift reconnaissance now and keep output concise but actionable.`;

  const stream = query({
    prompt: missionBrief,
    options: {
      cwd: options.projectPath,
      allowedTools: ['Bash', 'Read', 'Write', 'Grep', 'Glob', 'TodoWrite'],
      permissionMode: options.dryRun ? 'default' : 'acceptEdits',
      maxThinkingTokens: 6000,
      maxTurns: 24,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  for await (const message of stream) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          console.log(block.text);
        }
      }
    }

    if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('\n[done] Drift analysis session complete.');
        console.log(`Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`Total cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`Turns: ${message.num_turns}`);
      } else {
        console.error('\n[error] Schema Drift Radar did not finish successfully.');
        console.error(`Subtype: ${message.subtype}`);
        process.exitCode = 1;
      }
    }
  }
}

main().catch((error) => {
  console.error('Fatal error running Schema Drift Radar:', error);
  process.exit(1);
});
