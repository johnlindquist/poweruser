#!/usr/bin/env bun

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

import { query } from '@anthropic-ai/claude-agent-sdk';

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
  unknownArgs: string[];
}

function showHelp(): void {
  console.log(`Integration Data Seed Curator\n\n` +
    `Usage:\n` +
    `  bun run agents/integration-data-seed-curator.ts [options]\n\n` +
    `Options:\n` +
    `  --project <path>         Project root to analyze (default: current directory)\n` +
    `  --tickets <path>         Directory containing bug reports or support digests\n` +
    `  --analytics <path>       Directory containing analytics exports or event logs\n` +
    `  --feature-flags <path>   Optional feature flag configuration directory\n` +
    `  --environment <name>     Target environment name (default: integration)\n` +
    `  --seed-out <path>        Seed toolkit output path (default: ./seeds/integration-seed-kit.ts)\n` +
    `  --report-out <path>      Markdown report output path (default: ./docs/integration-seed-report.md)\n` +
    `  --slack-out <path>       Slack summary snippet output path (default: ./docs/integration-seed-slack.md)\n` +
    `  --max-age <days>         Only consider incidents/events newer than N days (default: 21)\n` +
    `  --no-third-party         Skip generating third-party mock scaffolding\n` +
    `  -h, --help               Show this message\n`);
}

function parseArgs(argv: string[]): IntegrationSeedOptions | null {
  const options: IntegrationSeedOptions = {
    projectPath: process.cwd(),
    environmentName: 'integration',
    seedScriptPath: './seeds/integration-seed-kit.ts',
    reportPath: './docs/integration-seed-report.md',
    slackPath: './docs/integration-seed-slack.md',
    maxEventAgeDays: 21,
    includeThirdPartyMocks: true,
    unknownArgs: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (typeof current !== 'string') {
      continue;
    }
    const arg = current;

    if (arg === '--help' || arg === '-h') {
      showHelp();
      return null;
    }

    if (arg === '--project') {
      options.projectPath = argv[++i] ?? options.projectPath;
      continue;
    }
    if (arg.startsWith('--project=')) {
      options.projectPath = arg.split('=')[1] ?? options.projectPath;
      continue;
    }

    if (arg === '--tickets') {
      options.ticketsPath = argv[++i];
      continue;
    }
    if (arg.startsWith('--tickets=')) {
      options.ticketsPath = arg.split('=')[1];
      continue;
    }

    if (arg === '--analytics') {
      options.analyticsPath = argv[++i];
      continue;
    }
    if (arg.startsWith('--analytics=')) {
      options.analyticsPath = arg.split('=')[1];
      continue;
    }

    if (arg === '--feature-flags') {
      options.featureFlagPath = argv[++i];
      continue;
    }
    if (arg.startsWith('--feature-flags=')) {
      options.featureFlagPath = arg.split('=')[1];
      continue;
    }

    if (arg === '--environment') {
      options.environmentName = argv[++i] ?? options.environmentName;
      continue;
    }
    if (arg.startsWith('--environment=')) {
      options.environmentName = arg.split('=')[1] ?? options.environmentName;
      continue;
    }

    if (arg === '--seed-out') {
      options.seedScriptPath = argv[++i] ?? options.seedScriptPath;
      continue;
    }
    if (arg.startsWith('--seed-out=')) {
      options.seedScriptPath = arg.split('=')[1] ?? options.seedScriptPath;
      continue;
    }

    if (arg === '--report-out') {
      options.reportPath = argv[++i] ?? options.reportPath;
      continue;
    }
    if (arg.startsWith('--report-out=')) {
      options.reportPath = arg.split('=')[1] ?? options.reportPath;
      continue;
    }

    if (arg === '--slack-out') {
      options.slackPath = argv[++i] ?? options.slackPath;
      continue;
    }
    if (arg.startsWith('--slack-out=')) {
      options.slackPath = arg.split('=')[1] ?? options.slackPath;
      continue;
    }

    if (arg === '--max-age') {
      const value = parseInt(argv[++i] ?? '', 10);
      if (!Number.isNaN(value)) {
        options.maxEventAgeDays = value;
      }
      continue;
    }
    if (arg.startsWith('--max-age=')) {
      const value = parseInt(arg.split('=')[1] ?? '', 10);
      if (!Number.isNaN(value)) {
        options.maxEventAgeDays = value;
      }
      continue;
    }

    if (arg === '--no-third-party') {
      options.includeThirdPartyMocks = false;
      continue;
    }

    options.unknownArgs.push(arg);
  }

  return options;
}

function buildPrompt(options: IntegrationSeedOptions): string {
  const {
    projectPath,
    ticketsPath,
    analyticsPath,
    featureFlagPath,
    environmentName,
    seedScriptPath,
    reportPath,
    slackPath,
    maxEventAgeDays,
    includeThirdPartyMocks,
  } = options;

  const ticketInfo = ticketsPath ? `Bug/support archives: ${ticketsPath}` : 'Bug/support archives: not provided (synthesize based on available repo context).';
  const analyticsInfo = analyticsPath ? `Analytics exports: ${analyticsPath}` : 'Analytics exports: not provided (infer from code instrumentation).';
  const flagInfo = featureFlagPath ? `Feature flag config: ${featureFlagPath}` : 'Feature flag config: discover in repo if present (look for config, YAML, or JSON files).';
  const thirdPartyDirective = includeThirdPartyMocks
    ? 'Include third-party integrations and queue payload templates in the seed kit.'
    : 'Skip third-party mock scaffolding unless absolutely required by core workflows.';

  return `You are the Integration Data Seed Curator for environment "${environmentName}".
Project root: ${projectPath}
${ticketInfo}
${analyticsInfo}
${flagInfo}

Your mission: transform recent defect signals into a deterministic integration data refresh that mirrors production pain points without running any live seed commands.

## Investigation Goals
1. **Incident Mining**
   - Scan issue trackers, support digests, QA notes, and analytics funnels for incidents within the last ${maxEventAgeDays} days.
   - Cluster incidents by workflow (e.g., subscription upgrade, checkout, onboarding) and capture frequency + severity.
   - Identify the essential data artifacts each workflow needs (users, orders, feature flags, background jobs, third-party tokens).

2. **Data Surface Mapping**
   - Use Glob and Grep to find ORM models, factories, fixtures, Prisma seeds, SQL migrations, queue producers, and API mocks tied to those workflows.
   - Detect schema drift between migrations and existing seed scripts; note missing columns, enum updates, or relationship changes.
   - Inspect feature flag configuration and environment settings that gate those workflows.

3. **Seed Kit Architecture**
   - Design a modular TypeScript seed toolkit and write it to "${seedScriptPath}" using the \`Write\` tool.
   - The toolkit should export a helper named buildIntegrationSeedPlan() that:
     * Outlines ordered phases (reset, core data, edge cases, queues, ${includeThirdPartyMocks ? 'third-party mocks, ' : ''}post-checks).
     * Provides idempotent operations (truncate/insert, upserts, queue enqueue stubs).
     * Documents required environment variables and safety guards.
   - Provide inline TODO markers when manual decisions are required.

4. **Environment Parity Audit**
   - Produce a markdown report at "${reportPath}" summarizing:
     * Top workflows covered and why they matter.
     * Schema or configuration mismatches that require human follow-up.
     * Test coverage gaps and proposed regression scenarios.
     * Rollback or cleanup guidance after running the seeds.
   - Recommend validation commands (SQL queries, API smoke tests) to confirm seeds landed correctly.

5. **Stakeholder Broadcast**
   - Draft a Slack-ready update${slackPath ? ` at "${slackPath}"` : ''} written in 4-6 bullet points:
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
- Close with a concise checklist of recommended next actions for the human operator.
`;
}

async function runIntegrationDataSeedCurator(options: IntegrationSeedOptions): Promise<void> {
  const prompt = buildPrompt(options);
  const additionalDirectories = [
    options.ticketsPath,
    options.analyticsPath,
    options.featureFlagPath,
  ].filter((value): value is string => Boolean(value));

  console.log('🌱 Integration Data Seed Curator\n');
  console.log(`Project root: ${options.projectPath}`);
  console.log(`Target environment: ${options.environmentName}`);
  console.log(`Seed toolkit output: ${options.seedScriptPath}`);
  console.log(`Report output: ${options.reportPath}`);
  if (options.slackPath) {
    console.log(`Slack summary output: ${options.slackPath}`);
  }
  console.log(`Incident lookback window: ${options.maxEventAgeDays} days`);
  console.log(`Include third-party mocks: ${options.includeThirdPartyMocks ? 'yes' : 'no'}`);
  if (additionalDirectories.length > 0) {
    console.log(`Additional directories: ${additionalDirectories.join(', ')}`);
  }
  if (options.unknownArgs.length > 0) {
    console.warn(`\n⚠️  Ignored unknown arguments: ${options.unknownArgs.join(', ')}`);
  }
  console.log();

  const stream = query({
    prompt,
    options: {
      cwd: options.projectPath,
      additionalDirectories,
      allowedTools: ['Read', 'Write', 'Grep', 'Glob', 'Bash', 'TodoWrite', 'Task'],
      maxTurns: 40,
      agents: {
        'incident-analyst': {
          description: 'Synthesizes defect signals from support tickets, QA notes, and analytics funnels.',
          tools: ['Read', 'Grep', 'Glob'],
          prompt: 'Study support transcripts, issue templates, and analytics exports to identify the workflows that recently failed and capture concrete reproduction data.',
          model: 'haiku',
        },
        'fixture-cartographer': {
          description: 'Maps ORM models, fixtures, and migrations for workflows the analyst surfaces.',
          tools: ['Read', 'Grep', 'Glob', 'Bash'],
          prompt: 'Discover the database schemas, factories, and background job producers that power the targeted workflows. Highlight schema drift or missing relationships.',
          model: 'sonnet',
        },
        'seed-architect': {
          description: 'Designs the TypeScript seed toolkit and supporting docs.',
          tools: ['Read', 'Write', 'TodoWrite'],
          prompt: 'Translate the mapped workflows into a deterministic seed plan. Focus on idempotence, environment safety, and rich inline documentation.',
          model: 'sonnet',
        },
      },
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
        console.log('\n✅ Integration data seed curation complete!');
        console.log(`Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`Turns: ${message.num_turns}`);
        console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
      } else {
        console.error('\n❌ The agent did not finish successfully.');
        process.exitCode = 1;
      }
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);
  if (!parsed) {
    return;
  }

  await runIntegrationDataSeedCurator(parsed);
}

main().catch((error) => {
  console.error('Fatal error while running Integration Data Seed Curator:', error);
  process.exit(1);
});
