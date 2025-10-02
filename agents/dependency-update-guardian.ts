#!/usr/bin/env -S bun run

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

import { resolve } from "node:path";
import { claude, getPositionals, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

export interface UpdateGuardianOptions {
  projectPath?: string;
  autoUpdate?: boolean;
  securityOnly?: boolean;
  createPR?: boolean;
}

export interface ResolvedGuardianOptions {
  projectPath: string;
  autoUpdate: boolean;
  securityOnly: boolean;
  createPR: boolean;
}

function printHelp(): void {
  console.log(`
🛡️  Dependency Update Guardian

Keeps your dependencies secure and up-to-date without breaking things.

Usage:
  bun run agents/dependency-update-guardian.ts [options]

Options:
  --project-path <path>  Path to project directory (default: current directory)
  --auto-update          Automatically apply safe updates after testing
  --security-only        Only check for security updates
  --create-pr            Create a PR with the updates (requires gh cli)
  --help, -h             Show this help message

Examples:
  bun run agents/dependency-update-guardian.ts
  bun run agents/dependency-update-guardian.ts --security-only
  bun run agents/dependency-update-guardian.ts --auto-update --create-pr
`);
}

const argv = process.argv.slice(2);
const positionals = getPositionals();
const values = parsedArgs.values as Record<string, unknown>;

function readBooleanFlag(name: string): boolean {
  return values[name] === true || argv.includes(`--${name}`);
}

function readStringFlag(name: string): string | undefined {
  const raw = values[name];
  if (typeof raw === "string" && raw.length > 0) {
    return raw;
  }

  const index = argv.indexOf(`--${name}`);
  if (index !== -1 && argv[index + 1] && !argv[index + 1]!.startsWith("--")) {
    return argv[index + 1]!;
  }

  const equalsForm = argv.find((arg) => arg.startsWith(`--${name}=`));
  if (equalsForm) {
    const [, value] = equalsForm.split("=", 2);
    if (value && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function parseCliOptions(): ResolvedGuardianOptions | null {
  const help = values.help === true || values.h === true;
  if (help) {
    printHelp();
    return null;
  }

  const projectPath = resolve(readStringFlag("project-path") ?? positionals[0] ?? process.cwd());
  const autoUpdate = readBooleanFlag("auto-update");
  const securityOnly = readBooleanFlag("security-only");
  const createPR = readBooleanFlag("create-pr");

  return {
    projectPath,
    autoUpdate,
    securityOnly,
    createPR,
  };
}

function buildPrompt(options: ResolvedGuardianOptions): string {
  const { projectPath, securityOnly, autoUpdate, createPR } = options;

  return `You are the Dependency Update Guardian. Your mission is to keep dependencies secure and up-to-date without breaking things.

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
}

export async function runDependencyUpdateGuardian(options: ResolvedGuardianOptions): Promise<number> {
  console.log('🛡️  Dependency Update Guardian starting...\n');
  console.log(`📂 Project: ${options.projectPath}`);
  console.log(`🔒 Security only: ${options.securityOnly}`);
  console.log(`🔄 Auto-update: ${options.autoUpdate}`);
  console.log(`📝 Create PR: ${options.createPR}\n`);

  const prompt = buildPrompt(options);
  const claudeSettings: Settings = {};

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
  ];

  const defaultFlags: ClaudeFlags = {
    model: 'claude-sonnet-4-5-20250929',
    settings: JSON.stringify(claudeSettings),
    allowedTools: allowedTools.join(' '),
    'permission-mode': options.autoUpdate ? 'acceptEdits' : 'default',
  };

  const previousCwd = process.cwd();
  if (options.projectPath !== previousCwd) {
    process.chdir(options.projectPath);
  }

  try {
    const exitCode = await claude(prompt, defaultFlags);
    if (exitCode === 0) {
      console.log('\n✅ Dependency analysis complete!');
    }
    return exitCode;
  } catch (error) {
    console.error('❌ Fatal error:', error);
    return 1;
  } finally {
    if (options.projectPath !== previousCwd) {
      process.chdir(previousCwd);
    }
  }
}

const cliOptions = parseCliOptions();
if (cliOptions) {
  runDependencyUpdateGuardian(cliOptions)
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}
