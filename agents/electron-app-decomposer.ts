#!/usr/bin/env bun

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
 *   --help                Show usage information
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface ElectronDecomposerOptions {
  appPath: string;
  appNamePatterns: string[];
  asarPath?: string;
  outputFile: string;
  includeAssets: boolean;
}

async function runElectronAppDecomposer(options: ElectronDecomposerOptions) {
  const { appPath, appNamePatterns, asarPath, outputFile, includeAssets } = options;

  console.log('⚡ Electron App Decomposer engaged.\n');
  console.log(`📁 App search path: ${appPath}`);
  console.log(`🎯 Name patterns: ${appNamePatterns.length ? appNamePatterns.join(', ') : '(none)'}`);
  if (asarPath) {
    console.log(`🗃️  Provided asar: ${asarPath}`);
  }
  console.log(`📝 Report target: ${outputFile}`);
  console.log(`🖼️  Include renderer assets: ${includeAssets}\n`);

  const prompt = `You are the "Electron App Decomposer". Reverse-engineer an Electron app located under ${appPath}.

Mandate:
1. Locate candidate apps
   - Search for *.app bundles (macOS) or directories with resources/app.asar.
   - Apply name filters: ${appNamePatterns.join(', ') || 'no filters provided'}.
   - If a specific asar is supplied (${asarPath ?? 'none'}), prioritize it.
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
${includeAssets ? '   - Review static assets (html/css/images) to understand UI layout and theming.' : ''}
4. Distribution & auto-update
   - Look for update URLs, Squirrel, NSIS, auto-update config, code signing hints.
   - Note platform-specific binaries (dylib, node_modules/*.node).
5. Recreation plan
   - Produce ${outputFile} with sections: Overview, App Structure, Main Process, Renderer Architecture, Build & Packaging Pipeline, Rebuild Instructions, Testing & Hardening Checklist${includeAssets ? ', UI Assets Review' : ''}.
   - Outline steps to recreate the project (initialize package.json, add dependencies, set up bundler configs, package builds).
   - Provide commands for unpacking/repacking asar, running dev mode, packaging installers.
   - Highlight security best practices (context isolation, CSP, auto-update verification).
6. Guardrails
   - Do not modify original app files.
   - Use Bash/Node tools read-only (asar extract should write to temp directories you create).
   - Capture errors (missing asar module, permission issues) and provide remedies.

Tools allowed: Bash, BashOutput, Read, Write, Edit, Glob, Grep, WebFetch.`;

  const result = query({
    prompt,
    options: {
      cwd: appPath,
      allowedTools: ['Glob', 'Read', 'Bash', 'BashOutput', 'Write', 'Edit', 'Grep', 'WebFetch'],
      agents: {
        'app-scout': {
          description: 'Finds Electron app bundles and associated asar archives.',
          tools: ['Glob', 'Bash', 'Read'],
          prompt: 'Locate candidate Electron apps, apply name filters, and surface metadata for the best target.',
          model: 'haiku',
        },
        'bundle-archaeologist': {
          description: 'Examines main/preload/renderer bundles for architecture and tooling clues.',
          tools: ['Read', 'Grep', 'Bash', 'WebFetch'],
          prompt: 'Inspect extracted files to understand the app structure, Electron APIs, and build toolchain.',
          model: 'sonnet',
        },
        'rebuild-drafter': {
          description: 'Writes the Electron rebuild blueprint.',
          tools: ['Write', 'Edit', 'Read'],
          prompt: 'Document findings in markdown with actionable steps to rebuild the Electron app.',
          model: 'sonnet',
        },
      },
      permissionMode: 'acceptEdits',
      maxTurns: 30,
      model: 'claude-sonnet-4-5-20250929',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  if (input.tool_name === 'Bash') {
                    const command = (input.tool_input as any)?.command ?? '';
                    if (command.includes('asar') || command.includes('npx asar')) {
                      console.log('📦 Extracting asar archive...');
                    }
                  }
                  if (input.tool_name === 'Write') {
                    console.log('📝 Authoring Electron rebuild report...');
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
                console.log('\n📕 Electron decomposition complete. Consult the markdown report for action items.');
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
        console.log('\n✅ Electron app analysis complete!');
        console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
        console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`🔢 Turns: ${message.num_turns}`);
        if (message.usage) {
          console.log(`📊 Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);
        }
      } else {
        console.error('\n❌ Electron decomposition failed:', message.subtype);
      }
    }
  }

  if (!reportGenerated) {
    console.warn('\n⚠️  No report generated. Inspect agent logs for troubleshooting.');
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Electron App Decomposer Agent

Usage:
  bun run agents/electron-app-decomposer.ts [options]

Options:
  --app-path <path>     Directory containing Electron apps or resources (default: /Applications)
  --app-name <name>     Comma-separated app names or globs to prioritize
  --asar <file>         Specific app.asar file to analyze
  --output <file>       Markdown report path (default: electron-app-rebuild.md)
  --include-assets      Include renderer asset deep dive
  --help                Show this help message

Examples:
  # Survey Electron apps in /Applications
  bun run agents/electron-app-decomposer.ts

  # Focus on Slack and Notion
  bun run agents/electron-app-decomposer.ts --app-name Slack,Notion

  # Analyze a custom app.asar and write report to docs/
  bun run agents/electron-app-decomposer.ts --asar ./dist/app.asar --output ./docs/rebuild.md
    `);
    process.exit(0);
  }

  let appPath = '/Applications';
  let appNamePatterns: string[] = [];
  let asar: string | undefined;
  let outputFile = 'electron-app-rebuild.md';
  let includeAssets = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--app-path':
        appPath = args[++i] ?? appPath;
        break;
      case '--app-name':
        appNamePatterns = (args[++i] ?? '').split(',').map((item) => item.trim()).filter(Boolean);
        break;
      case '--asar':
        asar = args[++i];
        break;
      case '--output': {
        const outputArg = args[++i];
        if (outputArg) {
          outputFile = outputArg;
        }
        break;
      }
      case '--include-assets':
        includeAssets = true;
        break;
      default:
        if (arg && arg.startsWith('--')) {
          console.warn(`⚠️  Ignoring unknown option: ${arg}`);
        }
        break;
    }
  }

  runElectronAppDecomposer({
    appPath,
    appNamePatterns,
    asarPath: asar,
    outputFile,
    includeAssets,
  }).catch((error) => {
    console.error('❌ Fatal error during Electron app decomposition:', error);
    process.exit(1);
  });
}

export { runElectronAppDecomposer };
