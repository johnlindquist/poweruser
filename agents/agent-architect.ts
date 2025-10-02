#!/usr/bin/env bun

/**
 * Agent Architect
 *
 * Meta-agent that accepts an agent brief and scaffolds a fully-functional
 * Claude Agent SDK TypeScript agent matching this repository's conventions.
 *
 * Usage:
 *   bun run agents/agent-architect.ts [task description] [options]
 *
 * Options:
 *   --spec-file <path>      Path to a file containing the agent brief (overrides positional task text)
 *   --output <path>         Destination .ts file (default: auto-generated in agents/ based on task)
 *   --dry-run               Show planned edits without writing files
 *   --max-turns <number>    Maximum turns for the architect session (default: 28)
 *   --model <id>            Override Claude model (default: claude-sonnet-4-5-20250929)
 *   --help                  Display usage information
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface AgentArchitectOptions {
  task: string;
  specFile?: string;
  outputPath: string;
  dryRun: boolean;
  maxTurns: number;
  model: string;
}

async function runAgentArchitect(options: AgentArchitectOptions) {
  const { task, specFile, outputPath, dryRun, maxTurns, model } = options;

  console.log('🏗️  Agent Architect booting up...\n');
  console.log(`🎯 Target task: ${task}`);
  if (specFile) {
    console.log(`📄 Spec file: ${specFile}`);
  }
  console.log(`📝 Output path: ${outputPath}`);
  console.log(`🧪 Dry run: ${dryRun}`);
  console.log(`🧠 Model: ${model}`);
  console.log(`🔁 Max turns: ${maxTurns}\n`);

  const prompt = `You are the "Agent Architect". Build a new agent according to the brief below.

=== Agent Brief ===
${task}
${specFile ? '\n(Additional context provided via spec file.)' : ''}
===================

Repository conventions you must obey:
- Follow patterns seen in existing agents within ./agents (CLI usage banner, ASCII-only comments, explicit option parsing).
- Use @anthropic-ai/claude-agent-sdk's query() API.
- Provide informative logging and session summaries.
- Prefer explicit types; avoid \`any\` unless unavoidable.
- Hook into PreToolUse/SessionEnd when it aids UX.
- Respect CLI formatting guidelines (document options, examples).
- Name the generated file exactly ${outputPath} unless told otherwise.
- Keep edits limited to the necessary files.
- Assume Bun runtime and TypeScript module resolution.
- Align with instructions from agent-sdk-reference-prompt.md and previously created agents (dependency-health-monitor.ts, npm-package-auditor.ts, typescript-type-hardener.ts, etc.).
- When uncertain, inspect existing agents via Read/Grep before writing new code.

Workflow expectations:
1. Understand the brief: read spec file if provided, inspect similar agents for reference.
2. Produce a stepwise plan (may use Task tool) before editing.
3. Generate the new agent TypeScript file at ${outputPath}.
4. Include CLI interface, descriptive comments, option parsing, and query() invocation with appropriate tools/subagents.
5. Validate file formatting (TypeScript compliant) and summarize next steps for the user.
${dryRun ? '\nDry run active: DO NOT write files. Instead, output a detailed plan and diff preview.' : ''}

Deliverable: a ready-to-run TypeScript agent file implementing the requested functionality.`;

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      allowedTools: [
        'Read',
        'Write',
        'Edit',
        'Bash',
        'BashOutput',
        'Glob',
        'Grep',
        'Task',
      ],
      permissionMode: (dryRun ? 'default' : 'acceptEdits') as 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan',
      maxTurns,
      model,
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  if ((input.tool_name === 'Write' || input.tool_name === 'Edit') && dryRun) {
                    return { continue: false, reason: 'Dry run active; skip file modifications.' };
                  }
                  if (input.tool_name === 'Write') {
                    console.log('🛠️  Writing new agent file...');
                  }
                  if (input.tool_name === 'Edit') {
                    console.log('✍️  Updating agent template...');
                  }
                  if (input.tool_name === 'Task') {
                    console.log('🧭 Architect planning steps...');
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
                console.log('\n📐 Agent Architect session complete. Review the generated scaffold.');
                return { continue: true };
              },
            ],
          },
        ],
      },
    },
  });

  let success = false;

  for await (const message of result) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          console.log(block.text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        success = true;
        console.log('\n✅ Agent creation flow finished successfully.');
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
        console.error('\n❌ Agent architect session failed:', message.subtype);
      }
    }
  }

  if (!success) {
    console.warn('\n⚠️  No agent file was confirmed. Inspect logs above for errors.');
  }
}

function printHelp() {
  console.log(`
Agent Architect

Usage:
  bun run agents/agent-architect.ts [task description] [options]

Options:
  --spec-file <path>      Path to a file containing the agent brief (overrides positional task text)
  --output <path>         Destination .ts file (default: auto-generated in agents/ based on task)
  --dry-run               Show planned edits without writing files
  --max-turns <number>    Maximum turns for the architect session (default: 28)
  --model <id>            Override Claude model (default: claude-sonnet-4-5-20250929)
  --help                  Display this help message

Examples:
  # Create an agent using inline brief
  bun run agents/agent-architect.ts "Create a mobile APK rebuild coach"

  # Supply a detailed spec file and custom output path
  bun run agents/agent-architect.ts --spec-file ./specs/apk-coach.md --output agents/apk-rebuild-coach.ts

  # Preview proposed changes without writing files
  bun run agents/agent-architect.ts "Document Slack Electron app" --dry-run
  `);
}

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.length === 0) {
    printHelp();
    if (args.includes('--help') || args.length === 0) {
      process.exit(0);
    }
  }

  let taskParts: string[] = [];
  let specFile: string | undefined;
  let outputPath: string | undefined;
  let dryRun = false;
  let maxTurns = 28;
  let model = 'claude-sonnet-4-5-20250929';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--spec-file':
        specFile = args[++i];
        break;
      case '--output':
        outputPath = args[++i];
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--max-turns': {
        const value = Number(args[++i]);
        if (!Number.isNaN(value) && value > 0) {
          maxTurns = value;
        }
        break;
      }
      case '--model': {
        const modelArg = args[++i];
        if (modelArg) {
          model = modelArg;
        }
        break;
      }
      default:
        if (arg && arg.startsWith('--')) {
          console.warn(`⚠️  Ignoring unknown option: ${arg}`);
        } else if (arg) {
          taskParts.push(arg);
        }
        break;
    }
  }

  let task = taskParts.join(' ').trim();

  if (specFile) {
    try {
      const fs = await import('fs/promises');
      const spec = await fs.readFile(specFile, 'utf8');
      if (spec.trim().length > 0) {
        task = spec.trim();
      }
    } catch (error) {
      console.error(`❌ Unable to read spec file: ${specFile}`, error);
      process.exit(1);
    }
  }

  if (!task) {
    console.error('❌ No agent brief provided. Supply a task description or use --spec-file.');
    process.exit(1);
  }

  if (!outputPath) {
    const sanitized = task
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'generated-agent';
    outputPath = `agents/${sanitized}.ts`;
  }

  runAgentArchitect({
    task,
    specFile,
    outputPath,
    dryRun,
    maxTurns,
    model,
  }).catch((error) => {
    console.error('❌ Fatal error during Agent Architect run:', error);
    process.exit(1);
  });
}

export { runAgentArchitect };
