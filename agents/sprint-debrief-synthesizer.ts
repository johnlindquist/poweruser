#!/usr/bin/env bun

/**
 * Sprint Debrief Synthesizer Agent
 *
 * A practical everyday agent that turns sprint chaos into crisp, stakeholder-ready updates:
 * - Aggregates merged PRs, issue tracker movements, and deployment notes into a single timeline
 * - Highlights scope changes, carryover work, and blockers with owner callouts pulled from commit metadata
 * - Surfaces metrics like lead time, review turnaround, and bug reopen rates with trend deltas
 * - Drafts narrative summaries tailored to engineers, PMs, and leadership with adjustable tone presets
 * - Suggests celebratory shout-outs and follow-up todos so nothing falls through the cracks in retro
 * - Perfect for teams who want consistent debriefs without sacrificing engineering time
 */

import path from 'node:path';
import process from 'node:process';
import { query } from '@anthropic-ai/claude-agent-sdk';

type Audience = 'engineering' | 'pm' | 'exec' | 'mixed';
type OutputFormat = 'markdown' | 'slack' | 'html';

interface CliOptions {
  projectPath: string;
  since?: string;
  until?: string;
  outputFile: string;
  audience: Audience;
  format: OutputFormat;
  includeShoutouts: boolean;
  includeMetrics: boolean;
  includeRetroPrompts: boolean;
}

function parseCliArgs(argv: string[]): CliOptions {
  let projectPath = process.cwd();
  let since: string | undefined;
  let until: string | undefined;
  let outputFile = 'sprint-debrief.md';
  let audience: Audience = 'mixed';
  let format: OutputFormat = 'markdown';
  let includeShoutouts = true;
  let includeMetrics = true;
  let includeRetroPrompts = true;

  const positional: string[] = [];

  const expectValue = (args: string[], index: number, flag: string): string => {
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${flag}`);
    }
    return value;
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) {
      continue;
    }
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    switch (arg) {
      case '--since': {
        const value = expectValue(argv, i, '--since');
        since = value;
        i += 1;
        break;
      }
      case '--until': {
        const value = expectValue(argv, i, '--until');
        until = value;
        i += 1;
        break;
      }
      case '--output': {
        const value = expectValue(argv, i, '--output');
        outputFile = value;
        i += 1;
        break;
      }
      case '--audience': {
        const value = expectValue(argv, i, '--audience') as Audience;
        if (!['engineering', 'pm', 'exec', 'mixed'].includes(value)) {
          throw new Error(`Unsupported audience: ${value}`);
        }
        audience = value;
        i += 1;
        break;
      }
      case '--format': {
        const value = expectValue(argv, i, '--format') as OutputFormat;
        if (!['markdown', 'slack', 'html'].includes(value)) {
          throw new Error(`Unsupported format: ${value}`);
        }
        format = value;
        i += 1;
        break;
      }
      case '--no-shoutouts': {
        includeShoutouts = false;
        break;
      }
      case '--no-metrics': {
        includeMetrics = false;
        break;
      }
      case '--no-retro': {
        includeRetroPrompts = false;
        break;
      }
      default: {
        throw new Error(`Unknown flag: ${arg}`);
      }
    }
  }

  if (positional.length > 0) {
    const firstPositional = positional[0];
    if (typeof firstPositional === 'string') {
      projectPath = path.resolve(process.cwd(), firstPositional);
    }
  }

  return {
    projectPath,
    since,
    until,
    outputFile,
    audience,
    format,
    includeShoutouts,
    includeMetrics,
    includeRetroPrompts,
  };
}

async function main() {
  let options: CliOptions;
  try {
    options = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error('❌ Failed to parse arguments:', error instanceof Error ? error.message : error);
    console.error('Usage: bun sprint-debrief-synthesizer [projectPath] [--since <range>] [--until <date>] [--output <file>] [--audience engineering|pm|exec|mixed] [--format markdown|slack|html] [--no-shoutouts] [--no-metrics] [--no-retro]');
    process.exit(1);
    return;
  }

  const resolvedOutputPath = path.resolve(options.projectPath, options.outputFile);

  console.log('🗂️  Sprint Debrief Synthesizer');
  console.log(`📁 Project: ${options.projectPath}`);
  if (options.since || options.until) {
    console.log(`🕰️  Timeframe: ${options.since ? `since ${options.since}` : ''}${options.since && options.until ? ' ' : ''}${options.until ? `until ${options.until}` : ''}`.trim());
  } else {
    console.log('🕰️  Timeframe: auto-detect last completed sprint or recent 2 weeks');
  }
  console.log(`👥 Audience focus: ${options.audience}`);
  console.log(`📝 Output format: ${options.format}`);
  console.log(`📄 Report destination: ${resolvedOutputPath}`);
  console.log(`🎉 Shout-outs: ${options.includeShoutouts ? 'enabled' : 'disabled'}`);
  console.log(`📈 Metrics: ${options.includeMetrics ? 'enabled' : 'disabled'}`);
  console.log(`🔁 Retro prompts: ${options.includeRetroPrompts ? 'included' : 'omitted'}`);
  console.log();

  const timeframeSummary = options.since || options.until
    ? `${options.since ? `since ${options.since}` : ''}${options.since && options.until ? ' ' : ''}${options.until ? `until ${options.until}` : ''}`.trim()
    : 'auto-detect the most recent sprint window (default to the last 2 weeks if unsure)';

  const systemPrompt = `You are the Sprint Debrief Synthesizer, an expert agent that consolidates sprint activity into actionable narratives for mixed technical and product audiences.

Responsibilities:
- Reconstruct the sprint timeline using git merges, branch activity, and deployment tags
- Pull in issue tracker context (Linear, Jira, GitHub issues, etc.) by reading local docs and JSON exports when available
- Highlight meaningful scope changes, spillover work, and blockers with responsible owners
- Surface sprint health metrics: lead time, cycle time, review duration, bug reopen counts, and deployment frequency
- Tailor storytelling for the requested audience profile (${options.audience}) and the desired broadcast format (${options.format})
- Always save the final deliverable to ${resolvedOutputPath}
- Use Bash, Grep, Glob, and Read to gather evidence; write the recap with Write. Use TodoWrite if you need to push follow-up tasks.

Guardrails:
- Prefer concrete evidence (commit hashes, issue IDs, deployment tags) and cite file paths when making claims
- Provide balanced signal: wins, learnings, risks, and next steps
- Keep timelines chronological and note date boundaries clearly`;

  const prompt = `Prepare a sprint debrief for project at ${options.projectPath}.

Context window: ${timeframeSummary}.

Deliverables:
1. A succinct executive summary (bullets + narrative) aligned to the ${options.audience} audience.
2. Chronological sprint timeline covering merges, releases, and major issue updates.
3. ${options.includeMetrics ? 'Sprint health metrics (lead time, review turnaround, bug reopen rate, deployment frequency) with comparisons to previous sprint if possible.' : 'Skip detailed metric calculations; focus on qualitative highlights.'}
4. ${options.includeShoutouts ? 'Celebratory shout-outs highlighting contributors and cross-team assists.' : 'Do not include shout-outs or celebration notes.'}
5. ${options.includeRetroPrompts ? 'Follow-up actions and retro prompts grouped by owner with due dates or checkpoints.' : 'Skip retro prompts; only list critical next steps.'}
6. Format the final deliverable for ${options.format} consumption (structure markdown tables vs Slack-ready sections accordingly).
7. Persist the final report to ${resolvedOutputPath} via the Write tool (overwrite existing content).

Research workflow suggestions:
- Use Bash with git commands (git log --merges, git shortlog, git show) narrowed to the sprint window to understand PR flow.
- Use Glob/Grep to locate issue tracker exports (e.g., *.linear.json, jira-export*.csv, docs/sprint-notes.md) and summarize updates.
- Inspect deployment manifests, CHANGELOG entries, or release notes to capture production changes.
- Cross-reference review durations using git log --pretty and file metadata; highlight outliers.
- Note scope changes by identifying issues reopened or re-estimated mid-sprint.

Style:
- Keep tone professional yet celebratory where applicable.
- Include tables for metrics when format=${options.format === 'markdown' ? 'markdown tables' : options.format}.
- Close with a clear CTA section (e.g., "Next Sprint Prep", "Risks to Monitor").

Double-check that every section requested above is included and that the written report references concrete data sources.`;

  try {
    const result = query({
      prompt,
      options: {
        cwd: options.projectPath,
        systemPrompt,
        allowedTools: [
          'Bash',
          'Grep',
          'Glob',
          'Read',
          'Write',
          'TodoWrite',
          'Edit'
        ],
        model: 'sonnet',
        permissionMode: 'bypassPermissions',
        maxTurns: 40,
      },
    });

    for await (const message of result) {
      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if (block.type === 'text') {
            console.log(block.text);
          }
        }
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          console.log('\n✅ Sprint debrief synthesis complete!');
          console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
          console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`📊 Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);
          console.log(`📄 Report saved to: ${resolvedOutputPath}`);
        } else {
          console.error(`\n❌ Sprint debrief synthesis failed: ${message.subtype}`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error running Sprint Debrief Synthesizer:', error);
    process.exit(1);
  }
}

main();
