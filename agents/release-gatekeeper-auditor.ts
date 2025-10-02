#!/usr/bin/env -S bun run

/**
 * Release Gatekeeper Auditor
 *
 * A practical everyday agent that inspects a release candidate and assembles a
 * comprehensive readiness scorecard before production rollout. It checks
 * changelog coverage, CI health, configuration drift, feature flag posture, and
 * dependency shifts so release managers can sign off with confidence.
 *
 * Usage:
 *   bun run agents/release-gatekeeper-auditor.ts [options]
 *
 * Examples:
 *   # Audit HEAD against origin/main and write report to release-audit.md
 *   bun run agents/release-gatekeeper-auditor.ts --release HEAD --prev origin/main
 *
 *   # Provide release notes and incident logs for deeper context
 *   bun run agents/release-gatekeeper-auditor.ts \
 *     --release release/2024.02.0 \
 *     --prev release/2024.01.1 \
 *     --notes docs/release-notes/2024.02.0.md \
 *     --changelog CHANGELOG.md \
 *     --incident incidents/ \
 *     --flags config/feature-flags \
 *     --manifest infra/kubernetes/deploy.yaml
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { claude, parsedArgs } from './lib';
import type { ClaudeFlags, Settings } from './lib';

interface CliOptions {
  releaseRef: string;
  previousRef: string;
  reportFile: string;
  notesPath?: string;
  changelogPath?: string;
  featureFlagDirs: string[];
  manifestPaths: string[];
  incidentLogs: string[];
  lookbackDays: number;
  dryRunPlan: boolean;
}

function printHelp(): void {
  console.log(`\n🚦 Release Gatekeeper Auditor\n\nUsage:\n  bun run agents/release-gatekeeper-auditor.ts [options]\n\nOptions:\n  --release <git-ref>        Release candidate ref or branch (default: HEAD)\n  --prev <git-ref>           Previous stable ref for comparison (default: origin/main)\n  --report <file>            Output markdown report path (default: release-gatekeeper-audit.md)\n  --notes <path>             Release notes draft to validate\n  --changelog <path>         Changelog file to cross-check\n  --flags <dir>              Directory with feature flag definitions (repeatable)\n  --manifest <file>          Runtime or infrastructure manifest to diff (repeatable)\n  --incident <path>          Incident or bug log file/dir to review (repeatable)\n  --lookback <days>          History window for issues & rollbacks (default: 14)\n  --dry-run                  Request explicit dry-run rehearsal recommendations\n  --help                     Show this message\n\nExamples:\n  bun run agents/release-gatekeeper-auditor.ts --release HEAD --prev origin/main\n  bun run agents/release-gatekeeper-auditor.ts --release v2.3.0 --prev v2.2.4 --notes notes.md\n`);
}

function getCliOptions(): CliOptions | null {
  const { positionals, values } = parsedArgs;

  if (values.help) {
    printHelp();
    return null;
  }

  const releaseRef = (values.release as string | undefined) || positionals[0] || 'HEAD';
  const previousRef = (values.prev as string | undefined) || 'origin/main';
  const reportFile = (values.report as string | undefined) || 'release-gatekeeper-audit.md';

  let lookbackDays = 14;
  if (values.lookback) {
    const parsed = Number(values.lookback);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error('--lookback must be a positive number of days');
    }
    lookbackDays = Math.floor(parsed);
  }

  return {
    releaseRef,
    previousRef,
    reportFile,
    notesPath: values.notes as string | undefined,
    changelogPath: values.changelog as string | undefined,
    featureFlagDirs: (values.flags as string[] | undefined) || [],
    manifestPaths: (values.manifest as string[] | undefined) || [],
    incidentLogs: (values.incident as string[] | undefined) || [],
    lookbackDays,
    dryRunPlan: (values['dry-run'] as boolean | undefined) || false,
  };
}

function formatPathList(label: string, items: string[]): string {
  if (items.length === 0) {
    return `${label}: none supplied`;
  }
  return `${label}:\n${items.map((item) => `- ${resolve(item)}`).join('\n')}`;
}

function validateHint(pathValue: string | undefined, description: string): string {
  if (!pathValue) {
    return `${description}: not provided`;
  }
  const fullPath = resolve(pathValue);
  const exists = existsSync(fullPath);
  return `${description}: ${fullPath}${exists ? '' : ' (warning: missing)'}`;
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = [
    'release',
    'prev',
    'report',
    'notes',
    'changelog',
    'flags',
    'manifest',
    'incident',
    'lookback',
    'dry-run',
    'help',
  ] as const;

  for (const key of agentKeys) {
    if (key in values) {
      delete values[key];
    }
  }
}

const options = getCliOptions();
if (!options) {
  process.exit(0);
}

console.log('🚦 Release Gatekeeper Auditor\n');
console.log(`📂 Repository: ${process.cwd()}`);
console.log(`🏷️  Release candidate ref: ${options.releaseRef}`);
console.log(`🪜 Previous stable ref: ${options.previousRef}`);
console.log(`🗓️  History lookback: ${options.lookbackDays} days`);
console.log(`📝 Report destination: ${options.reportFile}`);
if (options.dryRunPlan) {
  console.log('🧪 Dry-run rehearsal recommendations requested');
}
console.log('');

const notesHint = validateHint(options.notesPath, 'Release notes');
const changelogHint = validateHint(options.changelogPath, 'Changelog');
const featureFlagHint = formatPathList('Feature flag sources', options.featureFlagDirs);
const manifestHint = formatPathList('Manifest files', options.manifestPaths);
const incidentsHint = formatPathList('Incident or bug logs', options.incidentLogs);

const dryRunDirective = options.dryRunPlan
  ? 'Include a dedicated **Dry-Run Rehearsal Plan** section describing pre-release drills, owners, and expected outcomes.'
  : 'Recommend dry-run steps inline only when high-risk components are detected.';

const prompt = `You are the Release Gatekeeper Auditor, a meticulous release manager bot hired to certify whether a build is safe to ship.

## Release Context
- Candidate ref: ${options.releaseRef}
- Previous stable ref: ${options.previousRef}
- History lookback: ${options.lookbackDays} days
- ${notesHint}
- ${changelogHint}
- ${featureFlagHint}
- ${manifestHint}
- ${incidentsHint}
- Working directory: ${process.cwd()}

## Mission
1. Build a changelog verification report: ensure release notes summarize every notable change since ${options.previousRef}, flag gaps or vague entries.
2. Inspect CI state for ${options.releaseRef}: verify mandatory pipelines ran, highlight flaky reruns, list missing approvals or manual gates.
3. Diff runtime config and infrastructure manifests to catch secrets, env vars, or capacity toggles that changed without sign-off.
4. Analyze feature flag posture: find flags newly introduced, toggled, or stuck in partial rollout that could surprise operators.
5. Compile dependency and binary deltas with vulnerability risk callouts.
6. Correlate recent incidents, rollback notes, or high-priority bugs with touched modules to focus extra scrutiny.
7. Produce a sign-off matrix assigning QA, infra, security, and product owners with their outstanding tasks.
8. ${dryRunDirective}

## Operating Guardrails
- Use git commands to compare ${options.releaseRef} against ${options.previousRef} (log, diff, shortlog).
- Prefer read-only inspections; never run deployment commands or mutate git history.
- For each tool invocation, capture just enough output to justify findings.
- When data is missing (file absent, command fails), record the gap instead of guessing.
- Keep the report actionable and concise—release managers should act on it within minutes.

## Deliverables
Write a markdown report to \\"${resolve(options.reportFile)}\\" using the following outline:

\`\`\`markdown
# Release Gatekeeper Audit

## TL;DR
- **Readiness verdict**: [Ready | Needs Work | Blocked] (score /100)
- **Biggest risks**:
  - [...]
  - [...]
- **Immediate actions**:
  - [...]
  - [...]

## Checklist Status
| Area | Owner | Status | Evidence |
| ---- | ----- | ------ | -------- |
| Changelog |  |  |  |
| CI Pipelines |  |  |  |
| QA Sign-off |  |  |  |
| Infra/Config |  |  |  |
| Observability |  |  |  |

## Change Summary
- Commits since ${options.previousRef}: [count]
- High-risk modules: [...]
- Unlinked work items: [...]

## CI & Quality Signals
- ✅ Passing suites:
- ⚠️ Flaky or skipped suites:
- 🔴 Failures to resolve:
- Test data / fixtures impacted:

## Config & Infrastructure Diff
- Env var changes:
- Secrets / credentials touched:
- Capacity or scaling tweaks:
- Observability hook updates:

## Feature Flag Review
- New flags:
- Flags exiting rollout:
- Flags stuck in partial rollout:
- Cleanup or documentation tasks:

## Dependency & Binary Delta
- Added/updated dependencies of note:
- Vulnerability advisories to check:
- Build artifacts updated:

## Incident & Bug Watchlist
- Related incidents in last ${options.lookbackDays} days:
- Open P0/P1 bugs touching changed code:
- Mitigation steps if risk recurs:

## Sign-off Matrix
| Function | Primary Owner | Backup | Outstanding Work |
| -------- | ------------- | ------ | ---------------- |
| QA |
| Infra |
| Security |
| Product |
| Support |

## Communication Drafts
- Release Slack / email snippet:
- PagerDuty / statuspage note if rollback occurs:

${options.dryRunPlan ? '## Dry-Run Rehearsal Plan\n- [Scenario] → [Owner] → [Target Date]\n- Success metrics:\n' : ''}## Next Steps & Follow-ups
1. [Task → Owner → Due date]
2. [Task → Owner → Due date]

## Appendix
- Key commands executed
- Artifacts and logs collected
\`\`\`

If blockers or high-risk findings remain, capture them via the \`TodoWrite\` tool with priority cues.

End the session by outputting a concise (<=4 sentences) readiness verdict recap for the terminal.
`;

const settings: Settings = {};

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: 'claude-sonnet-4-5-20250929',
  settings: JSON.stringify(settings),
  allowedTools: 'Bash Read Grep Glob Write TodoWrite',
  'permission-mode': 'bypassPermissions',
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log('\n✅ Release audit session complete');
    console.log(`📄 Report saved to: ${options.reportFile}`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Error while running Release Gatekeeper Auditor:', error);
  process.exit(1);
}
