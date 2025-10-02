#!/usr/bin/env bun

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

import { query } from '@anthropic-ai/claude-agent-sdk';

interface ChromeExtensionRecreationOptions {
  workspacePath: string;
  extensionId?: string;
  crxPath?: string;
  outputFile: string;
  includeAssets: boolean;
}

async function runChromeExtensionRecreationAgent(options: ChromeExtensionRecreationOptions) {
  const {
    workspacePath,
    extensionId,
    crxPath,
    outputFile,
    includeAssets,
  } = options;

  console.log('🧭 Chrome Extension Recreation Agent ready.\n');
  console.log(`📂 Workspace: ${workspacePath}`);
  if (extensionId) {
    console.log(`🔍 Target extension hint: ${extensionId}`);
  }
  if (crxPath) {
    console.log(`🗃️  CRX archive: ${crxPath}`);
  }
  console.log(`📝 Report target: ${outputFile}`);
  console.log(`🖼️  Include static assets: ${includeAssets}\n`);

  const prompt = `You are the "Chrome Extension Recreation Agent". Reverse-engineer a Chrome extension so it can be rebuilt cleanly.

Workspace root: ${workspacePath}
${extensionId ? `Preferred extension id or folder: ${extensionId}` : ''}
${crxPath ? `CRX archive supplied: ${crxPath}` : ''}

Follow this workflow:
1. Locate candidate extension roots
   - Look for manifest.json files indicating Chrome/Chromium extensions.
   - Consider subdirectories under Extensions/, packages/, build/, dist/, etc.
   - If a CRX archive is provided, extract it first (strip CRX header then unzip; use Bash with "python3 - <<'PY'" helper if needed).
   - If multiple manifests are found, list them and justify the chosen target (prefer matches containing ${extensionId ?? 'the given id'}).
2. Inspect manifest & structure
   - Parse manifest.json (v2 or v3) to understand background, service worker, content scripts, options UI, action popups, declared permissions, host permissions, externally_connectable rules.
   - Map referenced scripts, html pages, and assets.
   - Determine build pipeline hints (e.g., webpack comments, source maps, TypeScript markers).
3. Bundle and script analysis
   - Examine background/service worker bundles, content scripts, and modules referenced by the manifest.
   - Identify key commands, messaging patterns, storage usage, network calls, declarative rules.
   - Note bundler signatures (webpack bootstrap, vite define, rollup closure, esbuild comments) and module organization.
   - Highlight dependencies embedded in bundles and any API usage (chrome.runtime, chrome.tabs, etc.).
${includeAssets ? '   - Review HTML/CSS assets for UI layout, frameworks, and localization.' : ''}
4. Recreation blueprint
   - Produce ${outputFile} in markdown with sections: Overview, Manifest Breakdown, Script & Module Map, Permissions & APIs, Build System Hypothesis, Step-by-step Recreation Plan, Testing & Packaging Checklist${includeAssets ? ', UI Assets Notes' : ''}.
   - Outline how to recreate the source layout (src/background, src/content, public/), essential npm dependencies, build commands, manifest scaffolding, and packaging steps (zip, web-ext, chrome web store upload).
   - Recommend tooling to de-minify bundles (source-map-explorer, chrome://inspect, webpack-bundle-analyzer) and how to restore readable code.
   - Provide verification steps (chrome --load-unpacked, automated tests, permission prompts checks).
5. Guardrails
   - Use Glob/Read/Bash to collect evidence, Write to emit the report, WebFetch/WebSearch only for public info (e.g., Chrome docs) if clarification is required.
   - Do not modify original extension files or run install/build commands that alter them.
   - Capture stderr from failed commands and supply troubleshooting advice.

Deliverable: A concise yet actionable reverse-engineering plan enabling a developer to rebuild the extension from scratch without copying code wholesale.`;

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
        'manifest-locator': {
          description: 'Finds Chrome extension manifests and selects the best candidate.',
          tools: ['Glob', 'Read', 'Grep', 'Bash'],
          prompt: 'Search for manifest.json files that belong to Chrome extensions, compare candidates, and pick the prime target with justification.',
          model: 'haiku',
        },
        'bundle-profiler': {
          description: 'Analyzes bundled JavaScript and infers architecture and APIs.',
          tools: ['Read', 'Grep', 'WebFetch'],
          prompt: 'Inspect background/content bundles to map modules, commands, permissions usage, and bundler fingerprints.',
          model: 'sonnet',
        },
        'recreation-planner': {
          description: 'Writes the reconstruction guide and validation checklist.',
          tools: ['Write', 'Edit', 'Read'],
          prompt: 'Synthesize findings into the requested markdown report with clear rebuild instructions and checks.',
          model: 'sonnet',
        },
      },
      permissionMode: 'default',
      maxTurns: 30,
      model: 'claude-sonnet-4-5-20250929',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.tool_name === 'Bash') {
                  const command = (input.tool_input as any)?.command ?? '';
                  if (command.includes('unzip') || command.includes('.crx')) {
                    console.log('📦 Extracting extension payload...');
                  }
                }
                if (input.tool_name === 'Write') {
                  console.log('📝 Assembling recreation blueprint...');
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
                console.log('\n📙 Chrome extension recreation guidance generated. Review the markdown report.');
                return { continue: true };
              },
            ],
          },
        ],
      },
    },
  });

  let reportGenerated = false;

  for await (const message of result) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          console.log(block.text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        reportGenerated = true;
        console.log('\n✅ Chrome extension analysis complete!');
        console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
        console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`🔢 Turns: ${message.num_turns}`);
        if (message.usage) {
          console.log(`📊 Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);
        }
      } else {
        console.error('\n❌ Chrome extension analysis failed:', message.subtype);
      }
    }
  }

  if (!reportGenerated) {
    console.warn('\n⚠️  No report generated. Inspect agent output for diagnostics.');
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Chrome Extension Recreation Agent

Usage:
  bun run agents/chrome-extension-recreation-agent.ts [options]

Options:
  --workspace <path>    Workspace or extraction directory to inspect (default: current directory)
  --extension <id>      Preferred extension id or folder name to analyze first
  --crx <path>          Optional .crx archive to unpack before analysis
  --output <file>       Destination markdown report (default: chrome-extension-recreation-plan.md)
  --include-assets      Include static assets (html/css/images) in deeper analysis
  --help                Show this help message

Examples:
  # Reverse engineer an unpacked extension in the current directory
  bun run agents/chrome-extension-recreation-agent.ts

  # Prioritize a specific extension folder contained in the workspace
  bun run agents/chrome-extension-recreation-agent.ts --extension abcd1234

  # Analyze a downloaded CRX and produce a custom report
  bun run agents/chrome-extension-recreation-agent.ts --crx ./my-ext.crx --output recreate-my-ext.md
    `);
    process.exit(0);
  }

  let workspacePath = process.cwd();
  let extensionId: string | undefined;
  let crxPath: string | undefined;
  let outputFile = 'chrome-extension-recreation-plan.md';
  let includeAssets = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--workspace':
        workspacePath = args[++i] ?? workspacePath;
        break;
      case '--extension':
        extensionId = args[++i];
        break;
      case '--crx':
        crxPath = args[++i];
        break;
      case '--output':
        outputFile = args[++i] ?? outputFile;
        break;
      case '--include-assets':
        includeAssets = true;
        break;
      default:
        if (arg.startsWith('--')) {
          console.warn(`⚠️  Ignoring unknown option: ${arg}`);
        }
        break;
    }
  }

  runChromeExtensionRecreationAgent({
    workspacePath,
    extensionId,
    crxPath,
    outputFile,
    includeAssets,
  }).catch((error) => {
    console.error('❌ Fatal error during chrome extension recreation analysis:', error);
    process.exit(1);
  });
}

export { runChromeExtensionRecreationAgent };
