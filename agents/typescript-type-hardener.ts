#!/usr/bin/env bun

/**
 * TypeScript Type Hardener Agent
 *
 * Runs `bun tsc`, triages type-checking failures, and iteratively fixes them by
 * strengthening type information (preferring explicit types and eliminating `any`).
 *
 * Usage:
 *   bun run agents/typescript-type-hardener.ts [options]
 *
 * Options:
 *   --project <path>        Project root to analyze (default: current directory)
 *   --allow-any             Allow existing `any` usage (only fix breaking errors)
 *   --max-turns <number>    Custom max turn count (default: 32)
 *   --dry-run               Report fixes without writing changes
 *   --help                  Show usage information
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface TypeHardenerOptions {
  projectPath: string;
  allowAny: boolean;
  dryRun: boolean;
  maxTurns: number;
}

async function runTypeHardener(options: TypeHardenerOptions) {
  const { projectPath, allowAny, dryRun, maxTurns } = options;

  console.log('🧱 TypeScript Type Hardener launching...\n');
  console.log(`📂 Project: ${projectPath}`);
  console.log(`🚫 Enforce no-any policy: ${!allowAny}`);
  console.log(`🧪 Dry run: ${dryRun}`);
  console.log(`🔁 Max turns: ${maxTurns}\n`);

  const prompt = `You are the "TypeScript Type Hardener" agent. Your job is to run \\\`bun tsc\\\` for the project at ${projectPath}, fix all TypeScript errors, and aggressively replace \\\`any\\\` with precise types.

Core workflow:
1. Baseline type check
   - Execute \\\`bun tsc\\\` (no emit). Capture diagnostics.
   - Summarize errors by file and category.
2. Remediation loop
   - For each error, inspect the relevant files.
   - Propose type-safe fixes: infer explicit interfaces, generics, discriminated unions, utility types, etc.
   - Prefer additions of types over suppression of errors.
   - Avoid using \\\`any\\\`; use unknown, generics, or specific types instead. ${allowAny ? 'You may leave existing any usage untouched unless required to fix the error.' : 'If an `any` is encountered, replace it with a safer alternative.'}
   - Consider refactors (function signatures, helper utilities) when necessary.
3. Validation
   - Re-run \\\`bun tsc\\\` after applying fixes to ensure a clean bill of health.
   - Repeat until the compilation exits successfully or no additional progress can be made.
4. Reporting
   - Provide a concise summary of modifications, highlighting removed `any` instances.
   - If dry-run mode is enabled, stage the proposed diffs in memory and write a report instead of modifying files.

Tools & guidelines:
- Use Bash to run TypeScript compilation and git checks.
- Use Read/Edit/Write to inspect and update TypeScript source.
- Ensure edits compile; do not introduce lint issues or logic regressions.
- When a refactor is risky, leave TODO comments explaining remaining work.
- Always re-run type checking after edits to confirm the fix.
- Capture stderr/stdout of failing commands and explain remediation steps.
- If no errors remain but `any` persists (and allow-any is false), proactively search for them (e.g., via \\\`rg 'any'\\\`).
- Do not install new dependencies without evidence they are required for typing.

Deliverable: Type-safe source code with zero TypeScript errors and minimized `any` usage, plus a summary of the changes performed.`;

  const result = query({
    prompt,
    options: {
      cwd: projectPath,
      allowedTools: [
        'Bash',
        'BashOutput',
        'Read',
        'Write',
        'Edit',
        'Glob',
        'Grep',
        'Task',
      ],
      agents: {
        'ts-diagnostics-reader': {
          description: 'Parses TypeScript compiler errors and prioritizes fixes.',
          tools: ['Bash', 'Read', 'Grep'],
          prompt: 'Run bun tsc, parse diagnostics, and provide a triaged list of issues to tackle.',
          model: 'haiku',
        },
        'type-refiner': {
          description: 'Applies precise typing fixes across the codebase.',
          tools: ['Read', 'Edit', 'Write'],
          prompt: 'Refactor code to satisfy TypeScript while avoiding any. Introduce interfaces, generics, and utility types as needed.',
          model: 'sonnet',
        },
        'verification-sentinel': {
          description: 'Re-runs compiler checks and enforces success criteria.',
          tools: ['Bash', 'Read'],
          prompt: 'After edits, re-run bun tsc. Stop only when the compilation succeeds and no unhandled any remains.',
          model: 'haiku',
        },
      },
      permissionMode: dryRun ? 'readOnly' : 'acceptEdits',
      maxTurns,
      model: 'claude-sonnet-4-5-20250929',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.tool_name === 'Bash') {
                  const command = (input.tool_input as any)?.command ?? '';
                  if (command.includes('bun tsc')) {
                    console.log('🧪 Running bun tsc...');
                  }
                  if (command.includes("rg 'any'")) {
                    console.log('🔍 Auditing lingering any usage...');
                  }
                }
                if (input.tool_name === 'Write' || input.tool_name === 'Edit') {
                  if (dryRun) {
                    return { continue: false, reason: 'Dry run active; editing disabled.' };
                  }
                  console.log('✍️  Applying type fixes...');
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
                console.log('\n✅ TypeScript hardening session complete. Review summary for applied fixes.');
                return { continue: true };
              },
            ],
          },
        ],
      },
    },
  });

  for await (const message of result) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          console.log(block.text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('\n🏁 bun tsc finished cleanly with strengthened types.');
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
        console.error('\n❌ Type hardening session failed:', message.subtype);
      }
    }
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
TypeScript Type Hardener Agent

Usage:
  bun run agents/typescript-type-hardener.ts [options]

Options:
  --project <path>        Project root to analyze (default: current directory)
  --allow-any             Allow existing any usage (only fix compiler failures)
  --max-turns <number>    Custom max turn count (default: 32)
  --dry-run               Report fixes without writing changes
  --help                  Show this help message

Examples:
  # Harden types for current project
  bun run agents/typescript-type-hardener.ts

  # Permit existing any usage but fix compiler errors
  bun run agents/typescript-type-hardener.ts --allow-any

  # Analyze another repo and limit to 20 turns
  bun run agents/typescript-type-hardener.ts --project ../lib --max-turns 20

  # Preview remediation steps without writing changes
  bun run agents/typescript-type-hardener.ts --dry-run
    `);
    process.exit(0);
  }

  let projectPath = process.cwd();
  let allowAny = false;
  let dryRun = false;
  let maxTurns = 32;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--project':
        projectPath = args[++i] ?? projectPath;
        break;
      case '--allow-any':
        allowAny = true;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--max-turns':
        {
          const value = Number(args[++i]);
          if (!Number.isNaN(value) && value > 0) {
            maxTurns = value;
          }
        }
        break;
      default:
        if (arg.startsWith('--')) {
          console.warn(`⚠️  Ignoring unknown option: ${arg}`);
        }
        break;
    }
  }

  runTypeHardener({ projectPath, allowAny, dryRun, maxTurns }).catch((error) => {
    console.error('❌ Fatal error during type hardening:', error);
    process.exit(1);
  });
}

export { runTypeHardener };
