#!/usr/bin/env bun

/**
 * NPM Package Auditor Agent
 *
 * Purpose-built agent for auditing npm dependencies within a project:
 * - Detects vulnerability exposure via `npm audit --json`
 * - Highlights outdated packages and semver risk levels
 * - Surfaces duplicated or orphaned dependencies from `npm ls`
 * - Optionally models safe fixes and SBOM snapshots
 * - Produces actionable markdown reports with remediation playbooks
 *
 * Usage:
 *   bun run agents/npm-package-auditor.ts [options]
 *
 * Options:
 *   --project <path>        Path to project directory (default: current directory)
 *   --include-dev           Include devDependencies in the risk analysis
 *   --severity <level>      Minimum severity to flag (low|moderate|high|critical)
 *   --plan-fixes            Explore safe remediation commands (dry-run only)
 *   --sbom                  Generate an SBOM appendix from `npm ls --json`
 *   --help                  View detailed help
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const SEVERITY_LEVELS = ['low', 'moderate', 'high', 'critical'] as const;
type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

type NpmPackageAuditOptions = {
  projectPath: string;
  includeDev?: boolean;
  severity?: SeverityLevel;
  planFixes?: boolean;
  generateSbom?: boolean;
};

async function runNpmPackageAudit(options: NpmPackageAuditOptions) {
  const {
    projectPath,
    includeDev = false,
    severity = 'moderate',
    planFixes = false,
    generateSbom = false,
  } = options;

  console.log('🧮 NPM Package Auditor booting up...\n');
  console.log(`📂 Project: ${projectPath}`);
  console.log(`🧪 Include devDependencies: ${includeDev}`);
  console.log(`🚨 Minimum severity reported: ${severity}`);
  console.log(`🛠️  Explore remediation playbook: ${planFixes}`);
  console.log(`📦 SBOM appendix: ${generateSbom}\n`);

  const prompt = `You are the "NPM Package Auditor". Focus exclusively on npm and Node.js dependency health for the project at: ${projectPath}

Core expectations:
1. Validate project readiness
   - Confirm package.json exists; abort gracefully otherwise
   - Detect package manager lockfile (package-lock.json, npm-shrinkwrap.json)
   - Note Node.js and npm engine requirements if declared
2. Baseline dependency map
   - Use \`npm ls --all --json\` to understand the resolved tree
   - Flag duplicate majors, orphaned packages, and peer dependency conflicts
3. Vulnerability assessment
   - Run \`npm audit --json ${includeDev ? '--include=dev' : '--omit=dev'}\`
   - Summarize by severity bands; only include findings at or above ${severity.toUpperCase()}
   - Distinguish between direct and transitive vulnerabilities
   - Capture remediation commands proposed by npm audit
4. Version freshness check
   - Run \`npm outdated\` to compare installed vs latest versions
   - Categorize availability: patch/minor/major and flag risky jumps
5. ${planFixes ? 'Remediation playbook (dry-run only)' : 'Remediation recommendations'}
   - ${planFixes ? 'Simulate fixes via `npm audit fix --dry-run` and list proposed changes' : 'List safest remediation commands; do not modify lockfiles'}
   - Pair each recommendation with testing guidance
6. Supply-chain hygiene
   - Inspect download counts, maintainer signals, or abandonment warnings via WebFetch (e.g. npmjs.com/package/<name>) when high-risk packages appear
   - Note signed packages, maintainers of concern, or typosquatting warnings when applicable
7. Reporting
   - Generate a markdown report saved to npm-audit-report.md in the project root
   - Include sections: Executive Summary, Vulnerability Matrix, Outdated Packages, Duplicate/Peer Issues, Remediation Playbook, Observed Supply-Chain Risks${generateSbom ? ', SBOM Appendix' : ''}
   - Use tables with severity badges and clear action items

Operating constraints:
- Prefer npm CLI commands; only inspect other ecosystems if the project mixes package managers
- Never run destructive commands (no install/uninstall)
- When commands fail, capture stderr and explain likely causes
- Keep actionable recommendations concise (who should do what next)
- Emphasize CI/CD guardrails if critical issues appear
${generateSbom ? '\nSBOM requirement: export npm tree to JSON and include digest stats (package count, depth, top vendors).' : ''}\n`; // eslint-disable-line max-len

  const result = query({
    prompt,
    options: {
      cwd: projectPath,
      allowedTools: [
        'Bash',
        'BashOutput',
        'Read',
        'Write',
        'Edit',
        'Glob',
        'Grep',
        'WebFetch',
        'WebSearch',
      ],
      agents: {
        'npm-vulnerability-analyst': {
          description: 'Specialist focusing on npm audit results and CVE interpretation',
          tools: ['Bash', 'Read', 'WebFetch', 'WebSearch'],
          prompt: 'Analyze npm audit JSON output, cross-reference CVEs, and explain impact on the codebase succinctly.',
          model: 'sonnet',
        },
        'version-radar': {
          description: 'Tracks npm outdated results and evaluates semver risk',
          tools: ['Bash', 'Read', 'WebFetch'],
          prompt: 'Compare installed versions with latest releases and flag risky upgrades. Capture changelog notes when possible.',
          model: 'haiku',
        },
        'supply-chain-sleuth': {
          description: 'Surfaces maintainer and ecosystem red flags for npm packages',
          tools: ['WebFetch', 'WebSearch'],
          prompt: 'Investigate suspicious npm packages for abandonment, typosquatting, or maintainer churn. Summarize only high-signal findings.',
          model: 'haiku',
        },
      },
      permissionMode: 'default',
      maxTurns: 28,
      model: 'claude-sonnet-4-5-20250929',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  if (input.tool_name === 'Bash') {
                    const command = (input.tool_input as any)?.command ?? '';
                    if (command.includes('npm audit')) {
                      console.log('🔎 Running npm audit...');
                    }
                    if (command.includes('npm outdated')) {
                      console.log('🗒️  Checking outdated packages...');
                    }
                    if (command.includes('npm ls')) {
                      console.log('🌳 Mapping dependency tree...');
                    }
                  }
                }
                return { continue: true };
              },
            ],
          },
        ],
        SessionEnd: [
          {
            hooks: [
              async () => {
                console.log('\n📘 NPM Package Auditor session ended.');
                console.log('➡️  Review npm-audit-report.md for the full findings.');
                console.log('➡️  Prioritize remediation by severity and test coverage.');
                return { continue: true };
              },
            ],
          },
        ],
      },
    },
  });

  let streamHadAssistantOutput = false;

  for await (const message of result) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          streamHadAssistantOutput = true;
          console.log(block.text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('\n✅ npm package audit complete!');
        console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
        console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`🔢 Turns: ${message.num_turns}`);
      } else {
        console.error('\n❌ Audit failed:', message.subtype);
      }
    }
  }

  if (!streamHadAssistantOutput) {
    console.warn('\n⚠️  Agent finished without streaming commentary. Check logs for issues.');
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
NPM Package Auditor Agent

Usage:
  bun run agents/npm-package-auditor.ts [options]

Options:
  --project <path>        Path to project directory (default: current directory)
  --include-dev           Include devDependencies in the risk analysis
  --severity <level>      Minimum severity to flag (low|moderate|high|critical)
  --plan-fixes            Explore safe remediation commands (dry-run only)
  --sbom                  Generate an SBOM appendix from npm ls output
  --help                  Show this help message

Examples:
  # Audit the current project with default settings
  bun run agents/npm-package-auditor.ts

  # Include devDependencies and explore remediation commands
  bun run agents/npm-package-auditor.ts --include-dev --plan-fixes

  # Only surface high severity issues for another repo
  bun run agents/npm-package-auditor.ts --project ../api --severity high

  # Produce SBOM appendix alongside the report
  bun run agents/npm-package-auditor.ts --sbom
    `);
    process.exit(0);
  }

  let projectPath = process.cwd();
  let includeDev = false;
  let planFixes = false;
  let severity: SeverityLevel = 'moderate';
  let generateSbom = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--project':
        projectPath = args[++i] ?? projectPath;
        break;
      case '--include-dev':
        includeDev = true;
        break;
      case '--plan-fixes':
        planFixes = true;
        break;
      case '--sbom':
        generateSbom = true;
        break;
      case '--severity':
        {
          const level = (args[++i] ?? '').toLowerCase();
          if (SEVERITY_LEVELS.includes(level as SeverityLevel)) {
            severity = level as SeverityLevel;
          } else {
            console.warn(`⚠️  Unknown severity "${level}". Falling back to "${severity}".`);
          }
        }
        break;
      default:
        if (arg && arg.startsWith('--')) {
          console.warn(`⚠️  Ignoring unknown option: ${arg}`);
        }
        break;
    }
  }

  runNpmPackageAudit({
    projectPath,
    includeDev,
    severity,
    planFixes,
    generateSbom,
  }).catch((error) => {
    console.error('❌ Fatal error during npm package audit:', error);
    process.exit(1);
  });
}

export { runNpmPackageAudit };
