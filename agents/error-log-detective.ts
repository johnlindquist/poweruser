#!/usr/bin/env bun

/**
 * Error Log Detective Agent
 *
 * A practical everyday agent that transforms cryptic error logs into actionable insights:
 * - Reads error logs from files, stdout, or monitoring services (Sentry, DataDog, CloudWatch)
 * - Groups similar errors together and identifies patterns across timestamps
 * - Analyzes stack traces to pinpoint exact locations in your codebase
 * - Correlates errors with recent git commits to identify what might have broken
 * - Suggests specific fixes based on error types and your code context
 * - Creates GitHub issues with detailed reproduction steps and suggested solutions
 * - Tracks error frequency over time to identify regressions
 * - Perfect for developers drowning in production errors who need to prioritize fixes
 *
 * Usage:
 *   bun run agents/error-log-detective.ts [options]
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface DetectiveOptions {
  logPath?: string;
  since?: string;
  groupBy?: 'error-type' | 'file' | 'timestamp';
  correlateWithGit?: boolean;
  createIssues?: boolean;
  prioritize?: boolean;
  outputFile?: string;
  maxErrors?: number;
}

async function analyzeErrorLogs(options: DetectiveOptions) {
  const {
    logPath = 'error.log',
    since,
    groupBy = 'error-type',
    correlateWithGit = true,
    createIssues = false,
    prioritize = true,
    outputFile,
    maxErrors = 100,
  } = options;

  console.log('🔍 Error Log Detective\n');
  console.log(`Log file: ${logPath}`);
  console.log(`Group by: ${groupBy}`);
  console.log(`Since: ${since || 'all time'}`);
  console.log(`Correlate with git: ${correlateWithGit ? '✅' : '❌'}`);
  console.log(`Create GitHub issues: ${createIssues ? '✅' : '❌'}`);
  console.log(`Prioritize errors: ${prioritize ? '✅' : '❌'}`);
  console.log(`Max errors to analyze: ${maxErrors}\n`);

  const prompt = `
You are an expert error log analyst and debugger. Your task is to analyze error logs, identify patterns, correlate with code changes, and provide actionable remediation steps.

COMPREHENSIVE ERROR ANALYSIS STEPS:

1. **Log Parsing and Error Extraction**
   - Read the log file at ${logPath}
   - Parse log entries to extract:
     - Error messages and types
     - Stack traces with file paths and line numbers
     - Timestamps of when errors occurred
     - Contextual information (user IDs, request IDs, environment info)
   - Handle various log formats: JSON logs, plain text, structured logs
   - Identify common error patterns: syntax errors, runtime errors, network errors, database errors
   ${since ? `- Filter errors that occurred since ${since}` : ''}
   ${maxErrors < 100 ? `- Focus on the most recent ${maxErrors} errors` : ''}

2. **Error Grouping and Pattern Recognition**
   - Group similar errors together based on:
     ${groupBy === 'error-type' ? '- Error type and message patterns (primary)' : ''}
     ${groupBy === 'file' ? '- Source file location (primary)' : ''}
     ${groupBy === 'timestamp' ? '- Time windows (primary)' : ''}
     - Stack trace similarity
     - Common root causes
   - Identify recurring patterns:
     - Same error in multiple places
     - Cascading failures (one error triggering others)
     - Time-based patterns (errors at specific times)
   - Calculate error frequencies and trends
   - Detect error bursts or spikes

3. **Stack Trace Analysis**
   - Parse each stack trace to identify:
     - Entry point of the error
     - Call chain leading to the error
     - Exact file paths and line numbers
   - Use Grep to locate the problematic code in your codebase
   - Read the relevant files to understand context
   - Identify:
     - Unhandled exceptions
     - Missing null/undefined checks
     - Type mismatches
     - Logic errors
     - Resource leaks (unclosed connections, memory)

${
  correlateWithGit
    ? `
4. **Git History Correlation**
   - Use Bash to check recent git history
   - For each error location, find:
     - Recent commits touching those files
     - When the code was last modified
     - Who made the changes
     - Commit messages that might explain issues
   - Commands to use:
     - git log --since="${since || '1 week ago'}" --oneline
     - git blame <file> -L <line>,<line>
     - git log -p -- <file> (for detailed changes)
   - Correlate error timestamps with commit timestamps
   - Identify commits that likely introduced bugs
   - Check if errors started after a specific deploy or merge
`
    : ''
}

${
  prioritize
    ? `
5. **Error Prioritization**
   - Assign priority scores based on:
     🔴 **CRITICAL** (Score 9-10):
       - Errors affecting core functionality
       - High frequency (>100 occurrences)
       - Security vulnerabilities
       - Data loss or corruption risks
       - Payment/transaction failures

     🟠 **HIGH** (Score 7-8):
       - Errors affecting major features
       - Medium frequency (20-100 occurrences)
       - Performance degradation
       - User-facing errors
       - API failures

     🟡 **MEDIUM** (Score 4-6):
       - Errors in secondary features
       - Low frequency (5-20 occurrences)
       - Gracefully handled errors
       - Non-critical background tasks

     🔵 **LOW** (Score 1-3):
       - Edge case errors
       - Very rare occurrences (<5)
       - Logging/monitoring errors
       - Deprecated code warnings
   - Sort errors by priority for remediation
`
    : ''
}

6. **Root Cause Analysis and Fix Suggestions**
   - For each error group:
     - Explain what went wrong in plain language
     - Identify the root cause (not just symptoms)
     - Provide specific code-level fix suggestions
     - Include code snippets showing before/after
     - Suggest preventive measures (tests, validation)
   - Common fixes to consider:
     - Add null/undefined checks
     - Improve error handling (try/catch)
     - Add input validation
     - Fix type mismatches
     - Close resources properly
     - Add retry logic for network errors
     - Improve database query performance
     - Add rate limiting

${
  createIssues
    ? `
7. **GitHub Issue Generation**
   - For each high-priority error group, create a draft GitHub issue:
     - Title: Concise error description
     - Labels: bug, priority (critical/high/medium/low)
     - Description:
       - Error summary
       - Frequency and impact
       - Affected files and line numbers
       - Stack trace excerpt
       - Suspected root cause
       - Steps to reproduce (if determinable)
       - Suggested fix with code examples
       - Related commits that may have introduced the bug
       - Testing checklist
   - Save issues as markdown files: issue-001.md, issue-002.md, etc.
`
    : ''
}

8. **Trend Analysis**
   - Analyze error trends over time:
     - Are errors increasing or decreasing?
     - New errors vs recurring errors
     - Errors by time of day (peak hours?)
     - Errors by environment (prod vs staging)
   - Identify regression patterns:
     - Errors that came back after being fixed
     - Errors introduced in recent releases

OUTPUT FORMAT:

Generate a comprehensive error analysis report with:

📊 **EXECUTIVE SUMMARY**
   - Total errors analyzed
   - Unique error types
   - Time range analyzed
   - Overall system health score

${prioritize ? '🔴 **CRITICAL ERRORS** (Top priority)\n🟠 **HIGH PRIORITY ERRORS**\n🟡 **MEDIUM PRIORITY ERRORS**\n🔵 **LOW PRIORITY ERRORS**' : '📋 **ERROR GROUPS**'}

For each error group include:
   - Error message/type
   - Frequency (count and %)
   - First seen / Last seen timestamps
   - Affected files and functions
   ${correlateWithGit ? '- Related git commits' : ''}
   - Root cause analysis
   - Suggested fix with code examples
   - Priority score and justification

📈 **TRENDS AND INSIGHTS**
   - Error patterns over time
   - Regression detection
   - Recommendations for preventing future errors

${createIssues ? '📝 **GITHUB ISSUES CREATED**\n   - List of generated issue files\n' : ''}

Use clear formatting, emojis, and code blocks for readability.
${outputFile ? `\nSave the full report to ${outputFile}` : ''}

Begin your comprehensive error log analysis now.
`.trim();

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      allowedTools: ['Read', 'Write', 'Grep', 'Glob', 'Bash', 'TodoWrite'],
      permissionMode: createIssues || outputFile ? 'acceptEdits' : 'default',
      model: 'claude-sonnet-4-5-20250929',
      maxThinkingTokens: 10000,
      maxTurns: 20,
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
                    const cmd = toolInput.command.substring(0, 70);
                    console.log(`⚡ Running: ${cmd}${toolInput.command.length > 70 ? '...' : ''}`);
                  } else if (input.tool_name === 'Write') {
                    const toolInput = input.tool_input as any;
                    console.log(`✍️  Writing ${toolInput.file_path}`);
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
                    console.log(`✅ File written successfully`);
                  } else if (input.tool_name === 'Grep') {
                    const toolResponse = input.tool_response as any;
                    if (toolResponse.matches) {
                      console.log(`   Found ${toolResponse.matches.length} matches`);
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
          text.includes('Analyzing') ||
          text.includes('Parsing') ||
          text.includes('Grouping') ||
          text.includes('Correlating')
        ) {
          process.stdout.write('.');
        }
      }
    } else if (message.type === 'result') {
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

      if (message.subtype === 'success') {
        console.log('\n\n' + '='.repeat(80));
        console.log('🔍 ERROR LOG DETECTIVE ANALYSIS REPORT');
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
      } else {
        console.error('\n❌ Error during analysis:', message.subtype);
        process.exit(1);
      }
    }
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🔍 Error Log Detective

Transform cryptic error logs into actionable insights with AI-powered analysis.

Usage:
  bun run agents/error-log-detective.ts [options]

Options:
  --log <path>              Path to log file (default: error.log)
  --since <date>            Only analyze errors since date (e.g., "1 week ago", "2024-01-01")
  --group-by <type>         Group errors by: error-type (default), file, or timestamp
  --no-git                  Skip correlating errors with git history
  --create-issues           Generate draft GitHub issues for high-priority errors
  --no-prioritize          Skip error prioritization (show all equally)
  --output <file>           Save full report to file
  --max-errors <n>          Maximum number of errors to analyze (default: 100)
  --help, -h                Show this help message

Examples:
  # Basic error analysis
  bun run agents/error-log-detective.ts --log logs/production.log

  # Analyze recent errors with git correlation
  bun run agents/error-log-detective.ts --log error.log --since "3 days ago"

  # Generate GitHub issues for top errors
  bun run agents/error-log-detective.ts --log error.log --create-issues

  # Full analysis with report output
  bun run agents/error-log-detective.ts --log error.log --output error-analysis.md

  # Quick analysis without git correlation
  bun run agents/error-log-detective.ts --log error.log --no-git --max-errors 50

Features:
  ✅ Parses various log formats (JSON, plain text, structured logs)
  ✅ Groups similar errors and identifies patterns
  ✅ Analyzes stack traces to pinpoint code locations
  ✅ Correlates errors with recent git commits
  ✅ Prioritizes errors by severity and frequency
  ✅ Suggests specific fixes with code examples
  ✅ Generates draft GitHub issues for critical errors
  ✅ Tracks error trends over time
  ✅ Identifies regressions and cascading failures
  `);
  process.exit(0);
}

// Parse options
const options: DetectiveOptions = {
  correlateWithGit: true,
  prioritize: true,
  createIssues: false,
  groupBy: 'error-type',
  maxErrors: 100,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--log':
      options.logPath = args[++i];
      break;
    case '--since':
      options.since = args[++i];
      break;
    case '--group-by':
      const groupBy = args[++i];
      if (groupBy === 'error-type' || groupBy === 'file' || groupBy === 'timestamp') {
        options.groupBy = groupBy;
      }
      break;
    case '--no-git':
      options.correlateWithGit = false;
      break;
    case '--create-issues':
      options.createIssues = true;
      break;
    case '--no-prioritize':
      options.prioritize = false;
      break;
    case '--output':
      options.outputFile = args[++i];
      break;
    case '--max-errors':
      const maxErrorsArg = args[++i];
      if (maxErrorsArg) {
        options.maxErrors = parseInt(maxErrorsArg, 10);
      }
      break;
  }
}

// Run the detective
analyzeErrorLogs(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
