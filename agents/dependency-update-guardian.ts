#!/usr/bin/env bun

/**
 * Dependency Update Guardian
 *
 * Keeps your dependencies secure and up-to-date without breaking things.
 * Analyzes package files, checks for updates, reads changelogs for breaking changes,
 * runs tests, and generates migration guides.
 *
 * Usage:
 *   bun run agents/dependency-update-guardian.ts [options]
 *
 * Options:
 *   --project-path <path>  Path to project directory (default: current directory)
 *   --auto-update          Automatically apply safe updates after testing
 *   --security-only        Only check for security updates
 *   --create-pr            Create a PR with the updates (requires gh cli)
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface UpdateGuardianOptions {
  projectPath?: string;
  autoUpdate?: boolean;
  securityOnly?: boolean;
  createPR?: boolean;
}

async function runDependencyUpdateGuardian(options: UpdateGuardianOptions = {}) {
  const {
    projectPath = process.cwd(),
    autoUpdate = false,
    securityOnly = false,
    createPR = false,
  } = options;

  const prompt = `You are the Dependency Update Guardian. Your mission is to keep dependencies secure and up-to-date without breaking things.

Project path: ${projectPath}

Task instructions:
1. Discover package files in the project (package.json, requirements.txt, Cargo.toml, go.mod, etc.)
2. Identify the primary package manager and ecosystem being used
3. Check for available dependency updates using appropriate package manager commands
4. For each available update:
   - Determine if it's a security update, feature update, or major version bump
   - Use WebFetch to read the changelog/release notes from npm, PyPI, crates.io, etc.
   - Identify any breaking changes mentioned in the changelog
   - Note deprecated APIs and migration steps
5. Generate a detailed report with:
   - List of all available updates categorized by type (security/feature/major)
   - Breaking changes and migration requirements for each
   - Risk assessment for each update (low/medium/high)
   - Recommendations for update order (security first, then safe updates, then major bumps)
   - Overall dependency freshness score
${securityOnly ? '6. ONLY include security updates in the report (filter out feature and major updates)' : ''}
${autoUpdate ? '7. Apply safe updates automatically (patch and minor versions with no breaking changes)' : ''}
${autoUpdate ? '8. Run the test suite after applying updates to verify nothing breaks' : ''}
${createPR ? '9. Create a pull request with the updates and migration guide using gh cli' : ''}

Important guidelines:
- Use Bash tool to run package manager commands (npm outdated, pip list --outdated, cargo outdated, go list -u -m all, etc.)
- Use WebFetch to read actual changelogs from package registries
- Be conservative: if a changelog mentions breaking changes, mark it as high risk
- Never auto-update major version bumps without explicit approval
- Provide clear migration guides with code examples for breaking changes
- Check for deprecated packages and suggest modern alternatives

Generate a comprehensive dependency update report and ${autoUpdate ? 'apply safe updates' : 'provide actionable recommendations'}.`;

  console.log('🛡️  Dependency Update Guardian starting...\n');
  console.log(`📂 Project: ${projectPath}`);
  console.log(`🔒 Security only: ${securityOnly}`);
  console.log(`🔄 Auto-update: ${autoUpdate}`);
  console.log(`📝 Create PR: ${createPR}\n`);

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
      permissionMode: 'acceptEdits',
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  let finalResult = '';

  for await (const message of result) {
    if (message.type === 'assistant') {
      // Print assistant messages as they come
      for (const content of message.message.content) {
        if (content.type === 'text') {
          console.log(content.text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        finalResult = message.result;
        console.log('\n✅ Dependency analysis complete!');
        console.log(`\n💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
        console.log(`🔄 Turns: ${message.num_turns}`);
      } else {
        console.error('\n❌ Error during execution:', message);
        process.exit(1);
      }
    }
  }

  return finalResult;
}

// CLI execution
if (import.meta.main) {
  const args = process.argv.slice(2);
  const options: UpdateGuardianOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--project-path':
        options.projectPath = args[++i];
        break;
      case '--auto-update':
        options.autoUpdate = true;
        break;
      case '--security-only':
        options.securityOnly = true;
        break;
      case '--create-pr':
        options.createPR = true;
        break;
      case '--help':
        console.log(`
Dependency Update Guardian

Keeps your dependencies secure and up-to-date without breaking things.

Usage:
  bun run agents/dependency-update-guardian.ts [options]

Options:
  --project-path <path>  Path to project directory (default: current directory)
  --auto-update          Automatically apply safe updates after testing
  --security-only        Only check for security updates
  --create-pr            Create a PR with the updates (requires gh cli)
  --help                 Show this help message

Examples:
  # Analyze current project
  bun run agents/dependency-update-guardian.ts

  # Check for security updates only
  bun run agents/dependency-update-guardian.ts --security-only

  # Auto-apply safe updates and create PR
  bun run agents/dependency-update-guardian.ts --auto-update --create-pr

  # Analyze a different project
  bun run agents/dependency-update-guardian.ts --project-path ../my-project
        `);
        process.exit(0);
    }
  }

  try {
    await runDependencyUpdateGuardian(options);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

export { runDependencyUpdateGuardian };