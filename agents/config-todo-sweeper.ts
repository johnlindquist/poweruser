#!/usr/bin/env bun

/**
 * Config TODO Sweeper
 *
 * Blazing-fast audit that surfaces lingering TODOs hiding inside configuration files
 * before they slip into a release. Scans config directories, groups findings by
 * environment, and compiles a ready-to-share action list with ownership hints.
 *
 * Usage:
 *   bun run agents/config-todo-sweeper.ts [options]
 *
 * Options:
 *   --project-path <path>        Root of the repository to scan (default: cwd)
 *   --config-dirs <dirs>         Comma-separated list of config directories to prioritize
 *   --patterns <pattern-list>    Comma-separated TODO markers to search for (default: TODO,FIXME,TEMP)
 *   --max-age-days <number>      Escalate TODOs older than this many days using git history (default: 30)
 *   --include-secrets            Treat secrets references as actionable instead of informational
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface ConfigTodoSweeperOptions {
  projectPath?: string;
  configDirs?: string[];
  patterns?: string[];
  maxAgeDays?: number;
  includeSecrets?: boolean;
}

export async function runConfigTodoSweeper(options: ConfigTodoSweeperOptions = {}) {
  const {
    projectPath = process.cwd(),
    configDirs = ['config', 'configs', 'configurations', 'env', 'environments'],
    patterns = ['TODO', 'FIXME', 'TEMP', 'REMOVE_BEFORE_RELEASE'],
    maxAgeDays = 30,
    includeSecrets = false,
  } = options;

  const prompt = `You are the Config TODO Sweeper, an elite fast-response agent that keeps lingering configuration TODOs from escaping into production.

Project path: ${projectPath}
Primary config directories: ${configDirs.join(', ') || 'none specified'}
Markers to detect: ${patterns.join(', ')}
Escalate TODOs older than: ${maxAgeDays} days
Treat secret references as actionable: ${includeSecrets ? 'yes' : 'no'}

Mission checklist:
1. Use Glob to locate configuration files (\`.env*\`, \*.yaml, \*.yml, \*.json, \*.toml, \*.ini, \*.conf) within the project. Prioritize the provided directories but cover the entire repo.
2. Use Grep to scan these files for the specified markers. Be case-insensitive and include variations such as \`// TODO\`, \`#TODO\`, or inline JSON comments.
3. For each hit, grab surrounding context using Read (5 lines before/after) so the owner knows exactly what needs attention.
4. Infer the environment (dev/staging/prod/local/test) from file paths or section names. Group results under these headings.
5. Run Bash + git blame to determine when each TODO was introduced and by whom. Flag items older than ${maxAgeDays} days with a 🚨 status indicator.
6. Highlight any TODOs mentioning keys like "secret", "token", "key", or "password"${includeSecrets ? ' as immediate action items' : ' as informational alerts unless dangerous'}.
7. Produce a compact markdown report that includes:
   - Executive summary with counts by environment and urgency level
   - Per-environment tables listing file path, line, owner (if determinable), age, and a one-line description
   - Standup-ready checklist with owners and suggested next steps
   - Suggested follow-up actions (e.g., create ticket, pair with owner, scrub before release)
8. Close with a quick win section recommending the first three TODOs to tackle today (pick the oldest/highest-risk items).

Rules of engagement:
- Operate quickly (under 10 seconds) by preferring Grep over fully parsing files
- Never mutate user code or configs; this is a read-only audit
- Keep the final output self-contained so it can be pasted into Slack or an issue tracker
- Assume the user will review the report manually before acting; be precise and trustworthy.
`;

  console.log('🧹  Config TODO Sweeper engaged...\n');
  console.log(`📂 Project: ${projectPath}`);
  console.log(`🗂️  Focus directories: ${configDirs.join(', ') || '(none specified)'}`);
  console.log(`🔍 Markers: ${patterns.join(', ')}`);
  console.log(`⏳ Escalation threshold: ${maxAgeDays} day(s)`);
  console.log(`🔐 Treat secrets as actionable: ${includeSecrets ? 'yes' : 'no'}\n`);

  const result = query({
    prompt,
    options: {
      cwd: projectPath,
      allowedTools: ['Glob', 'Grep', 'Read', 'Bash', 'Write'],
      permissionMode: 'default',
      includePartialMessages: false,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  let finalReport = '';

  for await (const message of result) {
    if (message.type === 'assistant') {
      for (const content of message.message.content) {
        if (content.type === 'text') {
          console.log(content.text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        finalReport = message.result;
        console.log('\n✅ Sweep complete!');
        console.log(`\n💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
        console.log(`🔄 Turns: ${message.num_turns}`);
      } else {
        console.error('\n❌ Agent run failed:', message.subtype);
        process.exit(1);
      }
    }
  }

  return finalReport;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const options: ConfigTodoSweeperOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--project-path':
        options.projectPath = args[++i];
        break;
      case '--config-dirs':
        options.configDirs = args[++i]?.split(',').map((dir) => dir.trim()).filter(Boolean);
        break;
      case '--patterns':
        options.patterns = args[++i]?.split(',').map((pattern) => pattern.trim()).filter(Boolean);
        break;
      case '--max-age-days':
        options.maxAgeDays = Number.parseInt(args[++i] ?? '', 10) || undefined;
        break;
      case '--include-secrets':
        options.includeSecrets = true;
        break;
      case '--help':
        console.log(`
Config TODO Sweeper

Usage:
  bun run agents/config-todo-sweeper.ts [options]

Options:
  --project-path <path>        Root of the repository to scan (default: cwd)
  --config-dirs <dirs>         Comma-separated list of config directories to prioritize
  --patterns <pattern-list>    Comma-separated TODO markers to search for (default: TODO,FIXME,TEMP)
  --max-age-days <number>      Escalate TODOs older than this many days using git history (default: 30)
  --include-secrets            Treat secrets references as actionable instead of informational
  --help                       Show this help message

Examples:
  bun run agents/config-todo-sweeper.ts
  bun run agents/config-todo-sweeper.ts --config-dirs env,config/deploy --max-age-days 14
  bun run agents/config-todo-sweeper.ts --patterns TODO,FIXME,HACK --include-secrets
`);
        process.exit(0);
      default:
        console.warn(`Unknown option: ${args[i]}`);
        console.log('Use --help to see available options.');
        process.exit(1);
    }
  }

  runConfigTodoSweeper(options).catch((error) => {
    console.error('\n❌ Unexpected error while sweeping config TODOs:\n', error);
    process.exit(1);
  });
}
