#!/usr/bin/env bun

/**
 * CLI Utility Reconstructor Agent
 *
 * Surveys command-line binaries living in a directory (e.g. /usr/local/bin or a project’s bin/ folder),
 * inspects their help output and supporting resources, then writes a blueprint that explains how to rebuild
 * each utility from source.
 *
 * Usage:
 *   bun run agents/cli-utility-reconstructor.ts [options]
 *
 * Options:
 *   --bin-path <path>      Directory that holds CLI binaries (default: /usr/local/bin)
 *   --focus <name>         Prioritize matching binaries (comma-separated patterns)
 *   --max-commands <num>   Limit number of CLIs to inspect (default: 5)
 *   --output <file>        Markdown report path (default: cli-utility-rebuild-plan.md)
 *   --dry-run              Skip writing the report; print findings to stdout
 *   --help                 Show usage information
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface CliReconstructorOptions {
  binPath: string;
  focusPatterns: string[];
  maxCommands: number;
  outputFile: string;
  dryRun: boolean;
}

async function runCliUtilityReconstructor(options: CliReconstructorOptions) {
  const { binPath, focusPatterns, maxCommands, outputFile, dryRun } = options;

  console.log('🛠️  CLI Utility Reconstructor ready.\n');
  console.log(`📁 Binary directory: ${binPath}`);
  console.log(`🎯 Focus patterns: ${focusPatterns.length ? focusPatterns.join(', ') : '(none)'}`);
  console.log(`🔢 Command limit: ${maxCommands}`);
  console.log(`📝 Report target: ${outputFile}`);
  console.log(`🧪 Dry run: ${dryRun}\n`);

  const prompt = `You are the "CLI Utility Reconstructor". Inspect command-line binaries located at ${binPath}.

Mission:
1. Discovery
   - List executable files in ${binPath} (respect focus patterns: ${focusPatterns.join(', ') || 'none provided'}).
   - Filter out obvious symlinks to system tools unless explicitly targeted.
   - Limit to ${maxCommands} utilities; pick representative variety (languages, packaging styles).
2. Baseline intelligence
   - For each chosen CLI, run \`<command> --help\` (or -h) to capture capabilities.
   - Detect interpreter or build origin using \`file <command>\`, \`ldd\` or shebang inspection.
   - If the binary is a script, read its source; if compiled, infer language/toolchain from metadata.
   - Locate adjoining resources (man pages, config files, libexec directories).
3. Reverse-engineering notes
   - Identify dependency graph: libraries linked, npm/pip crates referenced, etc.
   - Determine packaging/distribution style (Homebrew formula, npm package, pip install). If Homebrew owned, inspect formula with \`brew info <name> --json\` when available.
   - Extract version info via \`<command> --version\`.
4. Reconstruction plan
   - Produce ${dryRun ? 'a console summary' : `a markdown report at ${outputFile}`} with sections per CLI containing:
     * Overview & primary purpose
     * Observed command structure and flags
     * Implementation clues (language, frameworks, static vs dynamic linking)
     * Dependencies and build prerequisites
     * Step-by-step rebuild instructions (scaffolding project, source layout, build commands)
     * Verification & packaging checklist (tests, distribution, docs)
   - Include an appendix describing shared patterns across all analyzed CLIs.
5. Guardrails
   - Avoid executing commands that alter the system (read-only inspection only).
   - Capture stderr for commands that fail and provide hypotheses.
   - If access is denied, recommend how to elevate or copy the binary for analysis.

Tools available: Bash, Read, Write, Edit, Glob, Grep. Use them judiciously.`;

  const result = query({
    prompt,
    options: {
      cwd: binPath,
      allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'BashOutput'],
      permissionMode: (dryRun ? 'default' : 'acceptEdits') as 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan',
      agents: {
        'cli-historian': {
          description: 'Discovers candidate CLI binaries and gathers basic metadata.',
          tools: ['Bash', 'Glob', 'Read'],
          prompt: 'List executables, prioritize focus patterns, and collect file metadata to drive reconstruction.',
          model: 'haiku',
        },
        'capability-mapper': {
          description: 'Runs help/version commands and interprets usage patterns.',
          tools: ['Bash', 'Read'],
          prompt: 'Collect command usage output and summarize capabilities for later reconstruction.',
          model: 'haiku',
        },
        'rebuild-architect': {
          description: 'Drafts detailed rebuild instructions and writes the final report.',
          tools: ['Write', 'Edit', 'Read'],
          prompt: 'Translate findings into a structured rebuild guide with prerequisites and verification steps.',
          model: 'sonnet',
        },
      },
      maxTurns: 28,
      model: 'claude-sonnet-4-5-20250929',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  if (input.tool_name === 'Bash') {
                    const command = (input.tool_input as any)?.command ?? '';
                    if (command.includes('--help')) {
                      console.log('ℹ️  Capturing CLI help text...');
                    }
                    if (command.startsWith('file ') || command.startsWith('ldd ')) {
                      console.log('🔍 Inspecting binary metadata...');
                    }
                  }
                  if ((input.tool_name === 'Write' || input.tool_name === 'Edit') && dryRun) {
                    return { continue: false, reason: 'Dry run active; skipping writes.' };
                  }
                  if (input.tool_name === 'Write') {
                    console.log('📝 Writing CLI reconstruction report...');
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
                console.log('\n📗 CLI reconstruction walkthrough ready.');
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
        console.log('\n✅ CLI inspection complete!');
        console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
        console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`🔢 Turns: ${message.num_turns}`);
        if (message.usage) {
          console.log(`📊 Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);
        }
        if (message.result) {
          console.log(`\n${message.result}`);
        }
      } else {
        console.error('\n❌ CLI reconstruction session failed:', message.subtype);
      }
    }
  }

  if (!reportGenerated) {
    console.warn('\n⚠️  No report produced. Review agent output for clues.');
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
CLI Utility Reconstructor Agent

Usage:
  bun run agents/cli-utility-reconstructor.ts [options]

Options:
  --bin-path <path>      Directory containing CLI binaries (default: /usr/local/bin)
  --focus <name>         Comma-separated patterns to prioritize (e.g. node,gh,aws)
  --max-commands <num>   Limit number of CLIs inspected (default: 5)
  --output <file>        Markdown report path (default: cli-utility-rebuild-plan.md)
  --dry-run              Skip writing the report; print findings only
  --help                 Show this message

Examples:
  # Document the top 5 custom CLIs in /usr/local/bin
  bun run agents/cli-utility-reconstructor.ts

  # Focus on bespoke Node CLIs
  bun run agents/cli-utility-reconstructor.ts --focus mytool,deploy

  # Inspect a project-specific bin directory and write a custom report
  bun run agents/cli-utility-reconstructor.ts --bin-path ./bin --output ./docs/rebuild.md
    `);
    process.exit(0);
  }

  let binPath = '/usr/local/bin';
  let focusPatterns: string[] = [];
  let maxCommands = 5;
  let outputFile = 'cli-utility-rebuild-plan.md';
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--bin-path':
        binPath = args[++i] ?? binPath;
        break;
      case '--focus':
        focusPatterns = (args[++i] ?? '').split(',').map((pattern) => pattern.trim()).filter(Boolean);
        break;
      case '--max-commands':
        {
          const value = Number(args[++i]);
          if (!Number.isNaN(value) && value > 0) {
            maxCommands = value;
          }
        }
        break;
      case '--output': {
        const outputArg = args[++i];
        if (outputArg) {
          outputFile = outputArg;
        }
        break;
      }
      case '--dry-run':
        dryRun = true;
        break;
      default:
        if (arg && arg.startsWith('--')) {
          console.warn(`⚠️  Ignoring unknown option: ${arg}`);
        }
        break;
    }
  }

  runCliUtilityReconstructor({ binPath, focusPatterns, maxCommands, outputFile, dryRun }).catch((error) => {
    console.error('❌ Fatal error during CLI reconstruction:', error);
    process.exit(1);
  });
}

export { runCliUtilityReconstructor };
