#!/usr/bin/env bun

/**
 * Backlog Ready-Check Curator Agent
 *
 * A practical everyday agent that keeps backlog tickets actionable and team-ready.
 * Verifies grooming quality, highlights risks, and drafts improvement guidance.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const args = process.argv.slice(2);
const positional = args.filter((arg) => !arg.startsWith('--'));
const projectRoot = positional[0] ?? process.cwd();

const outputFlagIndex = args.indexOf('--output');
const outputFile =
  outputFlagIndex !== -1 && args[outputFlagIndex + 1]
    ? args[outputFlagIndex + 1]
    : 'backlog-ready-check-report.md';

const limitArg = args.find((arg) => arg.startsWith('--limit='));
const backlogLimit = limitArg ? parseInt(limitArg.split('=')[1] || '25', 10) : 25;

const strictMode = args.includes('--strict');
const dryRun = args.includes('--dry-run');

const systemPrompt = `You are the Backlog Ready-Check Curator — an agent obsessed with backlog clarity and execution momentum.

Core responsibilities:
1. Aggregate work items from issue trackers, roadmap docs, sprint boards, and planning folders within the project workspace.
2. Score the grooming readiness of each ticket using a rubric that checks for:
   - Clear problem statement and business context
   - Acceptance criteria with measurable outcomes
   - Defined success metrics or validation plan
   - Dependency callouts (tech, people, timing)
   - UX/product assets, rollout notes, or data contracts when appropriate
3. Flag gaps with severity (critical blocker, warning, heads-up) and suggest targeted next actions.
4. Draft copy-ready updates or checklists tailored to the team's existing templates.
5. Produce an executive summary that lets leads focus on the riskiest tickets first.

Guardrails:
- Stay within the project workspace at ${projectRoot}.
- Prefer non-destructive analysis; only write reports or drafts when instructed.
- In strict mode, you may stage 'Write' edits for suggested improvements.
- In dry-run mode, never invoke 'Write'; provide guidance only.
- Use 'Glob', 'Grep', 'Read', and 'Write' efficiently. Pull in 'TodoWrite' for structured follow-ups if it clarifies ownership.
- Keep output concise but actionable; avoid generic advice.`;

const userPrompt = `Project path: ${projectRoot}
Output report: ${outputFile}
Ticket analysis limit: ${backlogLimit} items
Strict mode: ${strictMode ? 'enabled' : 'disabled'}
Dry run: ${dryRun ? 'yes' : 'no'}

Workflow expectations:
1. Locate relevant backlog sources (issue tracker exports, docs, JSON/YAML configs, Sprint *.md files).
2. Sample up to ${backlogLimit} actionable tickets, prioritizing upcoming sprint or high-priority work if discoverable.
3. For each ticket, rate readiness (Green/Amber/Red) and enumerate missing pieces with inline references (file path:line).
4. Provide tailored remediation guidance — rewrite prompts, add acceptance criteria blocks, identify stakeholders to consult.
5. Generate \`${outputFile}\` summarizing findings:
   - Overview metrics (ready %, ambers, reds, key blockers)
   - Table or structured list of tickets with status, gaps, owners if found
   - Draft snippets or checklists ready to paste back into the tracker
6. Close with next-step checklist (e.g., "Ping UX for mocks", "Add data contract for event ingestion").

Remember: Honor dry-run vs strict mode behavior, keep logging informative, and exit gracefully if nothing actionable is found.`;

async function main() {
  console.log('🗂️  Backlog Ready-Check Curator');
  console.log(`📁 Workspace: ${projectRoot}`);
  console.log(`📝 Report file: ${outputFile}`);
  console.log(`🔍 Ticket limit: ${backlogLimit}`);
  console.log(`🚦 Strict mode: ${strictMode ? 'ON' : 'OFF'}`);
  console.log(`🛡️  Dry run: ${dryRun ? 'YES' : 'NO'}`);
  console.log();

  const stream = query({
    prompt: userPrompt,
    options: {
      systemPrompt,
      cwd: projectRoot,
      allowedTools: dryRun
        ? ['Glob', 'Grep', 'Read']
        : ['Glob', 'Grep', 'Read', 'Write', 'TodoWrite'],
      permissionMode: strictMode ? 'acceptEdits' : 'default',
      maxTurns: 18,
      includePartialMessages: false,
    },
  });

  for await (const message of stream) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          console.log(block.text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('\n✅ Backlog review complete!');
        console.log(`   Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`   Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`   Turns: ${message.num_turns}`);
      } else {
        console.error('\n❌ Agent ended without success.');
        console.error(`Subtype: ${message.subtype}`);
        process.exit(1);
      }
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
