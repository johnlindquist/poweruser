#!/usr/bin/env -S bun run

/**
 * Storybook Coverage Keeper Agent
 *
 * A practical everyday agent that keeps component libraries fully exercised in Storybook:
 * - Detects framework (React, Vue, Svelte) and Storybook configuration automatically
 * - Maps UI components to existing stories and flags missing or outdated coverage
 * - Checks CSF/MDX stories for interaction tests, controls, and accessibility annotations
 * - Highlights flaky or duplicate stories and suggests consolidation opportunities
 * - Generates coverage heatmaps (by directory, component type, and story variants)
 * - Offers ready-to-commit story stubs that follow the project's coding style
 * - Integrates with CI by exporting a markdown report and optional JSON summary for dashboards
 * - Perfect for teams who need confidence that every reusable component has a quality Storybook presence
 *
 * Usage:
 *   bun run agents/storybook-coverage-keeper.ts [project-path] [options]
 *
 * Examples:
 *   # Audit current directory
 *   bun run agents/storybook-coverage-keeper.ts
 *
 *   # Audit specific project
 *   bun run agents/storybook-coverage-keeper.ts ./my-ui-library
 *
 *   # Auto-generate missing story stubs
 *   bun run agents/storybook-coverage-keeper.ts --auto-stub
 *
 *   # Focus on specific component
 *   bun run agents/storybook-coverage-keeper.ts --component Button
 *
 *   # Custom report file
 *   bun run agents/storybook-coverage-keeper.ts --report coverage.md
 */

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface StorybookCoverageOptions {
  projectPath: string;
  storyDirs: string[];
  componentGlobs: string[];
  reportFile: string;
  autoStub: boolean;
  focusComponent?: string;
  includeMdx: boolean;
}

const DEFAULT_REPORT_FILE = "storybook-coverage-report.md";
const DEFAULT_STORY_DIRS = ["src", "apps"];
const DEFAULT_COMPONENT_GLOBS = [
  "src/components/**/*.{tsx,ts,jsx,js,vue,svelte}",
  "src/ui/**/*.{tsx,ts,jsx,js,vue,svelte}",
];

function printHelp(): void {
  console.log(`
📚 Storybook Coverage Keeper

Usage:
  bun run agents/storybook-coverage-keeper.ts [project-path] [options]

Arguments:
  project-path            Path to project root (default: current directory)

Options:
  --stories-dir <dirs>    Comma-separated story directories (default: ${DEFAULT_STORY_DIRS.join(", ")})
  --component-globs <globs> Comma-separated component patterns (default: src/components/**/*.{tsx,jsx,...})
  --report <file>         Output report file (default: ${DEFAULT_REPORT_FILE})
  --component <name>      Focus on specific component
  --auto-stub             Auto-generate missing story stubs
  --no-mdx                Exclude MDX stories from analysis
  --help, -h              Show this help

Examples:
  bun run agents/storybook-coverage-keeper.ts
  bun run agents/storybook-coverage-keeper.ts ./my-ui-library
  bun run agents/storybook-coverage-keeper.ts --auto-stub
  bun run agents/storybook-coverage-keeper.ts --component Button --report button-stories.md
  `);
}

function parseOptions(): StorybookCoverageOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawProjectPath = positionals[0];
  const projectPath = rawProjectPath ? resolve(rawProjectPath) : process.cwd();

  const storyDirValue = values["stories-dir"];
  const componentGlobValue = values["component-globs"];
  const reportValue = values.report;
  const focusComponent = values.component;
  const autoStub = values["auto-stub"] === true;
  const noMdx = values["no-mdx"] === true;

  const storyDirs = typeof storyDirValue === "string" && storyDirValue.length > 0
    ? storyDirValue.split(",").map((v) => v.trim()).filter(Boolean)
    : DEFAULT_STORY_DIRS;

  const componentGlobs = typeof componentGlobValue === "string" && componentGlobValue.length > 0
    ? componentGlobValue.split(",").map((v) => v.trim()).filter(Boolean)
    : DEFAULT_COMPONENT_GLOBS;

  const reportFile = typeof reportValue === "string" && reportValue.length > 0
    ? reportValue
    : DEFAULT_REPORT_FILE;

  return {
    projectPath,
    storyDirs,
    componentGlobs,
    reportFile,
    autoStub,
    focusComponent: typeof focusComponent === "string" && focusComponent.length > 0 ? focusComponent : undefined,
    includeMdx: !noMdx,
  };
}

function buildPrompt(options: StorybookCoverageOptions): string {
  return `Project root: ${options.projectPath}
Story directories to inspect: ${options.storyDirs.join(', ') || '(auto-detect)'}
Component glob patterns: ${options.componentGlobs.join(', ')}
Target component: ${options.focusComponent ?? 'All components'}
Auto stub missing stories: ${options.autoStub ? 'Yes' : 'No'}
Include MDX stories: ${options.includeMdx ? 'Yes' : 'No'}
Output report path: ${options.reportFile}

Objectives:
1. Detect Storybook configuration:
   - Locate main.js, manager.js, preview.js/ts files under .storybook/ or packages/*/.storybook/
   - Determine framework (React, Vue, Svelte, Web Components) and Storybook version
   - Identify story file naming patterns (CSF *.stories.tsx, *.stories.jsx, *.mdx)

2. Discover components:
   - Use Glob to enumerate components using the provided patterns
   - Filter out utility files (index.ts, barrel exports, test files, story files themselves)
   - Capture component meta data (path, exported component names, presence of default export)
   - When a specific component is requested, limit to files matching its name

3. Map stories to components:
   - Find all story files (*.stories.* and *.mdx if enabled)
   - Read story files to identify the component they reference (default export component, Meta object, import path)
   - Detect duplicate stories pointing to the same component from multiple locations
   - Flag stories that import non-existent components or reference removed props

4. Compute coverage insights:
   - Percentage of components with at least one story
   - Components missing stories, grouped by directory and priority (shared/ui > feature-specific)
   - Components with outdated stories (props mismatched, missing controls, interactions lacking play function)
   - Identify stories missing accessibility annotations (a11y addon), docs, or args tables
   - Summarize story density (stories per component, average number of variants)

5. Generate a markdown report saved to ${options.reportFile} with sections:
   # Storybook Coverage Report
   - Executive summary with coverage percentages and key risks
   - Coverage heatmap table (directory vs coverage %)
   - Missing stories section with actionable next steps
   - Outdated or flaky stories section with remediation guidance
   - Optional JSON appendix (embedded in fenced code block) that CI/CD can parse

6. If auto-stub is ${options.autoStub ? 'enabled' : 'disabled'}:
   ${options.autoStub ? `- Create CSF3 story stubs for missing components next to the component file (ComponentName.stories.tsx)
     Template requirements:
       * Default export with title derived from folder structure (e.g., "Components/Button")
       * Component import using relative path
       * Primary story with basic args example
       * Annotate with component-level parameters for controls and a11y
       * Respect existing project conventions (TypeScript vs JavaScript, strict mode, addons)
     - Use Write or MultiEdit to create new story files, avoiding overwriting existing stories
     - Provide TODO comments for authors to flesh out details` : '- Provide recommended file paths and stub templates but do not create files'}

7. Cross-check prop coverage:
   - Compare component prop definitions (TS interfaces, PropTypes, JS docs) with story args/controls
   - Highlight props lacking coverage or stories missing essential variations
   - Suggest new stories for edge cases (error states, loading states, responsive variants)

Execution guidelines:
- Use Glob for discovering files, Grep for quick matching, and Read for deeper analysis
- Prefer minimal file writes; never overwrite existing handcrafted stories
- When writing stubs, adhere to Prettier/eslint configuration if detected
- Surface any blockers (missing Storybook config, monorepo boundaries) in the report

Deliverables:
- Progress updates streamed to the user
- Markdown report written to ${options.reportFile}
- If auto-stub enabled, create new story files and summarize them in the report
- Celebrate completion with coverage metrics
`.trim();
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = [
    "stories-dir",
    "component-globs",
    "report",
    "component",
    "auto-stub",
    "no-mdx",
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

console.log("📚 Storybook Coverage Keeper\n");
console.log(`📁 Project: ${options.projectPath}`);
console.log(`📄 Report: ${options.reportFile}`);
console.log(`📂 Story directories: ${options.storyDirs.join(", ")}`);
console.log(`🎯 Component globs: ${options.componentGlobs.join(", ")}`);
if (options.focusComponent) {
  console.log(`🔍 Focus component: ${options.focusComponent}`);
}
console.log(`🧩 Include MDX stories: ${options.includeMdx ? "Yes" : "No"}`);
console.log(`🛠️  Auto-stub missing stories: ${options.autoStub ? "Enabled" : "Disabled"}`);
console.log("");

const systemPrompt = `You are the Storybook Coverage Keeper, an expert agent that audits component libraries to ensure Storybook completeness and quality.`;

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Glob",
  "Grep",
  "Read",
  "Write",
  ...(options.autoStub ? ["Edit", "MultiEdit"] : []),
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": options.autoStub ? "acceptEdits" : "bypassPermissions",
  "append-system-prompt": systemPrompt,
  ...(options.autoStub ? { "dangerously-skip-permissions": true } : {}),
};

// Change to project directory before running
const originalCwd = process.cwd();
process.chdir(options.projectPath);

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✅ Storybook coverage analysis complete!\n");
    console.log(`📄 Report saved to: ${options.reportFile}`);
    if (options.autoStub) {
      console.log("🪄 Story stubs generated for missing coverage. Review them before committing.");
    } else {
      console.log("💡 Run with --auto-stub to scaffold missing stories automatically.");
    }
    console.log("\nNext steps:");
    console.log("1. Review the coverage report");
    console.log("2. Check missing component stories");
    console.log("3. Verify generated story stubs (if auto-stub enabled)");
    console.log("4. Add interaction tests and accessibility annotations");
  }
  process.chdir(originalCwd);
  process.exit(exitCode);
} catch (error) {
  process.chdir(originalCwd);
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
