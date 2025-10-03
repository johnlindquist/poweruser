#!/usr/bin/env -S bun run

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
import { claude, getPositionals, parsedArgs, readStringFlag, readBooleanFlag, collectRepeatedFlag } from './lib';
import type { ClaudeFlags, Settings } from './lib';

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


const argv = process.argv.slice(2);
const positionals = getPositionals();
const values = parsedArgs.values as Record<string, unknown>;

const helpFlag = values.help === true || argv.includes('--help');
if (helpFlag && argv.length === 0) {
  printHelp();
  process.exit(0);
}

if (helpFlag) {
  printHelp();
  process.exit(0);
}


function parseCliOptions(): CiFailureExplainerOptions {
  const logPaths = [...collectRepeatedFlag('log'), ...positionals];

  if (logPaths.length === 0) {
    console.error('❌ Error: Provide at least one --log path');
    printHelp();
    process.exit(1);
  }

  const rawFlakeWindow = readStringFlag('flake-window');
  const flakyWindowMinutes = rawFlakeWindow ? Number(rawFlakeWindow) : 720;
  if (!Number.isFinite(flakyWindowMinutes) || flakyWindowMinutes <= 0) {
    console.error('❌ Error: --flake-window must be a positive number of minutes');
    process.exit(1);
  }

  return {
    logPaths,
    provider: typeof values.provider === 'string' ? (values.provider as Provider) : undefined,
    focusBranch: readStringFlag('branch'),
    compareBranch: readStringFlag('compare'),
    flakyWindowMinutes,
    includeTimeline: readBooleanFlag('timeline', false),
    fetchArtifacts: readBooleanFlag('fetch-artifacts', false),
  };
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

  const claudeSettings: Settings = additionalDirectories.length > 0
    ? { permissions: { additionalDirectories } }
    : {};

  const allowedTools = [
    'Read',
    'Grep',
    'Bash',
    'Write',
    'TodoWrite',
    'Task',
  ];

  const defaultFlags: ClaudeFlags = {
    model: 'claude-sonnet-4-5-20250929',
    settings: JSON.stringify(claudeSettings),
    allowedTools: allowedTools.join(' '),
    'permission-mode': 'acceptEdits',
  };

  try {
    const exitCode = await claude(prompt, defaultFlags);
    if (exitCode === 0) {
      console.log('\n✅ CI failure analysis complete!');
    }
    return exitCode;
  } catch (error) {
    console.error('❌ Error during CI failure analysis:', error);
    return 1;
  }
}

const cliOptions = parseCliOptions();

runCiFailureExplainer(cliOptions)
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
