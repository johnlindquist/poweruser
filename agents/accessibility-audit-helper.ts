#!/usr/bin/env -S bun run

/**
 * Accessibility Audit Helper Agent
 *
 * A practical everyday agent that ensures your web app is accessible to everyone:
 * - Scans React/Vue/HTML components for common a11y violations (missing alt text, poor contrast, missing ARIA)
 * - Checks semantic HTML usage (proper heading hierarchy, landmark regions, form labels)
 * - Validates keyboard navigation support (tab order, focus management, skip links)
 * - Tests color contrast ratios against WCAG AA/AAA standards
 * - Generates automatic fixes for common issues with code suggestions
 * - Creates an accessibility report with severity levels and remediation steps
 * - Suggests accessible alternatives for problematic UI patterns
 * - Perfect for ensuring your app works for users with disabilities without manual WCAG checklist reviews
 *
 * This audits your frontend code for accessibility in under 45 seconds.
 *
 * Usage:
 *   bun run agents/accessibility-audit-helper.ts [path] [options]
 *
 * Options:
 *   --standard <AA|AAA>     WCAG conformance level (default: AA)
 *   --fix                   Automatically apply fixes where possible
 *   --output <file>         Output report file (default: a11y-report.md)
 *   --framework <react|vue|html>  Target framework (default: auto-detect)
 */

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type WcagLevel = "AA" | "AAA";
type Framework = "react" | "vue" | "html" | "auto";

interface AuditOptions {
  projectPath: string;
  wcagLevel: WcagLevel;
  autoFix: boolean;
  outputFile: string;
  framework: Framework;
}

const DEFAULT_OUTPUT_FILE = "a11y-report.md";
const DEFAULT_WCAG_LEVEL: WcagLevel = "AA";
const DEFAULT_FRAMEWORK: Framework = "auto";

function printHelp(): void {
  console.log(`
🌐 Accessibility Audit Helper

Comprehensive accessibility audit tool for web applications.

Usage:
  bun run agents/accessibility-audit-helper.ts [path] [options]

Arguments:
  path                      Project path to audit (default: current directory)

Options:
  --standard <AA|AAA>       WCAG conformance level (default: ${DEFAULT_WCAG_LEVEL})
  --fix                     Automatically apply fixes where possible
  --output <file>           Output report file (default: ${DEFAULT_OUTPUT_FILE})
  --framework <react|vue|html>  Target framework (default: ${DEFAULT_FRAMEWORK})
  --help, -h                Show this help message

Examples:
  # Audit current directory for WCAG AA compliance
  bun run agents/accessibility-audit-helper.ts

  # Audit specific directory with AAA standard
  bun run agents/accessibility-audit-helper.ts ./src --standard AAA

  # Audit and auto-fix issues
  bun run agents/accessibility-audit-helper.ts --fix

  # Audit React app with custom output
  bun run agents/accessibility-audit-helper.ts --framework react --output report.md
  `);
}

function parseOptions(): AuditOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const projectPath = positionals[0]
    ? resolve(positionals[0])
    : process.cwd();

  const rawStandard = values.standard;
  const wcagLevel = typeof rawStandard === "string" && rawStandard.length > 0
    ? (rawStandard.toUpperCase() as WcagLevel)
    : DEFAULT_WCAG_LEVEL;

  if (!(["AA", "AAA"] as const).includes(wcagLevel)) {
    console.error("❌ Error: Invalid WCAG level. Must be AA or AAA");
    process.exit(1);
  }

  const autoFix = values.fix === true;

  const rawOutput = values.output;
  const outputFile = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : DEFAULT_OUTPUT_FILE;

  const rawFramework = values.framework;
  const framework = typeof rawFramework === "string" && rawFramework.length > 0
    ? (rawFramework.toLowerCase() as Framework)
    : DEFAULT_FRAMEWORK;

  const validFrameworks = ["react", "vue", "html", "auto"] as const;
  if (!validFrameworks.includes(framework)) {
    console.error("❌ Error: Invalid framework. Must be react, vue, html, or auto");
    process.exit(1);
  }

  return {
    projectPath,
    wcagLevel,
    autoFix,
    outputFile,
    framework,
  };
}

function buildSystemPrompt(options: AuditOptions): string {
  const { wcagLevel, autoFix, framework } = options;

  return `You are an accessibility audit expert specializing in WCAG ${wcagLevel} compliance. Your goal is to help developers create inclusive, accessible web applications.

Your task is to perform a comprehensive accessibility audit covering:

1. **Semantic HTML & Document Structure**
   - Proper heading hierarchy (h1-h6) without skipping levels
   - Landmark regions (header, nav, main, aside, footer)
   - Proper use of semantic elements (article, section, nav, etc.)
   - Valid HTML structure (no nested buttons, proper nesting)
   - Page title and language attributes

2. **Images & Media**
   - Alt text for all images (meaningful descriptions, not "image" or filename)
   - Empty alt for decorative images (alt="")
   - <figure> and <figcaption> for complex images
   - Video captions and audio transcripts
   - SVG accessibility (role, aria-label, or title)

3. **Forms & Input Controls**
   - Associated labels for all inputs (via for/id or wrapping)
   - Required field indicators (aria-required or required attribute)
   - Error messages properly associated (aria-describedby)
   - Fieldsets and legends for grouped inputs
   - Accessible custom controls (proper ARIA roles)
   - Input type appropriateness (email, tel, url, etc.)

4. **Keyboard Navigation**
   - Logical tab order (no positive tabindex values)
   - Visible focus indicators (outline or focus-visible styles)
   - Skip navigation links for keyboard users
   - No keyboard traps
   - Access to all interactive elements via keyboard
   - Proper handling of modal focus management

5. **ARIA Attributes**
   - Proper ARIA roles (button, link, dialog, menu, etc.)
   - ARIA labels for buttons/links without text
   - ARIA live regions for dynamic content
   - ARIA states (expanded, selected, checked)
   - ARIA describedby for additional context
   - No redundant or conflicting ARIA (prefer semantic HTML)

6. **Color & Contrast**
   - Text contrast ratios (WCAG ${wcagLevel}: ${wcagLevel === 'AAA' ? '7:1 for normal text, 4.5:1 for large text' : '4.5:1 for normal text, 3:1 for large text'})
   - UI component contrast (3:1 minimum for buttons, inputs)
   - Color not used as only means of conveying information
   - Focus indicators have sufficient contrast

7. **Interactive Elements**
   - Links have descriptive text (not "click here" or "read more")
   - Buttons vs links used appropriately
   - Touch targets at least 44x44 pixels
   - Disabled elements properly communicated
   - Loading states announced to screen readers

8. **Framework-Specific Patterns**
   ${
     framework === 'react' || framework === 'auto'
       ? `
   - React: Check for missing keys in lists
   - JSX: Validate accessibility props
   - React Router: Focus management on route changes
   - Custom components: Proper forwarding of aria props`
       : ''
   }
   ${
     framework === 'vue' || framework === 'auto'
       ? `
   - Vue: v-for keys for list items
   - Vue Router: Announce route changes
   - Custom components: Proper event handling`
       : ''
   }

${
  autoFix
    ? `
AUTOMATIC FIXES:
When issues can be automatically fixed safely:
- Add missing alt attributes
- Associate form labels with inputs
- Fix heading hierarchy
- Add ARIA attributes for common patterns
- Improve link/button text
- Add role attributes where semantic HTML isn't used

Make edits directly to files using the Edit tool.
`
    : ''
}

IMPORTANT:
- Focus on issues that actually impact users with disabilities
- Prioritize by severity (critical: blocks access, high: difficult to use, medium: suboptimal, low: best practice)
- Provide specific code examples for fixes
- Reference WCAG success criteria for each issue
- Be constructive and educational in tone`;
}

function buildPrompt(options: AuditOptions): string {
  const { projectPath, outputFile, autoFix, framework } = options;

  return `Perform a comprehensive accessibility audit on the web application at: ${projectPath}

1. **Detect Framework & File Structure**
   - Use Glob to find component files: *.jsx, *.tsx, *.vue, *.html
   - Determine the framework from package.json and file extensions
   - Identify the component structure and entry points
   - Find style files that may contain color/contrast information

2. **Scan for Common Accessibility Issues**
   ${
     framework === 'react' || framework === 'auto'
       ? `
   - Images without alt: Use Grep to find <img without alt attribute
   - Missing form labels: Find input elements without associated labels
   - Non-semantic elements: div/span with click handlers that should be buttons
   - Missing ARIA: Interactive elements without proper roles/labels
   - Heading hierarchy: Check h1-h6 order and nesting
   `
       : ''
   }
   - Use Grep with patterns:
     * Images: <img(?![^>]*alt[\\s>])
     * Unlabeled inputs: <input(?![^>]*aria-label)(?![^>]*aria-labelledby)
     * Click handlers on divs: <div[^>]*on(C|c)lick
     * Buttons without text: <button[^>]*>[\\s]*</button>
     * Links without text: <a[^>]*>[\\s]*</a>

3. **Analyze Semantic HTML Structure**
   - Read main component files to check:
     * Document structure (header, nav, main, footer)
     * Heading hierarchy (h1 should be first, no skipped levels)
     * List usage (ul/ol for related items)
     * Form structure (fieldset, legend)
     * Table structure (proper th, scope, caption)

4. **Check Keyboard Navigation**
   - Find positive tabindex values: Grep for tabindex="[1-9]
   - Check for focus styles in CSS/styled-components
   - Identify potential keyboard traps (modal, dropdown focus management)
   - Look for skip navigation links

5. **Validate ARIA Usage**
   - Find ARIA attributes: Grep for aria-
   - Check for redundant ARIA (aria-label on semantic elements)
   - Verify ARIA roles match element semantics
   - Look for required ARIA states (aria-expanded on expandable elements)

6. **Assess Color & Contrast**
   - Read CSS/style files to extract colors
   - Identify text colors, background colors, and border colors
   - Note any potential contrast issues (light gray text on white)
   - Flag uses of color alone for information (red/green without icons)

7. **Generate Detailed Report**
   Create a markdown report (${outputFile}) with:

   # Accessibility Audit Report

   **WCAG ${options.wcagLevel} Compliance Check**

   ## Executive Summary
   - Total issues found: X
   - Critical: X (blocks access for users with disabilities)
   - High: X (significant barriers)
   - Medium: X (usability issues)
   - Low: X (best practice violations)
   - Overall score: X/100

   ## Critical Issues 🔴

   ### Issue #1: Missing Alt Text for Images
   **WCAG Criterion**: 1.1.1 Non-text Content (Level A)
   **Severity**: Critical
   **Impact**: Screen reader users cannot understand image content

   **Location**: src/components/Hero.tsx:42
   \`\`\`tsx
   // ❌ Before
   <img src="/logo.png" />

   // ✅ After
   <img src="/logo.png" alt="Company logo" />
   \`\`\`

   **Fix**: Add descriptive alt text explaining what the image shows
   ${autoFix ? '**Status**: ✅ Auto-fixed' : ''}

   ## High Priority Issues 🟠
   [Similar format for high priority issues]

   ## Medium Priority Issues 🟡
   [Similar format for medium priority issues]

   ## Low Priority Issues 🔵
   [Similar format for low priority issues]

   ## Accessibility Score Breakdown
   - Perceivable: X/25
   - Operable: X/25
   - Understandable: X/25
   - Robust: X/25

   ## Recommendations
   - Top 3 quick wins that would have biggest impact
   - Suggested accessibility testing tools (axe DevTools, WAVE)
   - Consider adding automated a11y testing (jest-axe, cypress-axe)
   - Resources for learning more about accessibility

   ## Next Steps
   1. Fix all critical issues immediately
   2. Address high priority issues within 1 week
   3. Plan for medium/low priority improvements
   4. Set up automated a11y testing in CI/CD

${
  autoFix
    ? `
8. **Apply Automatic Fixes**
   For each issue that can be safely auto-fixed:
   - Use Edit tool to apply the fix
   - Verify the fix doesn't break existing functionality
   - Mark as fixed in the report
   - Summarize all changes made
`
    : ''
}

Start the audit now. Be thorough but efficient - focus on real issues that impact users.`;
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["standard", "fix", "output", "framework", "help", "h"] as const;

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

console.log("🌐 Accessibility Audit Helper\n");
console.log(`📁 Auditing: ${options.projectPath}`);
console.log(`📊 WCAG Level: ${options.wcagLevel}`);
console.log(`🔧 Auto-fix: ${options.autoFix ? 'enabled' : 'disabled'}`);
console.log(`📄 Output: ${options.outputFile}`);
console.log(`🎨 Framework: ${options.framework === 'auto' ? 'auto-detect' : options.framework}`);
console.log();

const prompt = buildPrompt(options);
const systemPrompt = buildSystemPrompt(options);

// Change to the project directory so relative paths work correctly
const originalCwd = process.cwd();
if (options.projectPath !== originalCwd) {
  process.chdir(options.projectPath);
}

const settings: Settings = {};

const allowedTools = [
  "Glob",
  "Grep",
  "Read",
  "Write",
  ...(options.autoFix ? ["Edit"] : []),
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": options.autoFix ? "acceptEdits" : "bypassPermissions",
  "append-system-prompt": systemPrompt,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✅ Accessibility audit complete!");
    console.log(`📄 Detailed report saved to: ${options.outputFile}`);

    if (!options.autoFix) {
      console.log("💡 Run with --fix to automatically apply fixes where possible");
    } else {
      console.log("✅ Automatic fixes have been applied");
    }

    console.log("\n🌐 For more accessibility resources:");
    console.log("   - https://www.w3.org/WAI/WCAG21/quickref/");
    console.log("   - https://webaim.org/resources/");
    console.log("   - https://www.a11yproject.com/");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Error running accessibility audit:", error);
  process.exit(1);
}
