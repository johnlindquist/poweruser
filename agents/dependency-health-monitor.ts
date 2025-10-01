#!/usr/bin/env bun

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
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface DependencyHealthOptions {
  targetPath: string;
  checkVulnerabilities?: boolean;
  checkOutdated?: boolean;
  checkLicenses?: boolean;
  autoFixSafe?: boolean;
  createPR?: boolean;
  severityThreshold?: 'low' | 'moderate' | 'high' | 'critical';
}

async function monitorDependencyHealth(options: DependencyHealthOptions) {
  const {
    targetPath,
    checkVulnerabilities = true,
    checkOutdated = true,
    checkLicenses = false,
    autoFixSafe = false,
    createPR = false,
    severityThreshold = 'moderate',
  } = options;

  console.log('🔍 Starting Dependency Health Monitor...\n');
  console.log(`Target: ${targetPath}`);
  console.log(`Check Vulnerabilities: ${checkVulnerabilities}`);
  console.log(`Check Outdated: ${checkOutdated}`);
  console.log(`Check Licenses: ${checkLicenses}`);
  console.log(`Severity Threshold: ${severityThreshold}\n`);

  const prompt = `
You are a dependency security and maintenance expert. Analyze the dependencies at "${targetPath}" and generate a comprehensive health report.

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

  const result = query({
    prompt,
    options: {
      cwd: targetPath,
      // Define specialized subagents
      agents: {
        'vulnerability-scanner': {
          description: 'Scans for security vulnerabilities in dependencies',
          tools: ['Read', 'Bash', 'Grep', 'Glob', 'WebFetch'],
          prompt: `You are a security specialist. Analyze dependencies for vulnerabilities using security databases and audit tools.`,
          model: 'sonnet',
        },
        'version-analyzer': {
          description: 'Analyzes package versions and identifies outdated dependencies',
          tools: ['Read', 'Bash', 'Grep', 'Glob'],
          prompt: `You analyze package versions and identify update opportunities. Check changelogs for breaking changes.`,
          model: 'haiku',
        },
        'license-checker': {
          description: 'Checks license compliance across all dependencies',
          tools: ['Read', 'Bash', 'Grep', 'WebFetch'],
          prompt: `You analyze software licenses for compliance issues and conflicts.`,
          model: 'haiku',
        },
        'upgrade-planner': {
          description: 'Creates prioritized upgrade plans with risk assessment',
          tools: ['Read', 'Write', 'Bash', 'WebFetch'],
          prompt: `You create detailed upgrade plans that balance security, stability, and effort.`,
          model: 'sonnet',
        },
      },
      // Allow necessary tools
      allowedTools: [
        'Read',
        'Write',
        'Bash',
        'Glob',
        'Grep',
        'WebFetch',
        'Task',
        'TodoWrite',
      ],
      // Permission mode based on auto-fix setting
      permissionMode: autoFixSafe ? 'acceptEdits' : 'default',
      // Add hooks to track progress
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse' && input.tool_name === 'Bash') {
                  const command = (input.tool_input as any).command;
                  if (command?.includes('audit') || command?.includes('outdated')) {
                    console.log(`🔍 Running security scan...`);
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
              async (input) => {
                if (input.hook_event_name === 'PostToolUse' && input.tool_name === 'Bash') {
                  const command = (input.tool_input as any).command;
                  const output = (input.tool_response as any).output || '';

                  if (command?.includes('audit')) {
                    const vulnCount = (output.match(/vulnerabilities/gi) || []).length;
                    if (vulnCount > 0) {
                      console.log(`⚠️  Found vulnerabilities in dependencies`);
                    } else {
                      console.log(`✅ No vulnerabilities detected`);
                    }
                  }

                  if (command?.includes('outdated')) {
                    console.log(`📊 Outdated packages analyzed`);
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
                console.log('\n🎉 Dependency health check complete!');
                console.log('\nNext steps:');
                console.log('1. Review the generated report');
                console.log('2. Prioritize critical security updates');
                console.log('3. Run suggested update commands');
                console.log('4. Test thoroughly after updates');
                return { continue: true };
              },
            ],
          },
        ],
      },
      // Configure max turns
      maxTurns: 30,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  // Stream results
  let reportGenerated = false;

  for await (const message of result) {
    if (message.type === 'assistant') {
      const textContent = message.message.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        // Show assistant messages but filter out tool use details
        const text = textContent.text;
        if (!text.includes('tool_use') && text.length > 10) {
          console.log('\n💭', text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('\n' + '='.repeat(60));
        console.log('📊 Dependency Health Report Complete');
        console.log('='.repeat(60));
        console.log(`Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`API calls: ${(message.duration_api_ms / 1000).toFixed(2)}s`);
        console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`Turns: ${message.num_turns}`);
        console.log(
          `Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`
        );

        if (message.usage.cache_read_input_tokens) {
          console.log(`Cache hits: ${message.usage.cache_read_input_tokens} tokens`);
        }

        reportGenerated = true;
      } else {
        console.error('\n❌ Error during dependency analysis:', message.subtype);
      }
    }
  }

  if (!reportGenerated) {
    console.log('\n⚠️  No report was generated. Check the output above for errors.');
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
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
  # Basic health check
  bun run agents/dependency-health-monitor.ts

  # Check specific project with license compliance
  bun run agents/dependency-health-monitor.ts ./my-project --licenses

  # Auto-fix safe updates and create PR
  bun run agents/dependency-health-monitor.ts --auto-fix --create-pr

  # Only show critical vulnerabilities
  bun run agents/dependency-health-monitor.ts --severity critical
  `);
  process.exit(0);
}

// Parse target path (default to current directory)
const targetPath = args.find((arg) => !arg.startsWith('--')) || process.cwd();

// Parse CLI options
const options: DependencyHealthOptions = {
  targetPath,
  checkVulnerabilities: !args.includes('--no-vulnerabilities'),
  checkOutdated: !args.includes('--no-outdated'),
  checkLicenses: args.includes('--licenses'),
  autoFixSafe: args.includes('--auto-fix'),
  createPR: args.includes('--create-pr'),
  severityThreshold: 'moderate',
};

// Parse severity threshold
const severityIndex = args.indexOf('--severity');
if (severityIndex !== -1) {
  const level = args[severityIndex + 1];
  if (level && ['low', 'moderate', 'high', 'critical'].includes(level)) {
    options.severityThreshold = level as any;
  }
}

// Run the dependency health monitor
monitorDependencyHealth(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});