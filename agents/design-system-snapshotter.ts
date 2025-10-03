#!/usr/bin/env -S bun run

/**
 * Design System Snapshotter Agent
 *
 * Audits design exports (Figma, Sketch, tokens JSON, Storybook artifacts) to capture
 * component hierarchies, tokens, and assets, then documents how to rebuild the design
 * system from scratch.
 *
 * Usage:
 *   bun run agents/design-system-snapshotter.ts [options]
 *
 * Examples:
 *   # Analyze default ./design directory
 *   bun run agents/design-system-snapshotter.ts
 *
 *   # Point to a download dump and customize token globs
 *   bun run agents/design-system-snapshotter.ts --assets ../exports --token-files tokens/*.json,legacy/*.yaml
 */

import { resolve } from "node:path";
import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface DesignSnapshotOptions {
  assetPath: string;
  outputFile: string;
  componentLimit: number;
  tokenGlobs: string[];
}

function printHelp(): void {
  console.log(`
🎨 Design System Snapshotter

Usage:
  bun run agents/design-system-snapshotter.ts [options]

Options:
  --assets <path>       Directory containing design exports (default: ./design)
  --output <file>       Markdown report path (default: design-system-rebuild.md)
  --limit-components N  Maximum components to deep dive (default: 20)
  --token-files <glob>  Additional glob (comma separated) for token JSON files
  --help, -h            Show this help message

Examples:
  bun run agents/design-system-snapshotter.ts
  bun run agents/design-system-snapshotter.ts --assets ../exports
  bun run agents/design-system-snapshotter.ts --assets ../exports --token-files tokens/*.json,legacy/*.yaml
  `);
}

function parseOptions(): DesignSnapshotOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawAssets = values.assets;
  const assetPath =
    typeof rawAssets === "string" && rawAssets.length > 0
      ? resolve(rawAssets)
      : resolve("./design");

  const rawOutput = values.output;
  const outputFile =
    typeof rawOutput === "string" && rawOutput.length > 0
      ? rawOutput
      : "design-system-rebuild.md";

  const rawLimit = values["limit-components"] || values.limitComponents;
  let componentLimit = 20;
  if (typeof rawLimit === "string") {
    const parsed = Number(rawLimit);
    if (!Number.isNaN(parsed) && parsed > 0) {
      componentLimit = parsed;
    }
  } else if (typeof rawLimit === "number" && rawLimit > 0) {
    componentLimit = rawLimit;
  }

  const rawTokenFiles = values["token-files"] || values.tokenFiles;
  let tokenGlobs: string[] = [];
  if (typeof rawTokenFiles === "string" && rawTokenFiles.length > 0) {
    tokenGlobs = rawTokenFiles.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return {
    assetPath,
    outputFile,
    componentLimit,
    tokenGlobs,
  };
}

function buildPrompt(options: DesignSnapshotOptions): string {
  const { outputFile, componentLimit, tokenGlobs } = options;

  return `You are the "Design System Snapshotter". Analyze design exports in the current directory.

Objectives:
1. Asset inventory
   - Enumerate design artifacts: *.fig, *.sketch, *.xd, exported *.json token files, *.storyboard, *.storybook, *.mdx, icons (svg/png), typography specs.
   - Honor extra token globs: ${tokenGlobs.length > 0 ? tokenGlobs.join(", ") : "none supplied"}.
   - Note large binary files and suggest tooling (e.g. Figma tokens plugin, Sketchtool) required to inspect them.
2. Component mapping
   - Capture up to ${componentLimit} representative components.
   - For each, record name, variant axes, states, responsive behavior, and atomic composition.
   - Identify symbol/instance relationships from JSON exports or naming conventions.
3. Tokens & foundations
   - Extract color/typography/spacing tokens from JSON or text exports.
   - Flag missing token categories and deduce fallback values from assets when possible.
   - Outline how tokens map to components (e.g. Button uses color.primary.500, radius.sm).
4. Delivery pipelines
   - Detect Storybook builds, doc sites, or handoff files. Explain how they link to the design system.
   - Capture versioning info (Figma library ids, Sketch doc metadata) and handoff tooling (Zeplin, Abstract if hints appear).
5. Reconstruction guide
   - Produce a markdown report at ${outputFile} with sections: Overview, Asset Inventory, Component Catalog, Design Tokens, Supporting Workflows, Rebuild Plan, Verification Checklist.
   - For the rebuild plan, outline how to recreate component source (React/Vue/SwiftUI), token infrastructure (style-dictionary, tailwind config), documentation (Storybook/Docs), and review cadence.
   - Provide scripts/commands to extract tokens or sync assets (e.g. npx figma-export).
   - Suggest testing methodology (visual regression, screenshot diffs, accessibility checks).
6. Guardrails
   - Do not modify design assets.
   - When encountering proprietary formats (.fig, .sketch), catalog them and recommend extraction tools instead of trying to parse binary content directly.
   - Use Bash/Glob/Read/Grep/Write utilities only.

Deliverable: a comprehensive design-system reconstruction blueprint enabling engineers to reproduce the library from the audited assets.`.trim();
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🎨 Design System Snapshotter\n");
console.log(`📁 Asset directory: ${options.assetPath}`);
console.log(`🔢 Component deep-dive limit: ${options.componentLimit}`);
console.log(`📄 Token globs: ${options.tokenGlobs.length ? options.tokenGlobs.join(", ") : "(default)"}`);
console.log(`📝 Report target: ${options.outputFile}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Glob",
  "Read",
  "Grep",
  "Bash",
  "Write",
  "Edit",
  "BashOutput",
  "TodoWrite",
];

removeAgentFlags([
    "assets",
    "output",
    "limit-components",
    "limitComponents",
    "token-files",
    "tokenFiles",
    "help",
    "h",
  ]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "acceptEdits",
};

// Change working directory to asset path
const originalCwd = process.cwd();
process.chdir(options.assetPath);

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✅ Design system snapshot complete!\n");
    console.log("📘 Review the generated blueprint.");
    console.log("\nNext steps:");
    console.log("1. Review the design system rebuild plan");
    console.log("2. Extract tokens using suggested tools");
    console.log("3. Set up component infrastructure");
    console.log("4. Implement visual regression testing");
  }
  process.chdir(originalCwd);
  process.exit(exitCode);
} catch (error) {
  process.chdir(originalCwd);
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
