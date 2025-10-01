#!/usr/bin/env bun

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

import { query } from '@anthropic-ai/claude-agent-sdk';

type ArgValue = string | boolean;
interface ParsedArgs {
  flags: Record<string, ArgValue>;
  positionals: string[];
}

function parseArgs(args: string[]): ParsedArgs {
  const flags: Record<string, ArgValue> = {};
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (key) {
        if (value !== undefined) {
          flags[key] = value;
        } else {
          const nextArg = args[i + 1];
          if (nextArg && !nextArg.startsWith('-')) {
            flags[key] = nextArg;
            i++;
          } else {
            flags[key] = true;
          }
        }
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      if (key) {
        flags[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }

  return { flags, positionals };
}

const { flags, positionals } = parseArgs(process.argv.slice(2));

const PROJECT_PATH = positionals[0] || process.cwd();

// Parse CLI arguments
const WCAG_LEVEL = (flags.standard as string)?.toUpperCase() || 'AA';
const AUTO_FIX = !!flags.fix;
const OUTPUT_FILE = (flags.output as string) || 'a11y-report.md';
const FRAMEWORK = (flags.framework as string)?.toLowerCase() || 'auto';

if (flags.help || flags.h) {
  console.log(`
🌐 Accessibility Audit Helper

Comprehensive accessibility audit tool for web applications.

Usage:
  bun run agents/accessibility-audit-helper.ts [path] [options]

Arguments:
  path                      Project path to audit (default: current directory)

Options:
  --standard <AA|AAA>       WCAG conformance level (default: AA)
  --fix                     Automatically apply fixes where possible
  --output <file>           Output report file (default: a11y-report.md)
  --framework <react|vue|html>  Target framework (default: auto-detect)
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
  process.exit(0);
}

async function main() {
  console.log('🌐 Accessibility Audit Helper');
  console.log(`📁 Auditing: ${PROJECT_PATH}`);
  console.log(`📊 WCAG Level: ${WCAG_LEVEL}`);
  console.log(`🔧 Auto-fix: ${AUTO_FIX ? 'enabled' : 'disabled'}`);
  console.log(`📄 Output: ${OUTPUT_FILE}`);
  console.log(`🎨 Framework: ${FRAMEWORK === 'auto' ? 'auto-detect' : FRAMEWORK}`);
  console.log();

  const systemPrompt = `You are an accessibility audit expert specializing in WCAG ${WCAG_LEVEL} compliance. Your goal is to help developers create inclusive, accessible web applications.

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
   - Text contrast ratios (WCAG ${WCAG_LEVEL}: ${WCAG_LEVEL === 'AAA' ? '7:1 for normal text, 4.5:1 for large text' : '4.5:1 for normal text, 3:1 for large text'})
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
     FRAMEWORK === 'react' || FRAMEWORK === 'auto'
       ? `
   - React: Check for missing keys in lists
   - JSX: Validate accessibility props
   - React Router: Focus management on route changes
   - Custom components: Proper forwarding of aria props`
       : ''
   }
   ${
     FRAMEWORK === 'vue' || FRAMEWORK === 'auto'
       ? `
   - Vue: v-for keys for list items
   - Vue Router: Announce route changes
   - Custom components: Proper event handling`
       : ''
   }

${
  AUTO_FIX
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

  const prompt = `Perform a comprehensive accessibility audit on the web application at: ${PROJECT_PATH}

1. **Detect Framework & File Structure**
   - Use Glob to find component files: *.jsx, *.tsx, *.vue, *.html
   - Determine the framework from package.json and file extensions
   - Identify the component structure and entry points
   - Find style files that may contain color/contrast information

2. **Scan for Common Accessibility Issues**
   ${
     FRAMEWORK === 'react' || FRAMEWORK === 'auto'
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
   Create a markdown report (${OUTPUT_FILE}) with:

   # Accessibility Audit Report

   **WCAG ${WCAG_LEVEL} Compliance Check**

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
   ${AUTO_FIX ? '**Status**: ✅ Auto-fixed' : ''}

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
  AUTO_FIX
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

  try {
    const result = query({
      prompt,
      options: {
        cwd: PROJECT_PATH.startsWith('/') ? PROJECT_PATH : process.cwd(),
        systemPrompt,
        allowedTools: ['Glob', 'Grep', 'Read', 'Write', 'Edit'],
        permissionMode: AUTO_FIX ? 'acceptEdits' : 'bypassPermissions',
        model: 'sonnet',
        maxTurns: 20,
      },
    });

    for await (const message of result) {
      if (message.type === 'assistant') {
        // Show assistant progress
        for (const block of message.message.content) {
          if (block.type === 'text') {
            console.log(block.text);
          }
        }
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          console.log('\n✅ Accessibility audit complete!');
          console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
          console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(
            `📊 Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`
          );

          if (message.result) {
            console.log('\n' + message.result);
          }

          console.log(`\n📄 Detailed report saved to: ${OUTPUT_FILE}`);

          if (!AUTO_FIX) {
            console.log('💡 Run with --fix to automatically apply fixes where possible');
          } else {
            console.log('✅ Automatic fixes have been applied');
          }

          console.log('\n🌐 For more accessibility resources:');
          console.log('   - https://www.w3.org/WAI/WCAG21/quickref/');
          console.log('   - https://webaim.org/resources/');
          console.log('   - https://www.a11yproject.com/');
        } else {
          console.error('\n❌ Accessibility audit failed:', message.subtype);
          process.exit(1);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error running accessibility audit:', error);
    process.exit(1);
  }
}

main();
