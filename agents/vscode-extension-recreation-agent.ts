#!/usr/bin/env bun

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

import { query } from '@anthropic-ai/claude-agent-sdk';

interface ExtensionRecreationOptions {
  workspacePath: string;
  extensionName?: string;
  vsixPath?: string;
  outputFile: string;
  includeBrowserBundles: boolean;
}

async function runExtensionRecreationAgent(options: ExtensionRecreationOptions) {
  const {
    workspacePath,
    extensionName,
    vsixPath,
    outputFile,
    includeBrowserBundles,
  } = options;

  console.log('🧩 VS Code Extension Recreation Agent initialized.\n');
  console.log(`📂 Workspace: ${workspacePath}`);
  if (extensionName) {
    console.log(`🔍 Target extension: ${extensionName}`);
  }
  if (vsixPath) {
    console.log(`🗃️  VSIX archive: ${vsixPath}`);
  }
  console.log(`📝 Report target: ${outputFile}`);
  console.log(`🌐 Include browser/webview bundles: ${includeBrowserBundles}\n`);

  const prompt = `You are the "VS Code Extension Recreation Agent". Reverse-engineer an extension so a developer can recreate it.

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

  const result = query({
    prompt,
    options: {
      cwd: workspacePath,
      allowedTools: [
        'Glob',
        'Read',
        'Bash',
        'BashOutput',
        'Write',
        'Edit',
        'Grep',
        'WebFetch',
        'WebSearch',
      ],
      agents: {
        'extension-hunter': {
          description: 'Locates VS Code / Cursor extensions and ranks the best candidate to inspect.',
          tools: ['Glob', 'Read', 'Grep', 'Bash'],
          prompt: 'Scan the workspace (and optional VSIX archive) to identify extension manifests. Provide reasoning for selecting the target extension.',
          model: 'haiku',
        },
        'bundle-analyst': {
          description: 'Dissects bundled JavaScript to infer architecture, commands, and dependencies.',
          tools: ['Read', 'Grep', 'WebFetch'],
          prompt: 'Inspect bundled JS/CJS files, summarize activation flow, key classes, and bundler characteristics. Note import patterns and relevant APIs.',
          model: 'sonnet',
        },
        'rebuild-strategist': {
          description: 'Synthesizes recreation instructions and report structure.',
          tools: ['Write', 'Edit', 'Read'],
          prompt: 'Transform findings into a markdown blueprint with actionable steps to recreate the extension.',
          model: 'sonnet',
        },
      },
      maxTurns: 30,
      permissionMode: 'default',
      model: 'claude-sonnet-4-5-20250929',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  if (input.tool_name === 'Bash') {
                    const command = (input.tool_input as any)?.command ?? '';
                    if (command.includes('unzip') || command.includes('tar')) {
                      console.log('🧷 Extracting extension archive...');
                    }
                  }
                  if (input.tool_name === 'Write') {
                    console.log('📝 Compiling reverse-engineering report...');
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
                console.log('\n📗 Extension recreation guidance ready. Review the generated report.');
                return { continue: true };
              },
            ],
          },
        ],
      },
    },
  });

  let reportCreated = false;

  for await (const message of result) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          console.log(block.text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        reportCreated = true;
        console.log('\n✅ Extension analysis complete!');
        console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
        console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`🔢 Turns: ${message.num_turns}`);
        if (message.usage) {
          console.log(`📊 Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);
        }
      } else {
        console.error('\n❌ Extension analysis failed:', message.subtype);
      }
    }
  }

  if (!reportCreated) {
    console.warn('\n⚠️  No report was generated. Inspect agent output for diagnostics.');
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
VS Code Extension Recreation Agent

Usage:
  bun run agents/vscode-extension-recreation-agent.ts [options]

Options:
  --workspace <path>    Workspace to inspect (default: current directory)
  --extension <name>    Extension identifier (publisher.name) to prioritize
  --vsix <path>         Optional path to a .vsix archive to unpack and analyze
  --output <file>       Destination markdown report (default: extension-recreation-plan.md)
  --include-browser     Include browser/webview bundles in analysis
  --help                Show this message

Examples:
  # Reverse engineer any extension in the current workspace
  bun run agents/vscode-extension-recreation-agent.ts

  # Target a specific extension id within a monorepo
  bun run agents/vscode-extension-recreation-agent.ts --extension mypublisher.mycli

  # Analyze a downloaded VSIX archive and create a report
  bun run agents/vscode-extension-recreation-agent.ts --vsix ./extensions/theme.vsix --output recreate-theme.md
    `);
    process.exit(0);
  }

  let workspacePath = process.cwd();
  let extensionName: string | undefined;
  let vsixPath: string | undefined;
  let outputFile = 'extension-recreation-plan.md';
  let includeBrowserBundles = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--workspace':
        workspacePath = args[++i] ?? workspacePath;
        break;
      case '--extension':
        extensionName = args[++i];
        break;
      case '--vsix':
        vsixPath = args[++i];
        break;
      case '--output': {
        const outputArg = args[++i];
        if (outputArg) {
          outputFile = outputArg;
        }
        break;
      }
      case '--include-browser':
        includeBrowserBundles = true;
        break;
      default:
        if (arg && arg.startsWith('--')) {
          console.warn(`⚠️  Ignoring unknown option: ${arg}`);
        }
        break;
    }
  }

  runExtensionRecreationAgent({
    workspacePath,
    extensionName,
    vsixPath,
    outputFile,
    includeBrowserBundles,
  }).catch((error) => {
    console.error('❌ Fatal error during extension recreation analysis:', error);
    process.exit(1);
  });
}

export { runExtensionRecreationAgent };
