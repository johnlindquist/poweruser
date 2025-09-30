#!/usr/bin/env bun

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
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const PROJECT_PATH = process.argv[2] || process.cwd();
const PROJECT_LICENSE = process.argv.includes('--proprietary') ? 'proprietary' : 'open-source';
const OUTPUT_FILE = process.argv.includes('--output')
  ? process.argv[process.argv.indexOf('--output') + 1] || 'LICENSE-REPORT.md'
  : 'LICENSE-REPORT.md';

async function main() {
  console.log('⚖️  License Compliance Scanner');
  console.log(`📁 Scanning project: ${PROJECT_PATH}`);
  console.log(`📋 Project type: ${PROJECT_LICENSE}`);
  console.log(`📄 Output report: ${OUTPUT_FILE}`);
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

  const prompt = `Scan the project at: ${PROJECT_PATH} for license compliance issues.

Project context:
- Project license type: ${PROJECT_LICENSE}
${PROJECT_LICENSE === 'proprietary' ? '- ⚠️  Extra caution needed for GPL/AGPL licenses' : '- License compatibility still matters for redistribution'}

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

   🚨 **Strong Copyleft (HIGH RISK ${PROJECT_LICENSE === 'proprietary' ? 'FOR PROPRIETARY' : ''})**
   - GPL-2.0, GPL-3.0, AGPL-3.0
   ${PROJECT_LICENSE === 'proprietary' ? '- Generally incompatible with proprietary software' : '- Requires matching license or careful isolation'}

   ❌ **Unknown/Missing**
   - No license information found
   - Proprietary or unclear licensing

4. Identify specific compliance issues:
   - List any GPL/AGPL dependencies ${PROJECT_LICENSE === 'proprietary' ? '(CRITICAL for proprietary projects)' : ''}
   - List dependencies with missing licenses
   - Flag unusual or deprecated licenses
   - Note any license compatibility conflicts

5. Generate a comprehensive report saved as '${OUTPUT_FILE}':

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

  try {
    const result = query({
      prompt,
      options: {
        cwd: PROJECT_PATH,
        systemPrompt,
        allowedTools: [
          'Glob',
          'Read',
          'Bash',
          'Write'
        ],
        permissionMode: 'bypassPermissions',
        model: 'sonnet',
      }
    });

    for await (const message of result) {
      if (message.type === 'assistant') {
        // Show assistant thinking/working
        for (const block of message.message.content) {
          if (block.type === 'text') {
            console.log(block.text);
          }
        }
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          console.log('\n✅ License compliance scan complete!');
          console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
          console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`📊 Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);

          if (message.result) {
            console.log('\n' + message.result);
          }

          console.log(`\n📄 Report saved to: ${OUTPUT_FILE}`);
          console.log('\n💡 Tips:');
          console.log('   - Review any 🚨 critical issues immediately');
          console.log('   - Consider running this scan in your CI/CD pipeline');
          console.log('   - Run with --proprietary flag if your project is closed-source');
        } else {
          console.error('\n❌ License scan failed:', message.subtype);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error running license compliance scanner:', error);
    process.exit(1);
  }
}

main();
