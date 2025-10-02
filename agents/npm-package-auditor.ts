#!/usr/bin/env -S bun run

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

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

const SEVERITY_LEVELS = ['low', 'moderate', 'high', 'critical'] as const;
type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

interface NpmPackageAuditOptions {
  projectPath: string;
  includeDev: boolean;
  severity: SeverityLevel;
  planFixes: boolean;
  generateSbom: boolean;
}

const DEFAULT_SEVERITY: SeverityLevel = 'moderate';

function printHelp(): void {
  console.log(`
🧮 NPM Package Auditor

Usage:
  bun run agents/npm-package-auditor.ts [options]

Options:
  --project <path>        Path to project directory (default: current directory)
  --include-dev           Include devDependencies in the risk analysis
  --severity <level>      Minimum severity to flag (low|moderate|high|critical, default: ${DEFAULT_SEVERITY})
  --plan-fixes            Explore safe remediation commands (dry-run only)
  --sbom                  Generate an SBOM appendix from npm ls output
  --help, -h              Show this help

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
}

function parseOptions(): NpmPackageAuditOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawProject = values.project;
  const includeDev = values['include-dev'] === true || values.includeDev === true;
  const planFixes = values['plan-fixes'] === true || values.planFixes === true;
  const generateSbom = values.sbom === true;
  const rawSeverity = values.severity;

  const projectPath = typeof rawProject === "string" && rawProject.length > 0
    ? resolve(rawProject)
    : process.cwd();

  let severity: SeverityLevel = DEFAULT_SEVERITY;
  if (typeof rawSeverity === "string" && rawSeverity.length > 0) {
    const level = rawSeverity.toLowerCase();
    if (SEVERITY_LEVELS.includes(level as SeverityLevel)) {
      severity = level as SeverityLevel;
    } else {
      console.warn(`⚠️  Unknown severity "${level}". Falling back to "${DEFAULT_SEVERITY}".`);
    }
  }

  return {
    projectPath,
    includeDev,
    severity,
    planFixes,
    generateSbom,
  };
}

function buildPrompt(options: NpmPackageAuditOptions): string {
  const { includeDev, severity, planFixes, generateSbom } = options;

  return `You are the "NPM Package Auditor". Focus exclusively on npm and Node.js dependency health for this project.

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

}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["project", "include-dev", "includeDev", "severity", "plan-fixes", "planFixes", "sbom", "help", "h"] as const;

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

console.log('🧮 NPM Package Auditor\n');
console.log(`📂 Project: ${options.projectPath}`);
console.log(`🧪 Include devDependencies: ${options.includeDev}`);
console.log(`🚨 Minimum severity reported: ${options.severity}`);
console.log(`🛠️  Explore remediation playbook: ${options.planFixes}`);
console.log(`📦 SBOM appendix: ${options.generateSbom}\n`);

// Change to project directory
const originalCwd = process.cwd();
if (options.projectPath !== originalCwd) {
  process.chdir(options.projectPath);
}

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  'Bash',
  'BashOutput',
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
  'TodoWrite',
];

// Note: Agent definitions would typically be passed via MCP config or other mechanism
// For now, we'll rely on the Task tool for sub-agent delegation

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "default",
};

try {
  const exitCode = await claude(prompt, defaultFlags);

  // Restore original working directory
  if (options.projectPath !== originalCwd) {
    process.chdir(originalCwd);
  }

  if (exitCode === 0) {
    console.log('\n✨ NPM package audit complete!\n');
    console.log('📄 Full report: npm-audit-report.md');
    console.log('\nNext steps:');
    console.log('1. Review the audit report');
    console.log('2. Prioritize remediation by severity');
    console.log('3. Test coverage before applying fixes');
    console.log('4. Consider CI/CD guardrails for critical issues');
  }
  process.exit(exitCode);
} catch (error) {
  // Restore original working directory on error
  if (options.projectPath !== originalCwd) {
    process.chdir(originalCwd);
  }
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
