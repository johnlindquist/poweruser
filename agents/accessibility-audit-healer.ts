#!/usr/bin/env -S bun run

/**
 * Accessibility Audit Healer Agent
 *
 * This agent uses Chrome DevTools MCP to audit and suggest fixes for accessibility issues:
 * - Opens websites and analyzes the accessibility tree
 * - Detects WCAG 2.1 violations (A, AA, AAA levels)
 * - Identifies missing ARIA labels, poor color contrast, keyboard navigation issues
 * - Takes screenshots to highlight problematic areas
 * - Scans source code to locate files causing accessibility issues
 * - Suggests specific fixes with code examples
 * - Generates before/after accessibility score comparison
 *
 * Usage:
 *   bun run agents/accessibility-audit-healer.ts <url> [options]
 *
 * Examples:
 *   # Basic accessibility audit
 *   bun run agents/accessibility-audit-healer.ts https://example.com
 *
 *   # Audit with source code path for fix suggestions
 *   bun run agents/accessibility-audit-healer.ts https://example.com --src ./src
 *
 *   # Generate detailed report
 *   bun run agents/accessibility-audit-healer.ts https://example.com --report a11y-report.md
 */

import { resolve } from "node:path";
import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type WcagLevel = "A" | "AA" | "AAA";

interface AccessibilityAuditOptions {
  url: string;
  sourcePath?: string;
  reportFile: string;
  wcagLevel: WcagLevel;
  autoFix: boolean;
}

const DEFAULT_REPORT_FILE = "accessibility-audit-report.md";
const DEFAULT_WCAG_LEVEL: WcagLevel = "AA";

function printHelp(): void {
  console.log(`
♿ Accessibility Audit Healer

Usage:
  bun run agents/accessibility-audit-healer.ts <url> [options]

Arguments:
  url                     Website URL to audit

Options:
  --src <path>            Path to source code for finding files to fix
  --report <file>         Output file (default: ${DEFAULT_REPORT_FILE})
  --wcag <level>          WCAG level: A, AA, or AAA (default: ${DEFAULT_WCAG_LEVEL})
  --auto-fix              Automatically apply safe fixes to source code
  --help, -h              Show this help

Examples:
  bun run agents/accessibility-audit-healer.ts https://example.com
  bun run agents/accessibility-audit-healer.ts https://localhost:3000 --src ./src
  bun run agents/accessibility-audit-healer.ts https://example.com --src ./src --auto-fix
  bun run agents/accessibility-audit-healer.ts https://example.com --wcag AAA
  `);
}

function parseOptions(): AccessibilityAuditOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const url = positionals[0];
  if (!url) {
    console.error("❌ Error: URL is required");
    printHelp();
    process.exit(1);
  }

  try {
    new URL(url);
  } catch (error) {
    console.error("❌ Error: Invalid URL format");
    process.exit(1);
  }

  const rawSource = values.src;
  const rawReport = values.report;
  const rawWcag = values.wcag;
  const autoFix = values["auto-fix"] === true || values.autoFix === true;

  const sourcePath = typeof rawSource === "string" && rawSource.length > 0
    ? resolve(rawSource)
    : undefined;

  const reportFile = typeof rawReport === "string" && rawReport.length > 0
    ? rawReport
    : DEFAULT_REPORT_FILE;

  const wcagLevel = typeof rawWcag === "string" && rawWcag.length > 0
    ? (rawWcag.toUpperCase() as WcagLevel)
    : DEFAULT_WCAG_LEVEL;

  if (!(["A", "AA", "AAA"] as const).includes(wcagLevel)) {
    console.error("❌ Error: Invalid WCAG level. Must be A, AA, or AAA");
    process.exit(1);
  }

  return {
    url,
    sourcePath,
    reportFile,
    wcagLevel,
    autoFix,
  };
}

function buildPrompt(options: AccessibilityAuditOptions): string {
  const { url, sourcePath, reportFile, wcagLevel, autoFix } = options;

  return `
You are an accessibility expert using Chrome DevTools MCP to audit and fix WCAG violations.

Target URL: ${url}
WCAG Compliance Level: ${wcagLevel}
${sourcePath ? `Source Code Path: ${sourcePath}` : ""}

Your tasks:
1. Open the URL in Chrome using Chrome DevTools MCP
2. Take a snapshot of the page structure
3. Evaluate accessibility using JavaScript to check for:
   - Images without alt text
   - Form inputs without labels
   - Missing heading hierarchy
   - Links without meaningful text
   - Missing lang attribute
   - Color contrast issues (flag for manual review)
   - Interactive elements without proper ARIA labels

4. Take screenshots of pages with critical violations
5. Analyze the violations and group them by:
   - Severity (Critical, Moderate, Minor)
   - WCAG Level (A, AA, AAA)
   - Type (Missing alt text, form labels, contrast, etc.)

6. For each violation type, provide:
   - Clear explanation of the issue
   - WCAG criterion violated
   - Specific code examples showing the problem
   - Recommended fix with code example
   - Priority level for fixing
${sourcePath ? `
7. If source code path is provided, use Grep to find relevant files:
   - Search for image tags: <img
   - Search for form inputs: <input, <textarea, <select
   - Search for heading tags: <h1, <h2, etc.
   - Provide file:line references for each violation
` : ""}${autoFix ? `
8. Auto-fix enabled: Attempt to fix issues by:
   - Using Edit tool to add missing alt attributes
   - Adding ARIA labels to form inputs
   - Fixing heading hierarchy
   - Only make changes to obvious, safe fixes
   - Report all changes made
` : ""}
Generate a comprehensive accessibility audit report and save to "${reportFile}" with:
- Executive summary with accessibility score (0-100)
- Violations breakdown by severity and WCAG level
- Detailed list of issues with code examples
- Prioritized fix recommendations
- Before/after comparison if auto-fix was enabled
- A "Next Steps" checklist for the developer to follow

Format your findings as:
## Accessibility Audit Summary
- Total Violations: [count]
- Critical: [count]
- Moderate: [count]
- Minor: [count]
- WCAG Compliance Level: ${wcagLevel} - [PASS/FAIL]

## Critical Issues (Fix Immediately)
1. [Issue name] - WCAG [criterion]
   - Occurrences: [count]
   - Example: [HTML snippet]
   - Fix: [Recommended solution with code]
   ${sourcePath ? "- Files: [file:line references]" : ""}

## Recommended Fixes Priority
1. [Most important fix with estimated impact]
2. [Next fix...]

${autoFix ? "## Auto-Fix Results\\n- Files Modified: [count]\\n- Issues Fixed: [count]" : ""}
## Next Steps
- [Actionable item 1]
- [Actionable item 2]
- [Actionable item 3]
`.trim();
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("♿ Accessibility Audit Healer\n");
console.log(`URL: ${options.url}`);
console.log(`WCAG Level: ${options.wcagLevel}`);
if (options.sourcePath) console.log(`Source Code: ${options.sourcePath}`);
console.log(`Auto-fix: ${options.autoFix ? "Enabled" : "Disabled"}`);
console.log(`Report: ${options.reportFile}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "mcp__chrome-devtools__navigate_page",
  "mcp__chrome-devtools__new_page",
  "mcp__chrome-devtools__take_snapshot",
  "mcp__chrome-devtools__take_screenshot",
  "mcp__chrome-devtools__evaluate_script",
  "Grep",
  "Glob",
  "Read",
  "Write",
  ...(options.autoFix ? ["Edit"] : []),
  "TodoWrite",
];

const mcpConfig = {
  mcpServers: {
    "chrome-devtools": {
      command: "npx",
      args: ["chrome-devtools-mcp@latest", "--isolated"],
    },
  },
};

removeAgentFlags([
    "src", "report", "wcag", "auto-fix", "autoFix", "help", "h"
  ]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  'mcp-config': JSON.stringify(mcpConfig),
  allowedTools: allowedTools.join(" "),
  "permission-mode": options.autoFix ? "acceptEdits" : "default",
  'strict-mcp-config': true,
  ...(options.autoFix ? { 'dangerously-skip-permissions': true } : {}),
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Accessibility audit complete!\n");
    console.log(`📄 Full report: ${options.reportFile}`);
    if (options.autoFix) {
      console.log("🔧 Auto-fixes applied - review before committing");
    }
    console.log("\nNext steps:");
    console.log("1. Review the audit report");
    console.log("2. Prioritize critical issues");
    console.log("3. Apply recommended fixes");
    console.log("4. Re-run audit to verify");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
