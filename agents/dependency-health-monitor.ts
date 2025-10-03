#!/usr/bin/env -S bun run

/**
 * Dependency Health Monitor Agent
 *
 * This agent keeps your dependencies secure, up-to-date, and compliant:
 * - Scans all dependency files (package.json, requirements.txt, go.mod, Cargo.toml, etc.)
 * - Checks for known security vulnerabilities using CVE databases
 * - Identifies outdated packages and shows version gaps
 * - Analyzes license compliance issues
 * - Generates prioritized upgrade plan with risk assessment
 * - Estimates breaking change impact by analyzing changelogs
 * - Can automatically create PRs for safe updates
 *
 * Usage:
 *   bun run agents/dependency-health-monitor.ts [path] [options]
 *
 * Examples:
 *   # Basic health check
 *   bun run agents/dependency-health-monitor.ts
 *
 *   # Check specific project with license compliance
 *   bun run agents/dependency-health-monitor.ts ./my-project --licenses
 *
 *   # Auto-fix safe updates
 *   bun run agents/dependency-health-monitor.ts --auto-fix
 */

import { resolve } from "node:path";
import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type SeverityLevel = 'low' | 'moderate' | 'high' | 'critical';

interface DependencyHealthOptions {
  targetPath: string;
  checkVulnerabilities: boolean;
  checkOutdated: boolean;
  checkLicenses: boolean;
  autoFixSafe: boolean;
  createPR: boolean;
  severityThreshold: SeverityLevel;
}

function printHelp(): void {
  console.log(`
🔍 Dependency Health Monitor

Usage:
  bun run agents/dependency-health-monitor.ts [path] [options]

Arguments:
  path                    Path to project directory (default: current directory)

Options:
  --no-vulnerabilities    Skip vulnerability scanning
  --no-outdated          Skip outdated package check
  --licenses             Include license compliance check
  --auto-fix             Automatically fix safe updates (patch/minor versions)
  --create-pr            Create a pull request with updates
  --severity <level>     Minimum severity to report (low|moderate|high|critical, default: moderate)
  --help, -h             Show this help message

Examples:
  bun run agents/dependency-health-monitor.ts
  bun run agents/dependency-health-monitor.ts ./my-project --licenses
  bun run agents/dependency-health-monitor.ts --auto-fix --create-pr
  bun run agents/dependency-health-monitor.ts --severity critical
  `);
}

function parseOptions(): DependencyHealthOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const targetPath = positionals[0] ? resolve(positionals[0]) : process.cwd();
  const checkVulnerabilities = values["no-vulnerabilities"] !== true;
  const checkOutdated = values["no-outdated"] !== true;
  const checkLicenses = values.licenses === true;
  const autoFixSafe = values["auto-fix"] === true || values.autoFix === true;
  const createPR = values["create-pr"] === true || values.createPR === true;

  const rawSeverity = values.severity;
  const severityThreshold: SeverityLevel =
    typeof rawSeverity === "string" &&
    ["low", "moderate", "high", "critical"].includes(rawSeverity)
      ? (rawSeverity as SeverityLevel)
      : "moderate";

  return {
    targetPath,
    checkVulnerabilities,
    checkOutdated,
    checkLicenses,
    autoFixSafe,
    createPR,
    severityThreshold,
  };
}

function buildPrompt(options: DependencyHealthOptions): string {
  const {
    checkVulnerabilities,
    checkOutdated,
    checkLicenses,
    autoFixSafe,
    createPR,
    severityThreshold,
  } = options;

  return `
You are a dependency security and maintenance expert. Analyze the dependencies and generate a comprehensive health report.

Your tasks:
1. **Identify Dependency Files**: Find all dependency manifests:
   - JavaScript/TypeScript: package.json, package-lock.json, yarn.lock, pnpm-lock.yaml, bun.lockb
   - Python: requirements.txt, Pipfile, pyproject.toml, poetry.lock
   - Go: go.mod, go.sum
   - Rust: Cargo.toml, Cargo.lock
   - Ruby: Gemfile, Gemfile.lock
   - Java: pom.xml, build.gradle

2. **Security Vulnerability Check** (${checkVulnerabilities ? 'ENABLED' : 'DISABLED'}):
   ${checkVulnerabilities ? `
   - Run npm audit, pip-audit, or equivalent security scanners
   - Check for known CVEs in dependencies
   - Identify vulnerable versions
   - Assess severity levels (critical, high, moderate, low)
   - Only report vulnerabilities at or above: ${severityThreshold}
   - Provide CVE links and descriptions
   ` : ''}

3. **Outdated Package Check** (${checkOutdated ? 'ENABLED' : 'DISABLED'}):
   ${checkOutdated ? `
   - Identify packages with newer versions available
   - Show current version vs latest version
   - Differentiate between patch, minor, and major updates
   - Check for breaking changes in changelogs
   - Estimate upgrade complexity
   ` : ''}

4. **License Compliance Check** (${checkLicenses ? 'ENABLED' : 'DISABLED'}):
   ${checkLicenses ? `
   - List all dependency licenses
   - Flag incompatible or problematic licenses (GPL, AGPL, etc.)
   - Identify missing license information
   - Check for license conflicts
   ` : ''}

5. **Generate Prioritized Upgrade Plan**:
   - Rank issues by severity and impact
   - Group safe updates (patch versions) vs risky updates (major versions)
   - Estimate time/effort for each upgrade
   - Suggest update order to minimize conflicts
   - Provide specific npm/pip/cargo commands to run

6. **Risk Assessment**:
   - Analyze breaking changes from changelogs
   - Identify dependencies with many dependents (risky to update)
   - Suggest testing strategies for each update
   - Flag deprecated packages that need replacement

${autoFixSafe ? `
7. **Auto-fix Safe Updates**:
   - Automatically update patch-level and minor-level dependencies
   - Update lock files
   - Run tests to verify nothing broke
   - Create a summary of changes made
` : ''}

${createPR ? `
8. **Create Pull Request**:
   - Commit the dependency updates
   - Generate a detailed PR description with:
     * List of updated packages
     * Security fixes included
     * Breaking changes to watch for
     * Testing checklist
   - Push to a new branch and create PR
` : ''}

Generate a comprehensive report with:
- Executive summary of findings
- Detailed breakdown of each issue
- Clear action items with commands to run
- Estimated time to remediate
- Links to relevant CVE/changelog resources

Format the report in markdown for easy reading.
`.trim();
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🔍 Dependency Health Monitor\n");
console.log(`Target: ${options.targetPath}`);
console.log(`Check Vulnerabilities: ${options.checkVulnerabilities}`);
console.log(`Check Outdated: ${options.checkOutdated}`);
console.log(`Check Licenses: ${options.checkLicenses}`);
console.log(`Auto-fix: ${options.autoFixSafe ? "Enabled" : "Disabled"}`);
console.log(`Create PR: ${options.createPR ? "Yes" : "No"}`);
console.log(`Severity Threshold: ${options.severityThreshold}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Read",
  "Write",
  "Bash",
  "Glob",
  "Grep",
  "WebFetch",
  "Task",
  "TodoWrite",
];

removeAgentFlags([
    "no-vulnerabilities",
    "no-outdated",
    "licenses",
    "auto-fix",
    "autoFix",
    "create-pr",
    "createPR",
    "severity",
    "help",
    "h",
  ]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": options.autoFixSafe ? "acceptEdits" : "default",
};

// Change working directory to target path
const originalCwd = process.cwd();
process.chdir(options.targetPath);

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n🎉 Dependency health check complete!\n");
    console.log("Next steps:");
    console.log("1. Review the generated report");
    console.log("2. Prioritize critical security updates");
    console.log("3. Run suggested update commands");
    console.log("4. Test thoroughly after updates");
  }
  process.chdir(originalCwd);
  process.exit(exitCode);
} catch (error) {
  process.chdir(originalCwd);
  console.error("❌ Fatal error:", error);
  process.exit(1);
}