#!/usr/bin/env -S bun run

/**
 * VS Code Extension Recreation Agent
 *
 * Tracks down a VS Code or Cursor extension within a workspace (or .vsix archive),
 * inspects its bundled JavaScript artifacts, and produces a reverse-engineering
 * playbook describing how to recreate the extension from scratch.
 *
 * Usage:
 *   bun run agents/vscode-extension-recreation-agent.ts [options]
 *
 * Options:
 *   --workspace <path>    Workspace to inspect (default: current directory)
 *   --extension <name>    Extension identifier (publisher.name) to prioritize
 *   --vsix <path>         Optional path to a .vsix archive to unpack and analyze
 *   --output <file>       Destination markdown report (default: extension-recreation-plan.md)
 *   --include-browser     Include browser/webview bundles in analysis (default: false)
 *   --help                Show usage information
 */

import { resolve } from "node:path";
import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface ExtensionRecreationOptions {
  workspacePath: string;
  extensionName?: string;
  vsixPath?: string;
  outputFile: string;
  includeBrowserBundles: boolean;
}

const DEFAULT_OUTPUT_FILE = "extension-recreation-plan.md";

function printHelp(): void {
  console.log(`
🧩 VS Code Extension Recreation Agent

Usage:
  bun run agents/vscode-extension-recreation-agent.ts [options]

Options:
  --workspace <path>    Workspace to inspect (default: current directory)
  --extension <name>    Extension identifier (publisher.name) to prioritize
  --vsix <path>         Optional path to a .vsix archive to unpack and analyze
  --output <file>       Destination markdown report (default: ${DEFAULT_OUTPUT_FILE})
  --include-browser     Include browser/webview bundles in analysis
  --help, -h            Show this help

Examples:
  # Reverse engineer any extension in the current workspace
  bun run agents/vscode-extension-recreation-agent.ts

  # Target a specific extension id within a monorepo
  bun run agents/vscode-extension-recreation-agent.ts --extension mypublisher.mycli

  # Analyze a downloaded VSIX archive and create a report
  bun run agents/vscode-extension-recreation-agent.ts --vsix ./extensions/theme.vsix --output recreate-theme.md
  `);
}

function parseOptions(): ExtensionRecreationOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawWorkspace = values.workspace;
  const workspacePath = typeof rawWorkspace === "string" && rawWorkspace.length > 0
    ? resolve(rawWorkspace)
    : process.cwd();

  const extensionName = typeof values.extension === "string" && values.extension.length > 0
    ? values.extension
    : undefined;

  const vsixPath = typeof values.vsix === "string" && values.vsix.length > 0
    ? resolve(values.vsix)
    : undefined;

  const rawOutput = values.output;
  const outputFile = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : DEFAULT_OUTPUT_FILE;

  const includeBrowserBundles = values["include-browser"] === true || values.includeBrowser === true;

  return {
    workspacePath,
    extensionName,
    vsixPath,
    outputFile,
    includeBrowserBundles,
  };
}

function buildPrompt(options: ExtensionRecreationOptions): string {
  const {
    workspacePath,
    extensionName,
    vsixPath,
    outputFile,
    includeBrowserBundles,
  } = options;

  return `You are the "VS Code Extension Recreation Agent". Reverse-engineer an extension so a developer can recreate it.

Workspace root: ${workspacePath}
${extensionName ? `Preferred extension id: ${extensionName}` : ''}
${vsixPath ? `VSIX archive supplied: ${vsixPath}` : ''}

Required workflow:
1. Extension discovery
   - Scan the workspace (and optionally the VSIX archive) for VS Code or Cursor extensions.
   - Recognize extensions by locating package.json files with an "engines.vscode" or "engines.cursor" field.
   - If an explicit extension id is provided, prioritize matches whose package.json name matches ${extensionName ?? 'the requested id'}.
   - Handle multiple matches: list them, justify the primary target, and continue with the best candidate.
2. Artifact extraction
   - Identify bundles in dist/, out/, build/, or packaged directories (look for *.js, *.cjs, *.mjs, and map files).
   - If a VSIX archive is supplied, unzip it to a temporary directory using the Bash tool before analysis.
   - Highlight entry points declared in package.json (main, browser, activationEvents, contributes).
   - ${includeBrowserBundles ? 'Include webview/browser assets (js/css) in the investigation.' : 'Focus on Node-side activation bundles; mention webview assets only if critical.'}
3. Bundle analysis
   - Inspect bundled JavaScript to determine module structure, important classes/registrations, command ids, and activation flows.
   - Note evidence of bundlers (esbuild, webpack, rollup) from wrapper signatures and comment headers.
   - Capture dependency fingerprints (imports, third-party libraries, notable npm packages embedded in the bundle).
4. Recreation blueprint
   - Produce a markdown report saved to ${outputFile} in the workspace root.
   - Sections must include: Overview, File & Bundle Map, Activation & Commands, Key APIs & Features, Build Tooling Guess, Step-by-step Recreation Plan, Verification Checklist.
   - Outline how to rebuild the project structure (src folders, tsconfig, package.json), dependencies to install, build scripts to add, and how to reproduce contribution points.
   - Provide guidance on de-minifying bundled code: naming conventions, source maps (if present), and recommended tooling.
   - Suggest testing methodology (extension development host, Cursor specific checks if applicable).
5. Guardrails
   - Do not modify the original extension files except when extracting metadata to read.
   - Use Bash for unzip/tar commands, Read for inspection, Glob for discovery, and Write to save the final report.
   - When commands fail (missing npm, corrupted VSIX), capture stderr and recommend troubleshooting steps.

Deliverable: A concise but comprehensive reverse-engineering plan enabling a developer to recreate the extension without copying code verbatim.`;
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log('🧩 VS Code Extension Recreation Agent\n');
console.log(`📂 Workspace: ${options.workspacePath}`);
if (options.extensionName) {
  console.log(`🔍 Target extension: ${options.extensionName}`);
}
if (options.vsixPath) {
  console.log(`🗃️  VSIX archive: ${options.vsixPath}`);
}
console.log(`📝 Report target: ${options.outputFile}`);
console.log(`🌐 Include browser/webview bundles: ${options.includeBrowserBundles}\n`);

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
  "WebSearch",
  "TodoWrite",
];

removeAgentFlags([
    "workspace", "extension", "vsix", "output", "include-browser", "includeBrowser", "help", "h"
  ]);

// Change to workspace directory before running Claude
const originalCwd = process.cwd();
process.chdir(options.workspacePath);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "default",
};

try {
  const exitCode = await claude(prompt, defaultFlags);

  // Restore original working directory
  process.chdir(originalCwd);

  if (exitCode === 0) {
    console.log("\n✅ Extension analysis complete!");
    console.log(`📄 Full report: ${options.outputFile}`);
    console.log("\nNext steps:");
    console.log("1. Review the recreation plan");
    console.log("2. Set up project structure as outlined");
    console.log("3. Install dependencies and configure build tools");
    console.log("4. Implement features step by step");
    console.log("5. Test in extension development host");
  }
  process.exit(exitCode);
} catch (error) {
  process.chdir(originalCwd);
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
