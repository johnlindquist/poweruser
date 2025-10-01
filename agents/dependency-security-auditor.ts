#!/usr/bin/env bun

/**
 * Dependency Security Auditor Agent
 *
 * A practical everyday agent that keeps your dependencies secure and up-to-date intelligently:
 * - Scans package.json, requirements.txt, go.mod, Cargo.toml for all dependencies
 * - Checks for known CVEs and security vulnerabilities with severity ratings
 * - Identifies outdated packages and suggests safe upgrade paths
 * - Detects license conflicts that could cause legal issues
 * - Analyzes your actual usage patterns to prioritize critical vs unused dependencies
 * - Generates upgrade plans that minimize breaking changes
 * - Creates pull requests with dependency updates and automated tests
 * - Distinguishes between security patches (urgent) and feature updates (optional)
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const PROJECT_PATH = process.argv[2] || process.cwd();

async function main() {
  console.log('🔒 Dependency Security Auditor');
  console.log(`📁 Analyzing project: ${PROJECT_PATH}\n`);

  const systemPrompt = `You are a Dependency Security Auditor agent that helps developers keep their dependencies secure and up-to-date.

Your task is to:
1. Find and analyze all dependency files in the project (package.json, requirements.txt, go.mod, Cargo.toml, etc.)
2. For each dependency file found:
   - List all dependencies with their current versions
   - Search for known CVEs and security vulnerabilities
   - Check for outdated packages and available updates
   - Identify license issues or conflicts
   - Analyze actual code usage to prioritize critical dependencies
3. Generate a comprehensive security report with:
   - Critical vulnerabilities that need immediate attention (HIGH/CRITICAL severity)
   - Moderate vulnerabilities to address soon (MEDIUM severity)
   - Outdated packages with recommended upgrade paths
   - License conflicts or concerns
   - Unused or rarely-used dependencies that could be removed
   - Safe upgrade plan prioritized by risk
4. For each finding, provide:
   - Severity rating
   - CVE ID if applicable
   - Current version vs fixed/recommended version
   - Breaking change assessment
   - Suggested action (upgrade, patch, remove, investigate)

Use Glob to find dependency files, Read to parse them, WebSearch to check for vulnerabilities, and Write to save the security report.

IMPORTANT: Focus on actionable findings. Distinguish between:
- Security patches (urgent) - vulnerabilities with known exploits
- Feature updates (optional) - new versions without security concerns
- Breaking changes - major version upgrades requiring code changes

Keep the report concise but comprehensive. Format it as markdown with clear sections and severity badges.`;

  const prompt = `Analyze all dependencies in the project at: ${PROJECT_PATH}

1. Find all dependency manifest files (package.json, package-lock.json, requirements.txt, Pipfile, go.mod, go.sum, Cargo.toml, Cargo.lock, etc.)
2. Parse each file and extract dependencies with versions
3. For each dependency, search for:
   - Known CVEs and security advisories
   - Available updates and their severity
   - License information
   - Usage patterns in the codebase
4. Generate a security audit report with:
   - Executive summary with key findings
   - Critical vulnerabilities requiring immediate action
   - Recommended upgrades with risk assessment
   - Unused dependencies that can be removed
   - Safe upgrade strategy prioritized by impact

Save the report as 'dependency-security-audit.md' in the project root.`;

  try {
    const result = query({
      prompt,
      options: {
        cwd: PROJECT_PATH,
        systemPrompt,
        allowedTools: [
          'Glob',
          'Read',
          'WebSearch',
          'Grep',
          'Write',
          'Bash'
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
          console.log('\n✅ Audit complete!');
          console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
          console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`📊 Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);

          if (message.result) {
            console.log('\n' + message.result);
          }
        } else {
          console.error('\n❌ Audit failed:', message.subtype);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error running audit:', error);
    process.exit(1);
  }
}

main();
