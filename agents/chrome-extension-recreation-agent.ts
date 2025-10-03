#!/usr/bin/env -S bun run

/**
 * Chrome Extension Recreation Agent
 *
 * Discovers a Chrome extension (directory, zip, or .crx), inspects bundled
 * JavaScript/background/content scripts, and produces a structured guide for
 * recreating the extension from scratch.
 *
 * Usage:
 *   bun run agents/chrome-extension-recreation-agent.ts [options]
 *
 * Options:
 *   --workspace <path>    Workspace or extraction directory to inspect (default: cwd)
 *   --extension <id>      Preferred extension id or folder name to analyze first
 *   --crx <path>          Optional .crx archive to unpack before analysis
 *   --output <file>       Destination markdown (default: chrome-extension-recreation-plan.md)
 *   --include-assets      Include static assets (html/css/images) in deep analysis
 *   --help                Show detailed usage
 */

import { resolve } from "node:path";
import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface ChromeExtensionRecreationOptions {
  workspacePath: string;
  extensionId?: string;
  crxPath?: string;
  outputFile: string;
  includeAssets: boolean;
}

function printHelp(): void {
  console.log(`
🧭 Chrome Extension Recreation Agent

Usage:
  bun run agents/chrome-extension-recreation-agent.ts [options]

Options:
  --workspace <path>    Workspace or extraction directory to inspect (default: current directory)
  --extension <id>      Preferred extension id or folder name to analyze first
  --crx <path>          Optional .crx archive to unpack before analysis
  --output <file>       Destination markdown report (default: chrome-extension-recreation-plan.md)
  --include-assets      Include static assets (html/css/images) in deeper analysis
  --help, -h            Show this help message

Examples:
  # Reverse engineer an unpacked extension in the current directory
  bun run agents/chrome-extension-recreation-agent.ts

  # Prioritize a specific extension folder contained in the workspace
  bun run agents/chrome-extension-recreation-agent.ts --extension abcd1234

  # Analyze a downloaded CRX and produce a custom report
  bun run agents/chrome-extension-recreation-agent.ts --crx ./my-ext.crx --output recreate-my-ext.md
  `);
}

function parseOptions(): ChromeExtensionRecreationOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const workspacePath = typeof values.workspace === "string" ? resolve(values.workspace) : process.cwd();
  const extensionId = typeof values.extension === "string" ? values.extension : undefined;
  const crxPath = typeof values.crx === "string" ? resolve(values.crx) : undefined;
  const outputFile = typeof values.output === "string" ? values.output : "chrome-extension-recreation-plan.md";
  const includeAssets = values["include-assets"] === true || values.includeAssets === true;

  return { workspacePath, extensionId, crxPath, outputFile, includeAssets };
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log('🧭 Chrome Extension Recreation Agent\n');
console.log(`Workspace: ${options.workspacePath}`);
if (options.extensionId) console.log(`Target hint: ${options.extensionId}`);
if (options.crxPath) console.log(`CRX archive: ${options.crxPath}`);
console.log(`Report: ${options.outputFile}`);
console.log(`Include assets: ${options.includeAssets}\n`);

const prompt = `You are the "Chrome Extension Recreation Agent". Reverse-engineer a Chrome extension so it can be rebuilt cleanly.

Workspace root: ${options.workspacePath}
${options.extensionId ? `Preferred extension id or folder: ${options.extensionId}` : ''}
${options.crxPath ? `CRX archive supplied: ${options.crxPath}` : ''}

Follow this workflow:
1. Locate candidate extension roots
   - Look for manifest.json files indicating Chrome/Chromium extensions.
   - Consider subdirectories under Extensions/, packages/, build/, dist/, etc.
   - If a CRX archive is provided, extract it first (strip CRX header then unzip; use Bash with "python3 - <<'PY'" helper if needed).
   - If multiple manifests are found, list them and justify the chosen target (prefer matches containing ${options.extensionId ?? 'the given id'}).
2. Inspect manifest & structure
   - Parse manifest.json (v2 or v3) to understand background, service worker, content scripts, options UI, action popups, declared permissions, host permissions, externally_connectable rules.
   - Map referenced scripts, html pages, and assets.
   - Determine build pipeline hints (e.g., webpack comments, source maps, TypeScript markers).
3. Bundle and script analysis
   - Examine background/service worker bundles, content scripts, and modules referenced by the manifest.
   - Identify key commands, messaging patterns, storage usage, network calls, declarative rules.
   - Note bundler signatures (webpack bootstrap, vite define, rollup closure, esbuild comments) and module organization.
   - Highlight dependencies embedded in bundles and any API usage (chrome.runtime, chrome.tabs, etc.).
${options.includeAssets ? '   - Review HTML/CSS assets for UI layout, frameworks, and localization.' : ''}
4. Recreation blueprint
   - Produce ${options.outputFile} in markdown with sections: Overview, Manifest Breakdown, Script & Module Map, Permissions & APIs, Build System Hypothesis, Step-by-step Recreation Plan, Testing & Packaging Checklist${options.includeAssets ? ', UI Assets Notes' : ''}.
   - Outline how to recreate the source layout (src/background, src/content, public/), essential npm dependencies, build commands, manifest scaffolding, and packaging steps (zip, web-ext, chrome web store upload).
   - Recommend tooling to de-minify bundles (source-map-explorer, chrome://inspect, webpack-bundle-analyzer) and how to restore readable code.
   - Provide verification steps (chrome --load-unpacked, automated tests, permission prompts checks).
5. Guardrails
   - Use Glob/Read/Bash to collect evidence, Write to emit the report, WebFetch/WebSearch only for public info (e.g., Chrome docs) if clarification is required.
   - Do not modify original extension files or run install/build commands that alter them.
   - Capture stderr from failed commands and supply troubleshooting advice.

Deliverable: A concise yet actionable reverse-engineering plan enabling a developer to rebuild the extension from scratch without copying code wholesale.`;

// Change to workspace directory
if (options.workspacePath !== process.cwd()) {
  process.chdir(options.workspacePath);
}

const settings: Settings = {};

const allowedTools = [
  "Task",
  "Glob",
  "Read",
  "Bash",
  "BashOutput",
  "Write",
  "Edit",
  "Grep",
  "WebFetch",
  "WebSearch",
  "TodoWrite",
];

removeAgentFlags([
    "workspace", "extension", "crx", "output", "include-assets", "includeAssets", "help", "h"
  ]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "default",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log('\n✅ Chrome extension recreation guide complete!');
    console.log(`📄 Report: ${options.outputFile}`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
