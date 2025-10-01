#!/usr/bin/env bun

/**
 * CI Failure Explainer Agent
 *
 * This agent triages red CI pipelines and produces actionable summaries.
 * - Clusters failures across jobs and shards
 * - Highlights likely culprit commits and code paths
 * - Suggests next diagnostic or remediation steps
 * - Generates communication-ready status updates
 *
 * Usage:
 *   bun run agents/ci-failure-explainer.ts --log path/to/log.txt [options]
 */

import fs from 'node:fs';
import path from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';

type Provider = 'github' | 'gitlab' | 'circleci' | 'azure' | 'buildkite' | 'jenkins' | 'other';

interface CiFailureExplainerOptions {
  logPaths: string[];
  provider?: Provider;
  focusBranch?: string;
  compareBranch?: string;
  flakyWindowMinutes: number;
  includeTimeline: boolean;
  fetchArtifacts: boolean;
}

function printHelp(): void {
  console.log(`\n🚨 CI Failure Explainer\n\nUsage:\n  bun run agents/ci-failure-explainer.ts --log <path> [--log <path> ...] [options]\n\nOptions:\n  --log <path>             Path to a CI log or artifact (repeatable)\n  --provider <name>        CI provider (github|gitlab|circleci|azure|buildkite|jenkins|other)\n  --branch <name>          Failing branch or tag\n  --compare <ref>          Reference branch to diff against (e.g. main)\n  --flake-window <mins>    Minutes of history to inspect for flaky tests (default: 720)\n  --timeline               Ask the agent to reconstruct a job timeline\n  --fetch-artifacts        Allow the agent to recreate curl commands for artifact downloads\n  --help                   Show this message\n\nExamples:\n  bun run agents/ci-failure-explainer.ts --log artifacts/ci/github-actions.log\n  bun run agents/ci-failure-explainer.ts --log logs/job.log --log logs/tests.log --branch release/1.3 --compare main\n  `);
}

function expectValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseArgs(argv: string[]): CiFailureExplainerOptions {
  if (argv.length === 0) {
    printHelp();
    throw new Error('No arguments supplied');
  }

  const options: CiFailureExplainerOptions = {
    logPaths: [],
    flakyWindowMinutes: 720,
    includeTimeline: false,
    fetchArtifacts: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const rawArg = argv[i];
    if (rawArg === undefined) {
      continue;
    }
    const arg = rawArg;
    switch (arg) {
      case '--help':
        printHelp();
        process.exit(0);
      case '--log': {
        const value = expectValue(argv, ++i, '--log');
        options.logPaths.push(value);
        break;
      }
      case '--provider': {
        const value = expectValue(argv, ++i, '--provider');
        options.provider = (value as Provider) ?? undefined;
        break;
      }
      case '--branch': {
        options.focusBranch = expectValue(argv, ++i, '--branch');
        break;
      }
      case '--compare': {
        options.compareBranch = expectValue(argv, ++i, '--compare');
        break;
      }
      case '--flake-window': {
        const value = expectValue(argv, ++i, '--flake-window');
        const minutes = Number(value);
        if (!Number.isFinite(minutes) || minutes <= 0) {
          throw new Error('flake-window must be a positive number of minutes');
        }
        options.flakyWindowMinutes = minutes;
        break;
      }
      case '--timeline':
        options.includeTimeline = true;
        break;
      case '--fetch-artifacts':
        options.fetchArtifacts = true;
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        options.logPaths.push(arg);
    }
  }

  if (options.logPaths.length === 0) {
    throw new Error('Provide at least one --log path');
  }

  return options;
}

function resolvePaths(paths: string[]): string[] {
  return paths.map((p) => path.resolve(p));
}

function uniqueDirectories(filePaths: string[]): string[] {
  const dirs = new Set<string>();
  for (const filePath of filePaths) {
    dirs.add(path.dirname(filePath));
  }
  return Array.from(dirs);
}

function buildPrompt(options: CiFailureExplainerOptions, resolvedLogs: string[]): string {
  const logList = resolvedLogs.map((log) => `- ${log}`).join('\n');
  const provider = options.provider ?? 'unspecified';
  const focusBranch = options.focusBranch ?? 'not provided';
  const compareBranch = options.compareBranch ?? 'not provided';
  const timelineExpectation = options.includeTimeline
    ? 'Reconstruct a concise, ordered timeline calling out when each job failed.'
    : 'Timeline reconstruction is optional; focus on the failure surface.';
  const artifactExpectation = options.fetchArtifacts
    ? 'Propose safe curl commands that could download supporting artifacts (do not execute them).'
    : 'Do not craft download commands unless absolutely necessary.';

  return `You are a veteran CI reliability engineer tasked with explaining why the latest pipeline failed.

Input context:
- CI provider: ${provider}
- Focus branch/tag: ${focusBranch}
- Comparison branch/ref: ${compareBranch}
- Flaky history window: ${options.flakyWindowMinutes} minutes
- Log files to inspect:
${logList}

Operating instructions:
1. Read the supplied logs to identify error clusters, repeating messages, and failing test signatures.
2. Use pattern searches to connect stack traces or failing tests to code paths and recent commits.
3. Highlight whether the failure is deterministic or potentially flaky using the provided history window.
4. Map failures to suspect owners or modules using git metadata when available.
5. Summarize which jobs are impacted, how severe the failure is, and the fastest mitigation path.
6. ${timelineExpectation}
7. ${artifactExpectation}

Deliverables:
- A short TL;DR paragraph for a stand-up update or Slack post.
- A detailed breakdown including suspected root cause, supporting evidence, and recommended next actions.
- A decision on whether to retry, revert, or investigate further, including responsible parties if identifiable.
- A follow-up checklist (bullet list) that the on-call engineer can execute immediately.

Constraints:
- Never fabricate log content; cite exact lines when making claims.
- If information is missing, state the gap and suggest how to gather it.
- Keep the analysis grounded in the provided artifacts and accessible within 10 minutes for a stressed engineer.
`;
}

async function runCiFailureExplainer(rawOptions: CiFailureExplainerOptions) {
  const resolvedLogs = resolvePaths(rawOptions.logPaths);
  const missingLogs = resolvedLogs.filter((log) => !fs.existsSync(log));
  if (missingLogs.length > 0) {
    console.warn('⚠️  Warning: Some log files do not exist:');
    for (const missing of missingLogs) {
      console.warn(`   - ${missing}`);
    }
  }

  console.log('🛠️  CI Failure Explainer initializing...');
  console.log('Analyzing logs:');
  for (const log of resolvedLogs) {
    console.log(`   • ${log}`);
  }
  if (rawOptions.provider) {
    console.log(`Provider: ${rawOptions.provider}`);
  }
  if (rawOptions.focusBranch) {
    console.log(`Branch: ${rawOptions.focusBranch}`);
  }
  if (rawOptions.compareBranch) {
    console.log(`Compare against: ${rawOptions.compareBranch}`);
  }
  console.log('');

  const prompt = buildPrompt(rawOptions, resolvedLogs);
  const additionalDirectories = uniqueDirectories(resolvedLogs);

  const stream = query({
    prompt,
    options: {
      cwd: process.cwd(),
      additionalDirectories,
      allowedTools: ['Read', 'Grep', 'Bash', 'Write', 'TodoWrite', 'Task'],
      maxTurns: 45,
      permissionMode: 'acceptEdits',
      agents: {
        'log-clusterer': {
          description: 'Clusters CI log lines into failure buckets and finds repeating patterns',
          tools: ['Read', 'Grep'],
          prompt: 'You are a log clustering assistant focused on grouping stack traces and test failures.',
          model: 'haiku',
        },
        'root-cause-analyst': {
          description: 'Maps failures to commits, modules, and owners to propose root causes',
          tools: ['Read', 'Grep', 'Bash'],
          prompt: 'You analyze diffs and blame data to identify the most likely root cause for CI failures.',
          model: 'sonnet',
        },
        'playbook-author': {
          description: 'Produces concise remediation plans and status communications',
          tools: ['Write', 'TodoWrite'],
          prompt: 'You write crisp remediation plans and ready-to-send status updates for CI incidents.',
          model: 'haiku',
        },
      },
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input: any) => {
                if (input.hook_event_name === 'PreToolUse') {
                  if (input.tool_name === 'Read') {
                    console.log(`📖 Reading: ${(input.tool_input as { file_path?: string }).file_path ?? 'unknown file'}`);
                  }
                  if (input.tool_name === 'Grep') {
                    console.log('🔎 Searching logs...');
                  }
                }
                return { continue: true };
              },
            ],
          },
        ],
        PostToolUse: [
          {
            hooks: [
              async (input: any) => {
                if (input.hook_event_name === 'PostToolUse' && input.tool_name === 'Write') {
                  console.log('📝 Drafted summary content.');
                }
                return { continue: true };
              },
            ],
          },
        ],
      },
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  for await (const message of stream) {
    if (message.type === 'assistant') {
      const textContent = message.message.content.find(
        (chunk: { type: string }) => chunk.type === 'text'
      ) as { type: 'text'; text: string } | undefined;
      if (textContent) {
        console.log(`\n🤖 ${textContent.text}`);
      }
    } else if (message.type === 'system' && message.subtype === 'init') {
      console.log('🤖 Agent connected. Beginning analysis...');
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('\n' + '='.repeat(60));
        console.log('✅ CI Failure Explainer Report');
        console.log('='.repeat(60));
        console.log(`Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`API time: ${(message.duration_api_ms / 1000).toFixed(2)}s`);
        console.log(`Turns: ${message.num_turns}`);
        console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(
          `Tokens used: ${message.usage.input_tokens} prompt / ${message.usage.output_tokens} completion`
        );
        if (message.permission_denials.length > 0) {
          console.log('Permissions denied:', message.permission_denials.length);
        }
      } else {
        console.error(`\n❌ Analysis ended due to ${message.subtype}`);
      }
    }
  }
}

(async () => {
  try {
    const options = parseArgs(process.argv.slice(2));
    await runCiFailureExplainer(options);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ ${error.message}`);
    } else {
      console.error('❌ Unexpected error', error);
    }
    process.exit(1);
  }
})();
