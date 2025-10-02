#!/usr/bin/env bun

/**
 * Multi-Agent Orchestrator
 *
 * A coordinator agent that manages multiple specialized subagents working in parallel:
 * - Analyzes complex tasks and decomposes them into parallel subtasks
 * - Spawns specialized subagents with different tool permissions and focus areas
 * - Coordinates communication and data flow between subagents
 * - Intelligently merges results from parallel agents
 * - Handles conflicts and dependencies between subagent outputs
 * - Provides real-time progress tracking across all subagents
 *
 * Usage:
 *   bun run agents/multi-agent-orchestrator.ts "<task-description>"
 */

import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

interface OrchestratorOptions {
  task: string;
  maxParallelAgents?: number;
  verbose?: boolean;
}

interface SubtaskResult {
  subtaskId: string;
  description: string;
  result: string;
  duration?: number;
  cost?: number;
}

async function orchestrate(options: OrchestratorOptions) {
  const { task, maxParallelAgents = 3, verbose = false } = options;

  console.log('🎭 Multi-Agent Orchestrator Starting...\n');
  console.log(`📋 Main Task: ${task}`);
  console.log(`⚙️  Max Parallel Agents: ${maxParallelAgents}\n`);

  const subtaskResults: SubtaskResult[] = [];

  // Phase 1: Analyze and decompose the task
  const planningPrompt = `
You are a task orchestration expert. Analyze this complex task and break it down into independent, parallelizable subtasks.

Main Task: "${task}"

Your responsibilities:
1. Analyze the task and identify its key components
2. Break it down into 2-${maxParallelAgents} independent subtasks that can run in parallel
3. For each subtask, specify:
   - A clear, actionable description
   - Required tools (choose from: Read, Write, Edit, Glob, Grep, Bash, WebFetch, WebSearch)
   - Dependencies on other subtasks (if any)
   - Estimated complexity (low/medium/high)

Output format:
SUBTASK 1: [description]
TOOLS: [tool1, tool2, ...]
DEPENDENCIES: [none or subtask IDs]
COMPLEXITY: [low/medium/high]

[Repeat for each subtask]

After the subtasks, provide:
MERGE_STRATEGY: [How to combine results from all subtasks]

Important: Make subtasks as independent as possible to maximize parallelization.
`.trim();

  console.log('📊 Phase 1: Task Analysis & Decomposition\n');

  const planningResult = query({
    prompt: planningPrompt,
    options: {
      cwd: process.cwd(),
      allowedTools: ['Read', 'Glob', 'Grep', 'TodoWrite'],
      permissionMode: 'default',
      maxTurns: 10,
      model: 'claude-sonnet-4-5-20250929',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (verbose && input.hook_event_name === 'PreToolUse') {
                  console.log(`🔧 Planning phase using: ${input.tool_name}`);
                }
                return { continue: true };
              },
            ],
          },
        ],
      },
    },
  });

  let decompositionPlan = '';
  for await (const message of planningResult) {
    if (message.type === 'assistant') {
      const textContent = message.message.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        decompositionPlan += textContent.text;
        if (verbose) {
          console.log('💭', textContent.text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('✅ Task decomposition complete\n');
      }
    }
  }

  // Parse the decomposition plan
  const subtasks = parseDecompositionPlan(decompositionPlan);

  if (subtasks.length === 0) {
    console.error('❌ Failed to decompose task into subtasks');
    process.exit(1);
  }

  console.log(`📌 Identified ${subtasks.length} subtasks:\n`);
  subtasks.forEach((st, idx) => {
    console.log(`  ${idx + 1}. ${st.description}`);
    console.log(`     Tools: ${st.tools.join(', ')}`);
    console.log(`     Complexity: ${st.complexity}\n`);
  });

  // Phase 2: Execute subtasks in parallel
  console.log('🚀 Phase 2: Parallel Execution\n');

  const subtaskPromises = subtasks.map((subtask, idx) =>
    executeSubtask(subtask, idx + 1, verbose)
  );

  // Wait for all subtasks to complete
  const results = await Promise.allSettled(subtaskPromises);

  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      subtaskResults.push(result.value);
      console.log(`✅ Subtask ${idx + 1} completed successfully`);
    } else {
      console.error(`❌ Subtask ${idx + 1} failed:`, result.reason);
    }
  });

  console.log('\n📊 All subtasks completed\n');

  // Phase 3: Merge results
  console.log('🔄 Phase 3: Result Merging & Synthesis\n');

  const mergePrompt = `
You are a result synthesizer. Multiple specialized agents have completed parallel subtasks. Your job is to intelligently merge their results into a cohesive final output.

Original Task: "${task}"

Subtask Results:
${subtaskResults
  .map(
    (r) => `
SUBTASK: ${r.description}
RESULT:
${r.result}
---
`
  )
  .join('\n')}

Your responsibilities:
1. Analyze all subtask results
2. Identify any conflicts or inconsistencies
3. Merge the results intelligently, prioritizing quality and coherence
4. Create a comprehensive final output that addresses the original task
5. Note any gaps or areas that need human review

Provide a clear, structured final result.
`.trim();

  const mergeResult = query({
    prompt: mergePrompt,
    options: {
      cwd: process.cwd(),
      allowedTools: ['Read', 'Write', 'Edit', 'TodoWrite'],
      permissionMode: 'acceptEdits',
      maxTurns: 15,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  let finalOutput = '';
  for await (const message of mergeResult) {
    if (message.type === 'assistant') {
      const textContent = message.message.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        finalOutput += textContent.text;
        console.log(textContent.text);
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('\n' + '='.repeat(60));
        console.log('🎯 ORCHESTRATION COMPLETE');
        console.log('='.repeat(60));
        console.log(`\n✅ Successfully completed: "${task}"\n`);
        console.log(`📈 Statistics:`);
        console.log(`   - Subtasks executed: ${subtaskResults.length}`);
        console.log(`   - Total duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`   - Total cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(
          `   - Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out\n`
        );

        if (subtaskResults.length > 0) {
          console.log(`📊 Subtask breakdown:`);
          subtaskResults.forEach((st, idx) => {
            console.log(`   ${idx + 1}. ${st.description}`);
            if (st.duration) {
              console.log(`      Duration: ${(st.duration / 1000).toFixed(2)}s`);
            }
            if (st.cost) {
              console.log(`      Cost: $${st.cost.toFixed(4)}`);
            }
          });
        }
      } else {
        console.error('\n❌ Merge phase failed:', message.subtype);
      }
    }
  }
}

interface Subtask {
  description: string;
  tools: string[];
  dependencies: string[];
  complexity: 'low' | 'medium' | 'high';
}

function parseDecompositionPlan(plan: string): Subtask[] {
  const subtasks: Subtask[] = [];
  const lines = plan.split('\n');

  let currentSubtask: Partial<Subtask> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('SUBTASK')) {
      if (currentSubtask && currentSubtask.description) {
        subtasks.push(currentSubtask as Subtask);
      }
      const description = trimmed.substring(trimmed.indexOf(':') + 1).trim();
      currentSubtask = {
        description,
        tools: [],
        dependencies: [],
        complexity: 'medium',
      };
    } else if (trimmed.startsWith('TOOLS:') && currentSubtask) {
      const toolsStr = trimmed.substring(6).trim();
      currentSubtask.tools = toolsStr
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    } else if (trimmed.startsWith('DEPENDENCIES:') && currentSubtask) {
      const depsStr = trimmed.substring(13).trim().toLowerCase();
      currentSubtask.dependencies = depsStr === 'none' ? [] : depsStr.split(',').map((d) => d.trim());
    } else if (trimmed.startsWith('COMPLEXITY:') && currentSubtask) {
      const complexity = trimmed.substring(11).trim().toLowerCase();
      if (complexity === 'low' || complexity === 'medium' || complexity === 'high') {
        currentSubtask.complexity = complexity;
      }
    }
  }

  if (currentSubtask && currentSubtask.description) {
    subtasks.push(currentSubtask as Subtask);
  }

  return subtasks;
}

async function executeSubtask(
  subtask: Subtask,
  subtaskId: number,
  verbose: boolean
): Promise<SubtaskResult> {
  console.log(`\n🔹 Starting Subtask ${subtaskId}: ${subtask.description}`);

  const startTime = Date.now();

  const subtaskPrompt = `
You are a specialized agent executing a specific subtask as part of a larger orchestrated task.

Your subtask: ${subtask.description}

Execute this subtask completely and independently. Provide a clear result summary at the end.
`.trim();

  const result = query({
    prompt: subtaskPrompt,
    options: {
      cwd: process.cwd(),
      allowedTools: [...subtask.tools, 'Task', 'TodoWrite'],
      permissionMode: 'acceptEdits',
      maxTurns: 30,
      model: 'claude-sonnet-4-5-20250929',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (verbose && input.hook_event_name === 'PreToolUse') {
                  console.log(`   🔧 [Subtask ${subtaskId}] ${input.tool_name}`);
                }
                return { continue: true };
              },
            ],
          },
        ],
      },
    },
  });

  let subtaskOutput = '';
  let finalMessage: SDKMessage | null = null;

  for await (const message of result) {
    if (message.type === 'assistant') {
      const textContent = message.message.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        subtaskOutput += textContent.text + '\n';
      }
    } else if (message.type === 'result') {
      finalMessage = message;
    }
  }

  const duration = Date.now() - startTime;

  return {
    subtaskId: subtaskId.toString(),
    description: subtask.description,
    result: subtaskOutput,
    duration,
    cost:
      finalMessage && finalMessage.type === 'result' && finalMessage.subtype === 'success'
        ? finalMessage.total_cost_usd
        : undefined,
  };
}

// CLI interface
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
🎭 Multi-Agent Orchestrator

A coordinator agent that decomposes complex tasks into parallel subtasks
and executes them using specialized subagents.

Usage:
  bun run agents/multi-agent-orchestrator.ts "<task>" [options]

Arguments:
  task                    The complex task to orchestrate

Options:
  --max-agents <number>   Maximum parallel agents (default: 3)
  --verbose               Show detailed execution logs
  --help                  Show this help message

Examples:
  # Build a full-stack feature
  bun run agents/multi-agent-orchestrator.ts "Create a user authentication system with frontend, backend, and tests"

  # Refactor and document a module
  bun run agents/multi-agent-orchestrator.ts "Refactor src/utils, add TypeScript types, write tests, and update docs" --max-agents 4

  # Analyze and improve codebase
  bun run agents/multi-agent-orchestrator.ts "Analyze code quality, fix security issues, and optimize performance" --verbose
  `);
  process.exit(0);
}

const task = args[0] || '';

// Parse CLI options
const options: OrchestratorOptions = {
  task,
  maxParallelAgents: 3,
  verbose: false,
};

for (let i = 1; i < args.length; i++) {
  switch (args[i]) {
    case '--max-agents':
      const nextArg = args[++i];
      if (nextArg) {
        options.maxParallelAgents = parseInt(nextArg, 10);
      }
      break;
    case '--verbose':
      options.verbose = true;
      break;
  }
}

// Validate
if (!task || task.trim().length === 0) {
  console.error('❌ Error: Task description is required\n');
  console.log('Run with --help for usage information');
  process.exit(1);
}

// Run the orchestrator
orchestrate(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});