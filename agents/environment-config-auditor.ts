#!/usr/bin/env bun

/**
 * Environment Config Auditor Agent
 *
 * A practical everyday agent that prevents configuration mishaps and security issues:
 * - Compares .env.example against actual .env files to identify missing or extra variables
 * - Validates environment variables against code usage to catch typos and unused configs
 * - Checks for accidentally committed secrets in git history and suggests remediation
 * - Verifies production configs match expected schema without exposing actual values
 * - Detects dangerous defaults (DEBUG=true, weak keys) that shouldn't be in production
 * - Generates migration guides when config structure changes between environments
 * - Creates secure .env templates for new team members with clear documentation
 *
 * Usage:
 *   bun run agents/environment-config-auditor.ts [options]
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface AuditorOptions {
  envPath?: string;
  examplePath?: string;
  checkGitHistory?: boolean;
  checkDangerousDefaults?: boolean;
  generateMigrationGuide?: boolean;
  generateSecureTemplate?: boolean;
  productionMode?: boolean;
}

async function auditEnvironmentConfig(options: AuditorOptions) {
  const {
    envPath = '.env',
    examplePath = '.env.example',
    checkGitHistory = true,
    checkDangerousDefaults = true,
    generateMigrationGuide = false,
    generateSecureTemplate = false,
    productionMode = false,
  } = options;

  console.log('🔒 Environment Config Auditor\n');
  console.log(`Example file: ${examplePath}`);
  console.log(`Environment file: ${envPath}`);
  console.log(`Check git history: ${checkGitHistory ? '✅' : '❌'}`);
  console.log(`Check dangerous defaults: ${checkDangerousDefaults ? '✅' : '❌'}`);
  console.log(`Generate migration guide: ${generateMigrationGuide ? '✅' : '❌'}`);
  console.log(`Generate secure template: ${generateSecureTemplate ? '✅' : '❌'}`);
  console.log(`Production mode: ${productionMode ? '✅' : '❌'}\n`);

  const prompt = `
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
   - Save as MIGRATION.md
`
    : ''
}

${
  generateSecureTemplate
    ? `
7. **Secure Template Generation**
   - Create a comprehensive .env.template file
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

Use clear formatting, emojis for severity levels, and specific file/line references.

${productionMode ? '\n⚠️  PRODUCTION MODE: Apply strictest security standards. Any critical issues must be reported prominently.\n' : ''}

Begin your comprehensive security audit now.
`.trim();

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      allowedTools: ['Read', 'Write', 'Grep', 'Glob', 'Bash', 'TodoWrite'],
      // Accept edits if generating files, otherwise default permissions
      permissionMode: generateMigrationGuide || generateSecureTemplate ? 'acceptEdits' : 'default',
      model: 'claude-sonnet-4-5-20250929',
      maxThinkingTokens: 8000,
      maxTurns: 15,
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  if (input.tool_name === 'Read') {
                    const toolInput = input.tool_input as any;
                    console.log(`📖 Reading ${toolInput.file_path}`);
                  } else if (input.tool_name === 'Grep') {
                    const toolInput = input.tool_input as any;
                    console.log(`🔍 Searching for: ${toolInput.pattern}`);
                  } else if (input.tool_name === 'Bash') {
                    const toolInput = input.tool_input as any;
                    // Don't print sensitive commands
                    if (!toolInput.command.includes('password') && !toolInput.command.includes('secret')) {
                      console.log(`⚡ Running: ${toolInput.command.substring(0, 60)}${toolInput.command.length > 60 ? '...' : ''}`);
                    } else {
                      console.log(`⚡ Running security check...`);
                    }
                  } else if (input.tool_name === 'Write') {
                    const toolInput = input.tool_input as any;
                    console.log(`✍️  Generating ${toolInput.file_path}`);
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
                if (input.hook_event_name === 'PostToolUse') {
                  if (input.tool_name === 'Write') {
                    console.log(`✅ File created successfully`);
                  } else if (input.tool_name === 'Grep') {
                    const toolResponse = input.tool_response as any;
                    if (toolResponse.matches) {
                      console.log(`   Found ${toolResponse.matches.length} references`);
                    } else if (toolResponse.files) {
                      console.log(`   Found matches in ${toolResponse.files.length} files`);
                    }
                  }
                }
                return { continue: true };
              },
            ],
          },
        ],
      },
    },
  });

  const startTime = Date.now();

  // Stream results
  for await (const message of result) {
    if (message.type === 'assistant') {
      const textContent = message.message.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        const text = textContent.text;
        // Show progress for key actions
        if (
          text.includes('Scanning') ||
          text.includes('Analyzing') ||
          text.includes('Checking') ||
          text.includes('Validating')
        ) {
          process.stdout.write('.');
        }
      }
    } else if (message.type === 'result') {
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

      if (message.subtype === 'success') {
        console.log('\n\n' + '='.repeat(80));
        console.log('🔒 ENVIRONMENT CONFIGURATION SECURITY AUDIT REPORT');
        console.log('='.repeat(80));
        console.log('\n' + message.result);
        console.log('\n' + '='.repeat(80));
        console.log(`⚡ Completed in ${elapsedTime}s`);
        console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(
          `📊 Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`
        );

        if (message.usage.cache_read_input_tokens) {
          console.log(`🚀 Cache hits: ${message.usage.cache_read_input_tokens} tokens`);
        }

        // Exit with error code if critical issues found in production mode
        if (productionMode && (message.result.includes('🔴') || message.result.includes('CRITICAL'))) {
          console.log('\n🔴 CRITICAL SECURITY ISSUES FOUND IN PRODUCTION MODE');
          console.log('Address these issues immediately before deploying.');
          process.exit(1);
        }
      } else {
        console.error('\n❌ Error during audit:', message.subtype);
        process.exit(1);
      }
    }
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🔒 Environment Config Auditor

A comprehensive security audit tool for environment configuration files.

Usage:
  bun run agents/environment-config-auditor.ts [options]

Options:
  --env <path>              Path to .env file (default: .env)
  --example <path>          Path to .env.example file (default: .env.example)
  --no-git-history         Skip checking git history for leaked secrets
  --no-dangerous-defaults  Skip checking for dangerous default values
  --generate-migration     Generate migration guide for config changes
  --generate-template      Generate secure .env template for team members
  --production             Enable production mode (strict security checks)
  --help, -h               Show this help message

Examples:
  # Basic security audit
  bun run agents/environment-config-auditor.ts

  # Full audit with migration guide
  bun run agents/environment-config-auditor.ts --generate-migration --generate-template

  # Production mode audit (strict)
  bun run agents/environment-config-auditor.ts --production

  # Quick audit without git history scan
  bun run agents/environment-config-auditor.ts --no-git-history

Features:
  ✅ Detects missing/extra environment variables
  ✅ Validates variable formats and schemas
  ✅ Scans git history for accidentally committed secrets
  ✅ Identifies dangerous defaults (DEBUG=true, weak keys)
  ✅ Checks for typos and unused variables
  ✅ Generates secure templates and migration guides
  ✅ Provides remediation steps for all issues
  `);
  process.exit(0);
}

// Parse options
const options: AuditorOptions = {
  checkGitHistory: true,
  checkDangerousDefaults: true,
  generateMigrationGuide: false,
  generateSecureTemplate: false,
  productionMode: false,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--env':
      options.envPath = args[++i];
      break;
    case '--example':
      options.examplePath = args[++i];
      break;
    case '--no-git-history':
      options.checkGitHistory = false;
      break;
    case '--no-dangerous-defaults':
      options.checkDangerousDefaults = false;
      break;
    case '--generate-migration':
      options.generateMigrationGuide = true;
      break;
    case '--generate-template':
      options.generateSecureTemplate = true;
      break;
    case '--production':
      options.productionMode = true;
      break;
  }
}

// Run the auditor
auditEnvironmentConfig(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
