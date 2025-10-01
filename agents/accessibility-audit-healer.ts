#!/usr/bin/env bun

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

import { query } from '@anthropic-ai/claude-agent-sdk';

interface AccessibilityAuditOptions {
  url: string;
  sourcePath?: string;
  reportFile?: string;
  wcagLevel?: 'A' | 'AA' | 'AAA';
  autoFix?: boolean;
}

async function auditAccessibility(options: AccessibilityAuditOptions) {
  const {
    url,
    sourcePath,
    reportFile = 'accessibility-audit-report.md',
    wcagLevel = 'AA',
    autoFix = false,
  } = options;

  console.log('♿ Accessibility Audit Healer\n');
  console.log(`URL: ${url}`);
  console.log(`WCAG Level: ${wcagLevel}`);
  if (sourcePath) console.log(`Source Code: ${sourcePath}`);
  if (autoFix) console.log(`Auto-fix: Enabled`);
  console.log('');

  const prompt = `
You are an accessibility expert using Chrome DevTools MCP to audit and fix WCAG violations.

Target URL: ${url}
WCAG Compliance Level: ${wcagLevel}
${sourcePath ? `Source Code Path: ${sourcePath}` : ''}

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

${autoFix ? `
8. Auto-fix enabled: Attempt to fix issues by:
   - Using Edit tool to add missing alt attributes
   - Adding ARIA labels to form inputs
   - Fixing heading hierarchy
   - Only make changes to obvious, safe fixes
   - Report all changes made
` : ''}
` : ''}

Generate a comprehensive accessibility audit report and save to "${reportFile}" with:
- Executive summary with accessibility score (0-100)
- Violations breakdown by severity and WCAG level
- Detailed list of issues with code examples
- Prioritized fix recommendations
- Before/after comparison if auto-fix was enabled

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
   ${sourcePath ? '- Files: [file:line references]' : ''}

## Recommended Fixes Priority
1. [Most important fix with estimated impact]
2. [Next fix...]

${autoFix ? '## Auto-Fix Results\\n- Files Modified: [count]\\n- Issues Fixed: [count]' : ''}
`.trim();

  const result = query({
    prompt,
    options: {
      cwd: sourcePath || process.cwd(),
      mcpServers: {
        'chrome-devtools': {
          type: 'stdio',
          command: 'npx',
          args: ['chrome-devtools-mcp@latest', '--isolated'],
        },
      },
      allowedTools: [
        'mcp__chrome-devtools__navigate_page',
        'mcp__chrome-devtools__new_page',
        'mcp__chrome-devtools__take_snapshot',
        'mcp__chrome-devtools__take_screenshot',
        'mcp__chrome-devtools__evaluate_script',
        'Grep',
        'Glob',
        'Read',
        'Write',
        ...(autoFix ? ['Edit'] : []),
        'TodoWrite',
      ],
      permissionMode: autoFix ? 'acceptEdits' : 'default',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  const toolName = input.tool_name;
                  if (toolName === 'mcp__chrome-devtools__evaluate_script') {
                    console.log('🔍 Running accessibility audit...');
                  } else if (toolName === 'mcp__chrome-devtools__take_screenshot') {
                    console.log('📸 Capturing violations...');
                  } else if (toolName === 'Grep') {
                    console.log('🔎 Searching source code...');
                  } else if (toolName === 'Edit' && autoFix) {
                    const filePath = (input.tool_input as any).file_path;
                    console.log(`🔧 Auto-fixing: ${filePath}`);
                  } else if (toolName === 'Write') {
                    console.log(`💾 Generating report: ${reportFile}`);
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
                  const toolName = input.tool_name;
                  if (toolName === 'mcp__chrome-devtools__evaluate_script') {
                    console.log('✅ Audit complete');
                  } else if (toolName === 'Write') {
                    console.log('✅ Report saved');
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
                console.log('\n✨ Accessibility audit complete!');
                console.log(`\n📄 Full report: ${reportFile}`);
                if (autoFix) {
                  console.log('\n🔧 Auto-fixes applied - review before committing');
                }
                console.log('\nNext steps:');
                console.log('1. Review the audit report');
                console.log('2. Prioritize critical issues');
                console.log('3. Apply recommended fixes');
                console.log('4. Re-run audit to verify');
                return { continue: true };
              },
            ],
          },
        ],
      },
      maxTurns: 40,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  for await (const message of result) {
    if (message.type === 'assistant') {
      const textContent = message.message.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        const text = textContent.text;
        if (!text.includes('tool_use') && text.trim().length > 0) {
          console.log('\n💡', text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('\n' + '='.repeat(60));
        console.log('📊 Audit Statistics');
        console.log('='.repeat(60));
        console.log(`\nDuration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);

        if (message.result) {
          console.log('\n' + '='.repeat(60));
          console.log('📝 Summary');
          console.log('='.repeat(60));
          console.log('\n' + message.result);
        }
      } else {
        console.error('\n❌ Error:', message.subtype);
      }
    }
  }
}

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
♿ Accessibility Audit Healer

Usage:
  bun run agents/accessibility-audit-healer.ts <url> [options]

Arguments:
  url                     Website URL to audit

Options:
  --src <path>            Path to source code for finding files to fix
  --report <file>         Output file (default: accessibility-audit-report.md)
  --wcag <level>          WCAG level: A, AA, or AAA (default: AA)
  --auto-fix              Automatically apply safe fixes to source code
  --help                  Show this help

Examples:
  bun run agents/accessibility-audit-healer.ts https://example.com
  bun run agents/accessibility-audit-healer.ts https://localhost:3000 --src ./src
  bun run agents/accessibility-audit-healer.ts https://example.com --src ./src --auto-fix
  bun run agents/accessibility-audit-healer.ts https://example.com --wcag AAA
  `);
  process.exit(0);
}

const url = args[0];
if (!url) {
  console.error('❌ Error: URL is required');
  process.exit(1);
}

try {
  new URL(url);
} catch (error) {
  console.error('❌ Error: Invalid URL format');
  process.exit(1);
}

const options: AccessibilityAuditOptions = { url };

for (let i = 1; i < args.length; i++) {
  switch (args[i]) {
    case '--src':
      options.sourcePath = args[++i];
      break;
    case '--report':
      options.reportFile = args[++i];
      break;
    case '--wcag':
      const level = args[++i] as 'A' | 'AA' | 'AAA';
      if (!['A', 'AA', 'AAA'].includes(level)) {
        console.error('❌ Error: Invalid WCAG level. Must be A, AA, or AAA');
        process.exit(1);
      }
      options.wcagLevel = level;
      break;
    case '--auto-fix':
      options.autoFix = true;
      break;
  }
}

auditAccessibility(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
