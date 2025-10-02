#!/usr/bin/env bun

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
 * Options:
 *   --assets <path>       Directory containing design exports (default: ./design)
 *   --output <file>       Markdown report path (default: design-system-rebuild.md)
 *   --limit-components N  Maximum components to deep-dive (default: 20)
 *   --token-files <glob>  Extra glob (comma separated) for token JSON files
 *   --help                Show usage information
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface DesignSnapshotOptions {
  assetPath: string;
  outputFile: string;
  componentLimit: number;
  tokenGlobs: string[];
}

async function runDesignSystemSnapshotter(options: DesignSnapshotOptions) {
  const { assetPath, outputFile, componentLimit, tokenGlobs } = options;

  console.log('🎨 Design System Snapshotter starting...\n');
  console.log(`📁 Asset directory: ${assetPath}`);
  console.log(`🔢 Component deep-dive limit: ${componentLimit}`);
  console.log(`📄 Token globs: ${tokenGlobs.length ? tokenGlobs.join(', ') : '(default)'}`);
  console.log(`📝 Report target: ${outputFile}\n`);

  const prompt = `You are the "Design System Snapshotter". Analyze design exports in ${assetPath}.

Objectives:
1. Asset inventory
   - Enumerate design artifacts: *.fig, *.sketch, *.xd, exported *.json token files, *.storyboard, *.storybook, *.mdx, icons (svg/png), typography specs.
   - Honor extra token globs: ${tokenGlobs.join(', ') || 'none supplied'}.
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

Deliverable: a comprehensive design-system reconstruction blueprint enabling engineers to reproduce the library from the audited assets.`;

  const result = query({
    prompt,
    options: {
      cwd: assetPath,
      allowedTools: ['Glob', 'Read', 'Grep', 'Bash', 'Write', 'Edit', 'BashOutput'],
      agents: {
        'asset-cartographer': {
          description: 'Maps available design artifacts and relevant metadata.',
          tools: ['Glob', 'Bash', 'Read'],
          prompt: 'Survey the asset directory, describe discovered files, and note tooling needed to inspect them.',
          model: 'haiku',
        },
        'component-analyst': {
          description: 'Examines component exports and token usage.',
          tools: ['Read', 'Grep', 'Bash'],
          prompt: 'Extract component structures, variant data, and token references from available exports.',
          model: 'sonnet',
        },
        'rebuild-designer': {
          description: 'Authors the design system rebuild plan and report.',
          tools: ['Write', 'Edit', 'Read'],
          prompt: 'Transform findings into a structured markdown guide covering overview, tokens, components, workflows, and rebuilding steps.',
          model: 'sonnet',
        },
      },
      permissionMode: 'acceptEdits',
      maxTurns: 26,
      model: 'claude-sonnet-4-5-20250929',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  if (input.tool_name === 'Write') {
                    console.log('📝 Compiling design system report...');
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
                console.log('\n📘 Design system snapshot complete. Review the generated blueprint.');
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
        console.log('\n✅ Design system analysis complete!');
        console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
        console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`🔢 Turns: ${message.num_turns}`);
        if (message.usage) {
          console.log(`📊 Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);
        }
      } else {
        console.error('\n❌ Snapshotter session failed:', message.subtype);
      }
    }
  }

  if (!reportGenerated) {
    console.warn('\n⚠️  No report produced. Inspect agent logs for details.');
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Design System Snapshotter Agent

Usage:
  bun run agents/design-system-snapshotter.ts [options]

Options:
  --assets <path>       Directory containing design exports (default: ./design)
  --output <file>       Markdown report path (default: design-system-rebuild.md)
  --limit-components N  Maximum components to deep dive (default: 20)
  --token-files <glob>  Additional glob (comma separated) for token JSON files
  --help                Show this help message

Examples:
  # Analyze default ./design directory
  bun run agents/design-system-snapshotter.ts

  # Point to a download dump and customize token globs
  bun run agents/design-system-snapshotter.ts --assets ../exports --token-files tokens/*.json,legacy/*.yaml
    `);
    process.exit(0);
  }

  let assetPath = './design';
  let outputFile = 'design-system-rebuild.md';
  let componentLimit = 20;
  let tokenGlobs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--assets':
        assetPath = args[++i] ?? assetPath;
        break;
      case '--output':
        outputFile = args[++i] ?? outputFile;
        break;
      case '--limit-components':
        {
          const value = Number(args[++i]);
          if (!Number.isNaN(value) && value > 0) {
            componentLimit = value;
          }
        }
        break;
      case '--token-files': {
        const tokenArg = args[++i];
        tokenGlobs = (tokenArg || '').split(',').map((item) => item.trim()).filter(Boolean);
        break;
      }
      default:
        if (arg && arg.startsWith('--')) {
          console.warn(`⚠️  Ignoring unknown option: ${arg}`);
        }
        break;
    }
  }

  runDesignSystemSnapshotter({ assetPath, outputFile, componentLimit, tokenGlobs }).catch((error) => {
    console.error('❌ Fatal error during design system snapshot:', error);
    process.exit(1);
  });
}

export { runDesignSystemSnapshotter };
