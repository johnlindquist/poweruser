#!/usr/bin/env -S bun run

/**
 * Electron App Decomposer Agent
 *
 * Inspects an Electron application directory (or .asar bundle) to understand its
 * architecture, extract bundled JavaScript, and author a rebuild playbook.
 *
 * Usage:
 *   bun run agents/electron-app-decomposer.ts [options]
 *
 * Options:
 *   --app-path <path>     Path to Electron app bundle or resources directory (default: /Applications)
 *   --app-name <name>     App name or glob to prioritize (e.g. Slack,Notion)
 *   --asar <file>         Explicit path to app.asar to analyze
 *   --output <file>       Markdown report path (default: electron-app-rebuild.md)
 *   --include-assets      Include deep dive on renderer assets (html/css/images)
 *   --help, -h            Show usage information
 *
 * Examples:
 *   # Survey Electron apps in /Applications
 *   bun run agents/electron-app-decomposer.ts
 *
 *   # Focus on Slack and Notion
 *   bun run agents/electron-app-decomposer.ts --app-name Slack,Notion
 *
 *   # Analyze a custom app.asar and write report to docs/
 *   bun run agents/electron-app-decomposer.ts --asar ./dist/app.asar --output ./docs/rebuild.md
 */

import { resolve } from "node:path";
import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

const DEFAULT_APP_PATH = "/Applications";
const DEFAULT_OUTPUT_FILE = "electron-app-rebuild.md";

interface ElectronDecomposerOptions {
  appPath: string;
  appNamePatterns: string[];
  asarPath?: string;
  outputFile: string;
  includeAssets: boolean;
}

function printHelp(): void {
  console.log(`
⚡ Electron App Decomposer

Usage:
  bun run agents/electron-app-decomposer.ts [options]

Options:
  --app-path <path>     Directory containing Electron apps or resources (default: ${DEFAULT_APP_PATH})
  --app-name <name>     Comma-separated app names or globs to prioritize
  --asar <file>         Specific app.asar file to analyze
  --output <file>       Markdown report path (default: ${DEFAULT_OUTPUT_FILE})
  --include-assets      Include renderer asset deep dive
  --help, -h            Show this help message

Examples:
  # Survey Electron apps in /Applications
  bun run agents/electron-app-decomposer.ts

  # Focus on Slack and Notion
  bun run agents/electron-app-decomposer.ts --app-name Slack,Notion

  # Analyze a custom app.asar and write report to docs/
  bun run agents/electron-app-decomposer.ts --asar ./dist/app.asar --output ./docs/rebuild.md
  `);
}

function parseOptions(): ElectronDecomposerOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawAppPath = values["app-path"];
  const rawAppName = values["app-name"];
  const rawAsar = values.asar;
  const rawOutput = values.output;
  const includeAssets = values["include-assets"] === true;

  const appPath = typeof rawAppPath === "string" && rawAppPath.length > 0
    ? resolve(rawAppPath)
    : DEFAULT_APP_PATH;

  const appNamePatterns = typeof rawAppName === "string" && rawAppName.length > 0
    ? rawAppName.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

  const asarPath = typeof rawAsar === "string" && rawAsar.length > 0
    ? resolve(rawAsar)
    : undefined;

  const outputFile = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : DEFAULT_OUTPUT_FILE;

  return {
    appPath,
    appNamePatterns,
    asarPath,
    outputFile,
    includeAssets,
  };
}

function buildPrompt(options: ElectronDecomposerOptions): string {
  const { appPath, appNamePatterns, asarPath, outputFile, includeAssets } = options;

  return `You are the "Electron App Decomposer". Reverse-engineer an Electron app located under ${appPath}.

Mandate:
1. Locate candidate apps
   - Search for *.app bundles (macOS) or directories with resources/app.asar.
   - Apply name filters: ${appNamePatterns.join(", ") || "no filters provided"}.
   - If a specific asar is supplied (${asarPath ?? "none"}), prioritize it.
2. Artifact extraction
   - Identify Electron version (package.json, package.lock or asar metadata).
   - If needed, use Bash to run \`npx asar extract\` or node scripts to unpack app.asar into a temporary directory.
   - Enumerate main process, preload, and renderer bundles.
3. Code & architecture analysis
   - Inspect main process entry (main.js) for BrowserWindow configuration, IPC setup, native modules, auto-updater.
   - Map preload scripts and security posture (contextIsolation, enableRemoteModule, sandbox options).
   - Analyze renderer bundles: frameworks (React/Vue/Svelte), state management, routing.
   - Detect packager (electron-builder, forge, vite, webpack) from config files or bundle fingerprints.
   - Catalog dependencies (package.json, yarn.lock) and native modules requiring rebuild.
${includeAssets ? "   - Review static assets (html/css/images) to understand UI layout and theming." : ""}
4. Distribution & auto-update
   - Look for update URLs, Squirrel, NSIS, auto-update config, code signing hints.
   - Note platform-specific binaries (dylib, node_modules/*.node).
5. Recreation plan
   - Produce ${outputFile} with sections: Overview, App Structure, Main Process, Renderer Architecture, Build & Packaging Pipeline, Rebuild Instructions, Testing & Hardening Checklist${includeAssets ? ", UI Assets Review" : ""}.
   - Outline steps to recreate the project (initialize package.json, add dependencies, set up bundler configs, package builds).
   - Provide commands for unpacking/repacking asar, running dev mode, packaging installers.
   - Highlight security best practices (context isolation, CSP, auto-update verification).
6. Guardrails
   - Do not modify original app files.
   - Use Bash/Node tools read-only (asar extract should write to temp directories you create).
   - Capture errors (missing asar module, permission issues) and provide remedies.

Tools allowed: Bash, BashOutput, Read, Write, Edit, Glob, Grep, WebFetch, TodoWrite.`;
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("⚡ Electron App Decomposer engaged.\n");
console.log(`📁 App search path: ${options.appPath}`);
console.log(`🎯 Name patterns: ${options.appNamePatterns.length ? options.appNamePatterns.join(", ") : "(none)"}`);
if (options.asarPath) {
  console.log(`🗃️  Provided asar: ${options.asarPath}`);
}
console.log(`📝 Report target: ${options.outputFile}`);
console.log(`🖼️  Include renderer assets: ${options.includeAssets}\n`);

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Glob",
  "Read",
  "Bash",
  "BashOutput",
  "Write",
  "Edit",
  "Grep",
  "WebFetch",
  "TodoWrite",
];

removeAgentFlags([
    "app-path", "app-name", "asar", "output", "include-assets", "help", "h"
  ]);

const systemPrompt = `You have access to three specialized agents:
- app-scout (haiku): Finds Electron app bundles and associated asar archives. Locate candidate Electron apps, apply name filters, and surface metadata for the best target.
- bundle-archaeologist (sonnet): Examines main/preload/renderer bundles for architecture and tooling clues. Inspect extracted files to understand the app structure, Electron APIs, and build toolchain.
- rebuild-drafter (sonnet): Writes the Electron rebuild blueprint. Document findings in markdown with actionable steps to rebuild the Electron app.`;

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "acceptEdits",
  "append-system-prompt": systemPrompt,
};

// Change to app path working directory
const originalCwd = process.cwd();
try {
  process.chdir(options.appPath);
} catch (error) {
  console.error(`❌ Failed to change to app path: ${options.appPath}`);
  console.error(error);
  process.exit(1);
}

try {
  const exitCode = await claude(prompt, defaultFlags);

  // Restore original working directory
  process.chdir(originalCwd);

  if (exitCode === 0) {
    console.log("\n📕 Electron decomposition complete. Consult the markdown report for action items.");
    console.log(`📄 Report: ${options.outputFile}`);
    console.log("\nNext steps:");
    console.log("1. Review the analysis in the markdown report");
    console.log("2. Follow the rebuild instructions");
    console.log("3. Test the recreated application");
    console.log("4. Verify security best practices");
  }
  process.exit(exitCode);
} catch (error) {
  // Restore original working directory on error
  process.chdir(originalCwd);
  console.error("❌ Fatal error during Electron app decomposition:", error);
  process.exit(1);
}
