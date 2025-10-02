#!/usr/bin/env -S bun run

/**
 * Import Cleanup Agent
 *
 * A practical everyday agent that keeps your imports pristine across the entire codebase:
 * - Scans all TypeScript/JavaScript/Python files to identify unused imports with high accuracy
 * - Detects duplicate imports and consolidates them into single statements
 * - Organizes imports by category: external packages, then internal modules, with blank lines between
 * - Alphabetically sorts imports within each category for consistency
 * - Fixes common import style issues: mixing default and named imports, inconsistent quote styles
 * - Identifies circular dependencies that could cause runtime issues
 * - Generates a report showing total lines of code cleaned up and files modified
 * - Perfect for keeping codebases tidy and passing strict linting rules without manual effort
 *
 * Usage:
 *   bun run agents/import-cleanup-agent.ts [project-path] [options]
 *
 * Examples:
 *   # Analyze current directory
 *   bun run agents/import-cleanup-agent.ts
 *
 *   # Analyze specific project
 *   bun run agents/import-cleanup-agent.ts /path/to/project
 *
 *   # Dry run (no changes)
 *   bun run agents/import-cleanup-agent.ts --dry-run
 *
 *   # Analyze with custom report name
 *   bun run agents/import-cleanup-agent.ts --report custom-report.md
 */

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface ImportCleanupOptions {
  projectPath: string;
  dryRun: boolean;
  reportFile: string;
}

const DEFAULT_REPORT_FILE = "IMPORT_CLEANUP_REPORT.md";

function printHelp(): void {
  console.log(`
🧹 Import Cleanup Agent

Usage:
  bun run agents/import-cleanup-agent.ts [project-path] [options]

Arguments:
  project-path            Path to project (default: current directory)

Options:
  --dry-run               Analyze only, don't modify files
  --report <file>         Output file (default: ${DEFAULT_REPORT_FILE})
  --help, -h              Show this help

Examples:
  bun run agents/import-cleanup-agent.ts
  bun run agents/import-cleanup-agent.ts /path/to/project
  bun run agents/import-cleanup-agent.ts --dry-run
  bun run agents/import-cleanup-agent.ts --report custom-report.md
  `);
}

function parseOptions(): ImportCleanupOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const projectPath = positionals[0] ? resolve(positionals[0]) : process.cwd();
  const dryRun = values["dry-run"] === true || values.dryRun === true;
  const rawReport = values.report;
  const reportFile = typeof rawReport === "string" && rawReport.length > 0
    ? rawReport
    : DEFAULT_REPORT_FILE;

  return {
    projectPath,
    dryRun,
    reportFile,
  };
}

const options = parseOptions();
if (!options) {
  process.exit(0);
}

function buildPrompt(options: ImportCleanupOptions): string {
  const { dryRun, reportFile } = options;

  return `Analyze and clean up imports across this codebase.

Follow these steps:

1. Discover all relevant files:
   - Use Glob to find: **/*.{ts,tsx,js,jsx} (for JavaScript/TypeScript projects)
   - Use Glob to find: **/*.py (for Python projects)
   - Exclude patterns: node_modules/**, dist/**, build/**, .next/**, out/**, coverage/**

2. Quick scan for import usage:
   - Use Grep to find all files containing import statements
   - Get a count of total files with imports
   - Identify which languages are used (TS/JS/Python)

3. Analyze each file systematically:
   - Read each file that contains imports
   - For each import statement, check if the imported names are used in the file
   - Look for usage patterns: function calls, JSX elements, type annotations, etc.
   - Track unused imports, duplicate imports, and organization issues

4. Categorize issues found:
   - **Unused imports:** Imports that are never referenced
   - **Duplicate imports:** Same module imported multiple times
   - **Organization issues:** Mixed external/internal, non-alphabetical
   - **Style issues:** Mixed quotes, missing blank lines
   - **Circular dependencies:** If detected, flag as warning

5. ${dryRun ? 'Document but DO NOT make changes' : 'Fix the imports'}:
   ${dryRun ? '- List all changes that WOULD be made' : '- Use MultiEdit to apply all import fixes to each file'}
   - Remove unused imports
   - Consolidate duplicate imports
   - Reorganize into proper groups with alphabetical sorting
   - Fix style inconsistencies
   - Add blank lines between groups

6. Generate a detailed report saved as '${reportFile}':

   # 🧹 Import Cleanup Report

   > Analysis performed on [date]${dryRun ? ' (DRY RUN MODE - No changes made)' : ''}

   ## 📊 Summary

   - **Files analyzed:** X files
   - **Files with imports:** Y files
   ${dryRun ? '- **Files that would be modified:** Z files' : '- **Files modified:** Z files'}
   - **Unused imports removed:** N imports
   - **Duplicate imports consolidated:** M imports
   - **Files reorganized:** K files
   - **Lines of code cleaned:** ~L lines

   ## 🔍 Issues Found

   ### Critical Issues (High Priority)
   1. **Unused Imports: X total**
      - These imports add noise and can confuse developers
      - Total lines that can be removed: ~Y lines

   2. **Duplicate Imports: X total**
      - Same modules imported multiple times in files
      - Can cause confusion and increase bundle size

   ### Style Issues (Medium Priority)
   1. **Unorganized Imports: X files**
      - Mixed external and internal imports
      - Non-alphabetical ordering

   2. **Style Inconsistencies: X files**
      - Mixed quote styles
      - Missing blank lines between groups

   ## 📝 Detailed Changes

   ${dryRun ? '### Changes that WOULD be made:' : '### Changes made:'}

   #### \`src/components/Button.tsx\`
   ${dryRun ? '**Would remove:**' : '**Removed:**'}
   - \`import { unused } from 'some-package'\` (never used)

   ${dryRun ? '**Would consolidate:**' : '**Consolidated:**'}
   \`\`\`typescript
   // Before
   import { foo } from 'package';
   import { bar } from 'package';

   // After
   import { bar, foo } from 'package';
   \`\`\`

   ${dryRun ? '**Would reorganize:**' : '**Reorganized:**'}
   \`\`\`typescript
   // Before
   import { Component } from './Component';
   import React from 'react';
   import { utils } from '@/utils';

   // After
   import React from 'react';

   import { utils } from '@/utils';

   import { Component } from './Component';
   \`\`\`

   [Repeat for each modified file with clear before/after examples]

   ## ⚠️ Warnings

   ### Potential Circular Dependencies
   - \`src/a.ts\` imports \`src/b.ts\` which imports \`src/a.ts\`
   - Consider refactoring to break the cycle

   ### Side Effect Imports Preserved
   - \`import './styles.css'\` - preserved (side effect)
   - \`import 'reflect-metadata'\` - preserved (side effect)

   ## 🎯 Recommendations

   ### Prevent Future Issues
   1. **Enable ESLint rules:**
      \`\`\`json
      {
        "rules": {
          "unused-imports/no-unused-imports": "error",
          "import/order": ["error", {
            "groups": ["builtin", "external", "internal", "parent", "sibling"],
            "newlines-between": "always",
            "alphabetize": { "order": "asc" }
          }]
        }
      }
      \`\`\`

   2. **Install helpful tools:**
      \`\`\`bash
      npm install -D eslint-plugin-unused-imports eslint-plugin-import
      \`\`\`

   3. **VS Code settings:**
      \`\`\`json
      {
        "editor.codeActionsOnSave": {
          "source.organizeImports": true
        }
      }
      \`\`\`

   4. **Pre-commit hook:**
      Consider adding a pre-commit hook to automatically organize imports

   ## 📈 Impact

   - **Code clarity:** Improved - easier to understand dependencies
   - **Bundle size:** Potential reduction if unused code was tree-shaken
   - **Linting:** Should pass import-related linting rules
   - **Maintenance:** Easier to maintain consistent import style

   ## 🚀 Next Steps

   ${dryRun ? '1. Review this report carefully\n   2. Run without --dry-run flag to apply changes: \`bun agents/import-cleanup-agent.ts\`\n   3. Test your application thoroughly\n   4. Commit the changes' : '1. Run your test suite to ensure nothing broke\n   2. Review the git diff to verify changes\n   3. Enable ESLint rules to maintain clean imports\n   4. Consider setting up automated import organization'}

   ---

   **Tip:** Run this agent periodically or as part of your CI pipeline to maintain clean imports!

Start by discovering all files, then analyze imports systematically, ${dryRun ? 'document the issues' : 'fix them'}, and generate the comprehensive cleanup report.`;
}

function buildSystemPrompt(options: ImportCleanupOptions): string {
  const { dryRun } = options;

  return `You are an Import Cleanup Agent that helps developers maintain clean and organized import statements.

Your task is to:
1. Find all TypeScript/JavaScript/Python files in the project:
   - Use Glob to find all .ts, .tsx, .js, .jsx, .py files
   - Exclude node_modules, dist, build, .next, out, and other build directories
   - Exclude test files if specified
   - Exclude vendor/third-party code

2. Analyze imports in each file:
   - Use Grep to quickly identify files with import statements
   - Read each file to analyze import structure
   - Identify unused imports by checking if imported names are used in the file
   - Detect duplicate imports (same module imported multiple times)
   - Find imports that can be consolidated
   - Check for circular dependencies

3. Detect import issues:
   - Unused imports (imported but never referenced)
   - Duplicate imports (same package/module imported multiple times)
   - Unorganized imports (mixed external and internal imports)
   - Non-alphabetical ordering within groups
   - Inconsistent quote styles (mixing single and double quotes)
   - Missing blank lines between import groups
   - Mixing default and named imports from same module
   - Type imports mixed with value imports (TypeScript)

4. Organize imports properly:
   - Group 1: External package imports (from node_modules)
   - Blank line
   - Group 2: Internal absolute imports (from @/ or ~/)
   - Blank line
   - Group 3: Relative imports (from ./ or ../)
   - Within each group: sort alphabetically by module name
   - For TypeScript: separate type imports if using type-only imports

5. Fix the imports:
   - Remove unused imports completely
   - Consolidate duplicate imports into single statements
   - Reorder imports according to the organization rules
   - Fix quote style inconsistencies (prefer single quotes unless project uses double)
   - Add proper blank lines between groups
   - Preserve any import side effects (imports without bindings)
   ${dryRun ? '- DO NOT USE Edit, MultiEdit, or Write tools to modify files (dry run mode)' : '- Use MultiEdit to apply all changes to each file efficiently'}

6. Generate a cleanup report:
   - Create a markdown report with all findings and changes
   - Show statistics: files analyzed, files modified, imports removed, imports reorganized
   - List all changes made to each file
   - Estimate lines of code saved
   - Provide recommendations for preventing future issues

Use Glob to find files, Grep to locate import statements, Read to analyze file contents, ${dryRun ? 'and Write to generate the report only' : 'MultiEdit to fix imports efficiently, and Write to generate the report'}.

IMPORTANT:
- Be careful not to break functional code - only remove imports that are truly unused
- Preserve import side effects (imports with no bindings like "import './styles.css'")
- Handle TypeScript type imports correctly (import type vs import)
- Don't modify files in node_modules or build directories
- Consider re-exports when checking for unused imports
- Preserve comments on the same line as imports when possible`;
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["dry-run", "dryRun", "report", "help", "h"] as const;

  for (const key of agentKeys) {
    if (key in values) {
      delete values[key];
    }
  }
}

console.log("🧹 Import Cleanup Agent\n");
console.log(`📁 Project: ${options.projectPath}`);
if (options.dryRun) {
  console.log("🔍 Running in DRY RUN mode (no files will be modified)");
}
console.log(`📄 Report: ${options.reportFile}`);
console.log("");

// Change to project directory
process.chdir(options.projectPath);

const prompt = buildPrompt(options);
const systemPrompt = buildSystemPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Glob",
  "Grep",
  "Read",
  "Write",
  "TodoWrite",
  ...(options.dryRun ? [] : ["Edit", "MultiEdit"]),
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
  "append-system-prompt": systemPrompt,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Import cleanup complete!\n");
    console.log(`📄 Full report: ${options.reportFile}`);
    if (options.dryRun) {
      console.log("🔍 This was a dry run - no files were modified");
      console.log("💡 Run without --dry-run to apply changes");
    } else {
      console.log("✅ All import issues have been fixed!");
      console.log("🧪 Remember to run your tests to verify nothing broke");
    }
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
