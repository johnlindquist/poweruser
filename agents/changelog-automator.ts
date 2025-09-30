#!/usr/bin/env bun

/**
 * Changelog Automator Agent
 *
 * Generates beautiful, user-friendly changelogs automatically from git history.
 * Analyzes commits, categorizes changes, detects breaking changes, and formats
 * output in professional changelog formats.
 *
 * Features:
 * - Analyzes git commits and PR descriptions since last release tag
 * - Categorizes into Breaking Changes, Features, Fixes, Documentation, Internal
 * - Detects breaking changes from diffs and conventional commits
 * - Generates migration guides for breaking API changes
 * - Links to relevant PRs and issues
 * - Suggests semantic version bumps
 * - Filters noise (merge commits, dependency updates)
 *
 * Usage: bun run agents/changelog-automator.ts [options]
 * Options:
 *   --from <tag>    Start from specific tag (default: latest tag)
 *   --to <ref>      End at specific ref (default: HEAD)
 *   --format <fmt>  Output format: markdown, json, keep-a-changelog (default: keep-a-changelog)
 *   --output <file> Output file (default: CHANGELOG-new.md)
 *   --update        Update existing CHANGELOG.md instead of creating new file
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { resolve } from 'path';

interface ChangelogOptions {
  from?: string;
  to: string;
  format: 'markdown' | 'json' | 'keep-a-changelog';
  output: string;
  update: boolean;
}

function parseArgs(): ChangelogOptions {
  const args = process.argv.slice(2);
  const options: ChangelogOptions = {
    to: 'HEAD',
    format: 'keep-a-changelog',
    output: 'CHANGELOG-new.md',
    update: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--from':
        i++;
        if (i >= args.length || !args[i]) {
          console.error('--from requires a value');
          process.exit(1);
        }
        options.from = args[i]!;
        break;
      case '--to':
        i++;
        if (i >= args.length || !args[i]) {
          console.error('--to requires a value');
          process.exit(1);
        }
        options.to = args[i]!;
        break;
      case '--format':
        i++;
        if (i >= args.length || !args[i]) {
          console.error('--format requires a value');
          process.exit(1);
        }
        options.format = args[i]! as ChangelogOptions['format'];
        break;
      case '--output':
        i++;
        if (i >= args.length || !args[i]) {
          console.error('--output requires a value');
          process.exit(1);
        }
        options.output = args[i]!;
        break;
      case '--update':
        options.update = true;
        options.output = 'CHANGELOG.md';
        break;
      default:
        if (arg?.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const projectPath = process.cwd();

  console.log(`\n📋 Generating changelog for: ${projectPath}\n`);
  console.log(`Options:`);
  console.log(`  From: ${options.from || 'latest tag'}`);
  console.log(`  To: ${options.to}`);
  console.log(`  Format: ${options.format}`);
  console.log(`  Output: ${options.output}`);
  console.log(`  Update mode: ${options.update}\n`);

  const prompt = `Generate a professional, user-friendly changelog for this Git repository.

**Your Task:**

1. **Discover Version History**
   ${
     options.from
       ? `- Use "${options.from}" as the starting point`
       : `- Run "git describe --tags --abbrev=0" to find the latest release tag
   - If no tags exist, analyze all commits from the beginning`
   }
   - End at "${options.to}"
   - Run "git log" with appropriate options to get all commits in this range

2. **Analyze Commits**
   For each commit:
   - Extract commit message, author, date, and SHA
   - Identify conventional commit type (feat:, fix:, docs:, refactor:, test:, chore:, etc.)
   - Look for breaking change indicators:
     * "BREAKING CHANGE:" in commit body
     * "!" after type (e.g., "feat!:")
     * Major version bumps in dependencies
   - Extract PR/issue references (#123, GH-456, etc.)
   - Filter out noise:
     * Merge commits
     * Dependency update commits (unless breaking)
     * Version bump commits
     * CI/build-only changes

3. **Categorize Changes**
   Group commits into these categories:

   **🚨 Breaking Changes**
   - Any commit marked with BREAKING CHANGE
   - API removals or signature changes
   - Major version bumps
   - Include migration instructions

   **✨ Features**
   - New functionality (feat: commits)
   - New APIs or capabilities
   - User-facing improvements

   **🐛 Bug Fixes**
   - Bug fixes (fix: commits)
   - Regression fixes
   - Performance improvements

   **📚 Documentation**
   - README updates
   - API documentation changes
   - Comment improvements
   - Example updates

   **🔧 Internal**
   - Refactoring
   - Test improvements
   - Build system changes
   - CI/CD updates
   - Developer experience improvements

4. **Generate Migration Guide**
   For breaking changes:
   - Explain what changed and why
   - Show before/after code examples if possible
   - Provide step-by-step migration instructions
   - Estimate effort (low/medium/high)

5. **Suggest Version Bump**
   Based on changes found:
   - MAJOR: Breaking changes present
   - MINOR: New features added (no breaking changes)
   - PATCH: Only bug fixes and docs
   Follow semver (semantic versioning) rules

6. **Format Output**
   ${
     options.format === 'keep-a-changelog'
       ? `Use Keep a Changelog format (https://keepachangelog.com/):

   # Changelog

   All notable changes to this project will be documented in this file.

   The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
   and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

   ## [Unreleased]

   ### Breaking Changes
   - Description (#123)

   ### Added
   - New feature (#124)

   ### Changed
   - Modified behavior (#125)

   ### Fixed
   - Bug fix (#126)

   ### Removed
   - Deprecated API (#127)`
       : options.format === 'json'
         ? `Output as JSON with this structure:
   {
     "version": "suggested-version",
     "date": "YYYY-MM-DD",
     "categories": {
       "breaking": [...],
       "features": [...],
       "fixes": [...],
       "docs": [...],
       "internal": [...]
     },
     "migration_guide": "...",
     "contributors": [...]
   }`
         : `Use simple markdown format with sections for each category`
   }

7. **Output**
   ${
     options.update
       ? `- Read existing CHANGELOG.md
   - Prepend new changelog entry at the top (under "Unreleased" section)
   - Preserve all existing changelog history
   - Use Edit tool to update the file`
       : `- Write the changelog to ${options.output}
   - Create a new file with the generated content`
   }

**Additional Context:**
- Be concise but informative - users should understand what changed and why it matters
- Group related commits together (e.g., multiple fixes for the same component)
- Include contributor attributions where appropriate
- Add links to PRs and issues using repository URL pattern
- Use clear, user-friendly language (avoid jargon)
- Focus on what changed from a user's perspective, not implementation details

Start by analyzing the git history and generating the changelog!`;

  const response = query({
    prompt,
    options: {
      cwd: projectPath,
      permissionMode: 'bypassPermissions',
      allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Grep'],
      model: 'sonnet',
    },
  });

  for await (const message of response) {
    if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('\n✅ Changelog generation complete!\n');
        console.log(message.result);
        console.log('\n');
      } else {
        console.error('\n❌ Error during generation:');
        console.error(message);
        process.exit(1);
      }
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
