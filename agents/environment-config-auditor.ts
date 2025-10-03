#!/usr/bin/env -S bun run

/**
 * Environment Config Auditor Agent
 */

import { resolve } from 'node:path';
import { claude, getPositionals, parsedArgs, readStringFlag, readBooleanFlag } from './lib';
import type { ClaudeFlags, Settings } from './lib';

type AuditorOptions = {
  envPath: string;
  examplePath: string;
  checkGitHistory: boolean;
  checkDangerousDefaults: boolean;
  generateMigrationGuide: boolean;
  generateSecureTemplate: boolean;
  productionMode: boolean;
  projectPath: string;
};

const DEFAULT_ENV = '.env';
const DEFAULT_EXAMPLE = '.env.example';
const MIGRATION_GUIDE = 'MIGRATION.md';
const TEMPLATE_FILE = '.env.template';

function printHelp(): void {
  console.log(`
🔒 Environment Config Auditor

Usage:
  bun run agents/environment-config-auditor.ts [project-path] [options]

Options:
  --env <path>               Path to .env file (default: ${DEFAULT_ENV})
  --example <path>           Path to .env.example file (default: ${DEFAULT_EXAMPLE})
  --no-git-history           Skip git history secret scan
  --no-dangerous-defaults    Skip dangerous defaults detection
  --generate-migration       Produce ${MIGRATION_GUIDE}
  --generate-template        Produce secure ${TEMPLATE_FILE}
  --production               Audit using production-mode strictness
  --help, -h                 Show this help message
`);
}

const positionals = getPositionals();
const values = parsedArgs.values as Record<string, unknown>;

const help = values.help === true || values.h === true;
if (help) {
  printHelp();
  process.exit(0);
}

function parseOptions(): AuditorOptions {
  const projectRaw = positionals[0] ? resolve(positionals[0]!) : process.cwd();
  const envPath = resolve(projectRaw, readStringFlag('env') ?? DEFAULT_ENV);
  const examplePath = resolve(projectRaw, readStringFlag('example') ?? DEFAULT_EXAMPLE);

  return {
    projectPath: projectRaw,
    envPath,
    examplePath,
    checkGitHistory: !readBooleanFlag('no-git-history', false),
    checkDangerousDefaults: !readBooleanFlag('no-dangerous-defaults', false),
    generateMigrationGuide: readBooleanFlag('generate-migration', false),
    generateSecureTemplate: readBooleanFlag('generate-template', false),
    productionMode: readBooleanFlag('production', false),
  };
}

const options = parseOptions();

console.log('🔒 Environment Config Auditor\n');
console.log(`Example file: ${options.examplePath}`);
console.log(`Environment file: ${options.envPath}`);
console.log(`Check git history: ${options.checkGitHistory ? '✅' : '❌'}`);
console.log(`Check dangerous defaults: ${options.checkDangerousDefaults ? '✅' : '❌'}`);
console.log(`Generate migration guide: ${options.generateMigrationGuide ? '✅' : '❌'}`);
console.log(`Generate secure template: ${options.generateSecureTemplate ? '✅' : '❌'}`);
console.log(`Production mode: ${options.productionMode ? '✅' : '❌'}`);
console.log(`Project path: ${options.projectPath}\n`);

function buildPrompt(opts: AuditorOptions): string {
  const {
    envPath,
    examplePath,
    checkGitHistory,
    checkDangerousDefaults,
    generateMigrationGuide,
    generateSecureTemplate,
    productionMode,
  } = opts;

  return `
You are an environment configuration security auditor. Your task is to thoroughly analyze environment configuration files and identify security issues, misconfigurations, and provide remediation guidance.

COMPREHENSIVE AUDIT STEPS:

1. **Basic Configuration Analysis**
   - Read ${examplePath} to understand expected configuration structure
   - Read ${envPath} to compare actual vs expected configuration
   - Identify missing required variables
   - Identify extra variables not documented in example file
   - Check for typos (case sensitivity, underscores vs hyphens, common misspellings)

2. **Codebase Usage Analysis**
   - Use Grep to find all environment variable references in the codebase
   - Search patterns: process.env, import.meta.env, Deno.env, os.getenv, ENV[], etc.
   - Extract all unique variable names used in code
   - Compare with what's defined in .env files
   - Report variables used in code but missing from .env.example
   - Report variables in .env files but never used in code

${
  checkGitHistory
    ? `
3. **Git History Security Scan**
   - Use Bash to check git history for accidentally committed secrets
   - Search for patterns like: password, secret, key, token, api_key, private
   - Look for .env files in git history: git log --all --full-history -- ".env*"
   - Check for high-entropy strings that might be leaked secrets
   - Identify when secrets were added and in which commits
   - Provide remediation steps if secrets are found (git filter-repo, rotate keys)
`
    : ''
}

${
  checkDangerousDefaults
    ? `
4. **Dangerous Defaults Detection**
   - Check for DEBUG=true or similar debug flags ${productionMode ? '(CRITICAL in production)' : ''}
   - Identify weak or default passwords/keys (admin, password, 123456, test)
   - Check for localhost URLs in production configs
   - Verify SSL/TLS is enabled for production (HTTPS, secure database connections)
   - Look for overly permissive CORS settings
   - Check for exposed admin panels or debug endpoints
   - Verify JWT secrets are strong (minimum 32 characters, high entropy)
   - Check database credentials aren't using default values
   - Verify API rate limiting is configured
   - Check for proper logging levels (not verbose in production)
`
    : ''
}

5. **Format and Schema Validation**
   - Validate URLs start with http:// or https://
   - Verify ports are valid numbers (1-65535)
   - Check boolean values are properly formatted
   - Validate email addresses match email format
   - Verify API keys/secrets meet minimum length requirements
   - Check JSON strings are valid JSON
   - Validate database connection strings are well-formed
   - Check for required fields based on variable naming conventions

${
  generateMigrationGuide
    ? `
6. **Migration Guide Generation**
   - Compare current config structure with previous versions in git history
   - Identify added, removed, and renamed variables
   - Generate step-by-step migration instructions
   - Provide before/after examples for each change
   - Include commands to update configs safely
   - Suggest rollback procedures if needed
   - Save as ${MIGRATION_GUIDE}
`
    : ''
}

${
  generateSecureTemplate
    ? `
7. **Secure Template Generation**
   - Create a comprehensive ${TEMPLATE_FILE}
   - Include all variables with secure placeholder values
   - Add detailed inline comments explaining each variable
   - Provide security guidance (e.g., "use strong random value", "never commit this file")
   - Group variables by category (Database, API, Security, etc.)
   - Include examples of correct formats
   - Add validation patterns where applicable
`
    : ''
}

SECURITY RISK LEVELS:
- 🔴 **CRITICAL**: Immediate security risk (exposed secrets, weak auth)
- 🟠 **HIGH**: Significant security concern (dangerous defaults, misconfiguration)
- 🟡 **MEDIUM**: Potential security issue (missing validation, unclear config)
- 🔵 **LOW**: Best practice violation (missing documentation, inconsistent naming)
- ✅ **PASS**: Configuration meets security standards

OUTPUT FORMAT:
Generate a comprehensive security audit report with:
1. **Executive Summary**: Overview of findings and risk score
2. **Critical Issues**: Immediate action required
3. **High Priority Issues**: Should fix soon
4. **Recommendations**: Medium and low priority improvements
5. **Remediation Guide**: Step-by-step fix instructions
6. **Configuration Health Score**: Overall rating (0-100)

${productionMode ? '\n⚠️  PRODUCTION MODE: Apply strictest security standards. Any critical issues must be reported prominently.\n' : ''}
`;
}

const systemPrompt = `You are an environment configuration security auditor focused on preventing configuration mishaps and secret leaks.

Your responsibilities include:
1. Comparing environment template files (e.g., .env.example) with actual environment files to spot missing or extra variables
2. Validating environment variable usage across the codebase to catch typos and unused definitions
3. Scanning git history for accidentally committed secrets when requested
4. Detecting dangerous defaults or insecure settings, especially when auditing production environments
5. Ensuring values follow expected schemas (URLs, booleans, ports, emails, JWT secrets, etc.)
6. Generating migration guides or secure templates when asked, with clear remediation steps and documentation

Always provide concrete, security-focused guidance with severity ratings, file references, and remediation instructions.`;

const prompt = buildPrompt(options);

const claudeSettings: Settings = {};

const allowedTools = [
  'Read',
  'Write',
  'TodoWrite',
  'Grep',
  'Glob',
  'Bash',
  'WebSearch',
  'WebFetch',
];

const defaultFlags: ClaudeFlags = {
  model: 'claude-sonnet-4-5-20250929',
  settings: JSON.stringify(claudeSettings),
  allowedTools: allowedTools.join(' '),
  'permission-mode': options.generateMigrationGuide || options.generateSecureTemplate ? 'acceptEdits' : 'default',
  'append-system-prompt': systemPrompt,
};

const previousCwd = process.cwd();
if (options.projectPath !== previousCwd) {
  process.chdir(options.projectPath);
}

claude(prompt, defaultFlags)
  .then((exitCode) => {
    if (options.projectPath !== previousCwd) {
      process.chdir(previousCwd);
    }
    process.exit(exitCode);
  })
  .catch((error) => {
    if (options.projectPath !== previousCwd) {
      process.chdir(previousCwd);
    }
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
