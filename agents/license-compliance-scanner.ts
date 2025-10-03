#!/usr/bin/env -S bun run

/**
 * License Compliance Scanner Agent
 *
 * A tiny quick task agent that prevents legal headaches before they start:
 * - Scans package.json, requirements.txt, go.mod, or other dependency manifests in under 30 seconds
 * - Identifies license types for all dependencies (MIT, Apache, GPL, AGPL, proprietary, etc.)
 * - Flags GPL/AGPL packages in proprietary codebases that could create compliance issues
 * - Detects packages with missing or unclear license information
 * - Identifies license compatibility conflicts in your dependency tree
 * - Generates a clean license summary report with recommendations
 * - Suggests alternative packages when license issues are found
 * - Perfect for startups, freelancers, and teams who need quick license compliance checks
 *
 * Usage:
 *   bun run agents/license-compliance-scanner.ts [path] [options]
 *
 * Examples:
 *   # Scan current directory
 *   bun run agents/license-compliance-scanner.ts
 *
 *   # Scan specific project
 *   bun run agents/license-compliance-scanner.ts /path/to/project
 *
 *   # Scan proprietary project with custom output
 *   bun run agents/license-compliance-scanner.ts --proprietary --output compliance-report.md
 */

import { resolve } from "node:path";
import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface LicenseScanOptions {
  projectPath: string;
  projectType: "proprietary" | "open-source";
  outputFile: string;
}

const DEFAULT_OUTPUT_FILE = "LICENSE-REPORT.md";

function printHelp(): void {
  console.log(`
⚖️  License Compliance Scanner

Usage:
  bun run agents/license-compliance-scanner.ts [path] [options]

Arguments:
  path                    Project directory to scan (default: current directory)

Options:
  --proprietary           Mark project as proprietary (flags GPL/AGPL as critical)
  --output <file>         Output file (default: ${DEFAULT_OUTPUT_FILE})
  --help, -h              Show this help

Examples:
  bun run agents/license-compliance-scanner.ts
  bun run agents/license-compliance-scanner.ts /path/to/project
  bun run agents/license-compliance-scanner.ts --proprietary --output report.md
  `);
}

function parseOptions(): LicenseScanOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const projectPath = positionals[0] ? resolve(positionals[0]) : process.cwd();
  const projectType = values.proprietary === true ? "proprietary" : "open-source";

  const rawOutput = values.output;
  const outputFile = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : DEFAULT_OUTPUT_FILE;

  return {
    projectPath,
    projectType,
    outputFile,
  };
}

const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log('⚖️  License Compliance Scanner');
console.log(`📁 Scanning project: ${options.projectPath}`);
console.log(`📋 Project type: ${options.projectType}`);
console.log(`📄 Output report: ${options.outputFile}`);
console.log();

  const systemPrompt = `You are a License Compliance Scanner agent that helps developers understand and manage open source license compliance.

Your task is to:
1. Identify dependency manifest files in the project:
   - JavaScript/TypeScript: package.json, package-lock.json, yarn.lock, pnpm-lock.yaml
   - Python: requirements.txt, Pipfile, Pipfile.lock, pyproject.toml, setup.py
   - Go: go.mod, go.sum
   - Rust: Cargo.toml, Cargo.lock
   - Ruby: Gemfile, Gemfile.lock
   - Java: pom.xml, build.gradle
   - PHP: composer.json, composer.lock
   - .NET: *.csproj, packages.config

2. Extract all dependencies and attempt to determine their licenses:
   - For npm packages: Check package.json, use npm view <package> license if needed
   - For Python packages: Check PKG-INFO or use pip show if possible
   - For Go modules: Check go.mod and module repositories
   - Look for LICENSE files in node_modules or similar directories if present
   - Use common knowledge about popular packages' licenses

3. Categorize licenses by risk level:
   - ✅ Permissive (Low Risk): MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, CC0, Unlicense
   - ⚠️  Weak Copyleft (Medium Risk): LGPL-2.1, LGPL-3.0, MPL-2.0, EPL-1.0
   - 🚨 Strong Copyleft (High Risk): GPL-2.0, GPL-3.0, AGPL-3.0
   - ❌ Proprietary/Unknown: Proprietary, unlicensed, UNLICENSED, missing license

4. Identify compliance issues:
   - GPL/AGPL dependencies in proprietary projects (major risk)
   - Dependencies with missing or unclear licenses
   - License compatibility conflicts (e.g., GPL + Apache in some cases)
   - Deprecated or risky license versions
   - Dual-licensed packages where license choice matters

5. Generate recommendations:
   - Suggest alternative packages with more permissive licenses
   - Explain the implications of each high-risk license
   - Provide actionable steps to resolve compliance issues
   - Link to additional resources for understanding licenses

Use Glob to find manifest files, Read to parse them, Bash for package manager commands if needed, and Write to generate the report.

IMPORTANT:
- Be accurate about license classifications
- Clearly explain WHY certain licenses are risky for proprietary projects
- Provide specific package alternatives when possible
- Make the report actionable with clear priorities`;

  const prompt = `Scan the project at: ${options.projectPath} for license compliance issues.

Project context:
- Project license type: ${options.projectType}
${options.projectType === 'proprietary' ? '- ⚠️  Extra caution needed for GPL/AGPL licenses' : '- License compatibility still matters for redistribution'}

Step-by-step process:

1. Find all dependency manifest files:
   - Use Glob to search for: package.json, requirements.txt, go.mod, Cargo.toml, Gemfile, composer.json, pom.xml, *.csproj
   - Identify which package managers are being used

2. For each manifest file found:
   - Read the file to extract dependency lists
   - Parse direct dependencies (ignore dev dependencies in initial scan)
   - Try to determine the license for each dependency by:
     * Reading package metadata if available
     * Using common knowledge about popular packages
     * Running package manager commands like 'npm view <pkg> license' (if safe)
     * Checking for local LICENSE files in dependencies (if node_modules exists)

3. Categorize all dependencies by license risk:
   ✅ **Permissive (Safe)**
   - MIT, Apache-2.0, BSD variants, ISC, etc.
   - Safe for all use cases

   ⚠️  **Weak Copyleft (Caution)**
   - LGPL, MPL, EPL
   - May require compliance steps

   🚨 **Strong Copyleft (HIGH RISK ${options.projectType === 'proprietary' ? 'FOR PROPRIETARY' : ''})**
   - GPL-2.0, GPL-3.0, AGPL-3.0
   ${options.projectType === 'proprietary' ? '- Generally incompatible with proprietary software' : '- Requires matching license or careful isolation'}

   ❌ **Unknown/Missing**
   - No license information found
   - Proprietary or unclear licensing

4. Identify specific compliance issues:
   - List any GPL/AGPL dependencies ${options.projectType === 'proprietary' ? '(CRITICAL for proprietary projects)' : ''}
   - List dependencies with missing licenses
   - Flag unusual or deprecated licenses
   - Note any license compatibility conflicts

5. Generate a comprehensive report saved as '${options.outputFile}':

   # License Compliance Report

   ## Executive Summary
   - Total dependencies scanned: X
   - ✅ Permissive licenses: X (XX%)
   - ⚠️  Weak copyleft: X (XX%)
   - 🚨 Strong copyleft: X (XX%)
   - ❌ Unknown/Missing: X (XX%)
   - Overall Risk Level: [LOW/MEDIUM/HIGH/CRITICAL]

   ## Critical Issues (Action Required)
   [List any GPL/AGPL packages or missing licenses with severity]

   ### Package: package-name@version
   - License: GPL-3.0
   - Risk Level: 🚨 CRITICAL
   - Issue: Strong copyleft license incompatible with proprietary software
   - Impact: May require open-sourcing your entire codebase or removing dependency
   - Alternatives:
     * \`alternative-package\` (MIT) - Similar functionality
     * Consider reimplementing the feature
   - Resources: [Link to GPL compliance guide]

   ## Dependencies by License Category

   ### ✅ Permissive Licenses (Safe)
   - package-name@version (MIT)
   - another-package@version (Apache-2.0)
   [... list all ...]

   ### ⚠️  Weak Copyleft Licenses
   [If any, list with brief compliance notes]

   ### 🚨 Strong Copyleft Licenses
   [List all GPL/AGPL packages with warnings]

   ### ❌ Unknown or Missing Licenses
   [List packages where license couldn't be determined]

   ## Recommendations
   1. [Prioritized action items]
   2. [Specific next steps]
   3. [Long-term compliance strategy]

   ## License Distribution
   [Summary statistics and pie chart representation if helpful]

   ## Additional Resources
   - [Links to license explanations]
   - [Tools for ongoing compliance monitoring]

6. After generating the report, provide a summary highlighting:
   - Number of critical issues found
   - Quick action items
   - Whether the project passes basic compliance checks

IMPORTANT:
- Focus on accuracy over speed
- Be conservative in risk assessment (err on side of caution)
- Provide actionable alternatives for problematic dependencies
- Make the report useful for both technical and legal reviewers`;



// Change working directory if needed
if (options.projectPath !== process.cwd()) {
  process.chdir(options.projectPath);
}

const settings: Settings = {};

const allowedTools = [
  "Glob",
  "Read",
  "Bash",
  "Write",
  "TodoWrite",
];

removeAgentFlags([
    "proprietary", "output", "help", "h"
  ]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
  "append-system-prompt": systemPrompt,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✅ License compliance scan complete!\n");
    console.log(`📄 Report saved to: ${options.outputFile}`);
    console.log("\n💡 Tips:");
    console.log("   - Review any 🚨 critical issues immediately");
    console.log("   - Consider running this scan in your CI/CD pipeline");
    console.log("   - Run with --proprietary flag if your project is closed-source");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Error running license compliance scanner:", error);
  process.exit(1);
}
