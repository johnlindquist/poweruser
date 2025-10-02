#!/usr/bin/env -S bun run

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

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type GroupByType = 'error-type' | 'file' | 'timestamp';

interface DetectiveOptions {
  logPath: string;
  since?: string;
  groupBy: GroupByType;
  correlateWithGit: boolean;
  createIssues: boolean;
  prioritize: boolean;
  outputFile?: string;
  maxErrors: number;
}

const DEFAULT_LOG_PATH = 'error.log';
const DEFAULT_GROUP_BY: GroupByType = 'error-type';
const DEFAULT_MAX_ERRORS = 100;

function printHelp(): void {
  console.log(`
🔍 Error Log Detective

Transform cryptic error logs into actionable insights with AI-powered analysis.

Usage:
  bun run agents/error-log-detective.ts [options]

Options:
  --log <path>              Path to log file (default: ${DEFAULT_LOG_PATH})
  --since <date>            Only analyze errors since date (e.g., "1 week ago", "2024-01-01")
  --group-by <type>         Group errors by: error-type (default), file, or timestamp
  --no-git                  Skip correlating errors with git history
  --create-issues           Generate draft GitHub issues for high-priority errors
  --no-prioritize          Skip error prioritization (show all equally)
  --output <file>           Save full report to file
  --max-errors <n>          Maximum number of errors to analyze (default: ${DEFAULT_MAX_ERRORS})
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
}

function parseOptions(): DetectiveOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawLog = values.log;
  const rawSince = values.since;
  const rawGroupBy = values['group-by'] || values.groupBy;
  const rawMaxErrors = values['max-errors'] || values.maxErrors;
  const rawOutput = values.output;

  const logPath = typeof rawLog === "string" && rawLog.length > 0
    ? resolve(rawLog)
    : DEFAULT_LOG_PATH;

  const since = typeof rawSince === "string" && rawSince.length > 0
    ? rawSince
    : undefined;

  const groupBy = typeof rawGroupBy === "string" && rawGroupBy.length > 0
    ? (rawGroupBy as GroupByType)
    : DEFAULT_GROUP_BY;

  if (!(["error-type", "file", "timestamp"] as const).includes(groupBy)) {
    console.error("❌ Error: Invalid group-by value. Must be error-type, file, or timestamp");
    process.exit(1);
  }

  const maxErrors = typeof rawMaxErrors === "string" && rawMaxErrors.length > 0
    ? parseInt(rawMaxErrors, 10)
    : typeof rawMaxErrors === "number"
    ? rawMaxErrors
    : DEFAULT_MAX_ERRORS;

  if (isNaN(maxErrors) || maxErrors < 1) {
    console.error("❌ Error: max-errors must be a positive number");
    process.exit(1);
  }

  const outputFile = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : undefined;

  const correlateWithGit = values['no-git'] !== true;
  const createIssues = values['create-issues'] === true || values.createIssues === true;
  const prioritize = values['no-prioritize'] !== true;

  return {
    logPath,
    since,
    groupBy,
    correlateWithGit,
    createIssues,
    prioritize,
    outputFile,
    maxErrors,
  };
}

function buildPrompt(options: DetectiveOptions): string {
  const {
    logPath,
    since,
    groupBy,
    correlateWithGit,
    createIssues,
    prioritize,
    outputFile,
    maxErrors,
  } = options;

  return `
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
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = [
    "log",
    "since",
    "group-by",
    "groupBy",
    "no-git",
    "create-issues",
    "createIssues",
    "no-prioritize",
    "output",
    "max-errors",
    "maxErrors",
    "help",
    "h",
  ] as const;

  for (const key of agentKeys) {
    if (key in values) {
      delete values[key];
    }
  }
}

const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log('🔍 Error Log Detective\n');
console.log(`Log file: ${options.logPath}`);
console.log(`Group by: ${options.groupBy}`);
console.log(`Since: ${options.since || 'all time'}`);
console.log(`Correlate with git: ${options.correlateWithGit ? '✅' : '❌'}`);
console.log(`Create GitHub issues: ${options.createIssues ? '✅' : '❌'}`);
console.log(`Prioritize errors: ${options.prioritize ? '✅' : '❌'}`);
console.log(`Max errors to analyze: ${options.maxErrors}`);
if (options.outputFile) console.log(`Output file: ${options.outputFile}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Read",
  "Write",
  "Grep",
  "Glob",
  "Bash",
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": options.createIssues || options.outputFile ? "acceptEdits" : "default",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Error log analysis complete!\n");
    if (options.outputFile) {
      console.log(`📄 Full report: ${options.outputFile}`);
    }
    if (options.createIssues) {
      console.log("📝 GitHub issue drafts created");
    }
    console.log("\nNext steps:");
    console.log("1. Review the analysis report");
    console.log("2. Address critical priority errors first");
    console.log("3. Apply recommended fixes");
    if (options.createIssues) {
      console.log("4. Review and submit GitHub issues");
    }
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
