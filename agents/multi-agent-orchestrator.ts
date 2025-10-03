#!/usr/bin/env -S bun run

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
 *   bun run agents/multi-agent-orchestrator.ts "<task-description>" [options]
 *
 * Examples:
 *   # Build a full-stack feature
 *   bun run agents/multi-agent-orchestrator.ts "Create a user authentication system with frontend, backend, and tests"
 *
 *   # Refactor and document a module
 *   bun run agents/multi-agent-orchestrator.ts "Refactor src/utils, add TypeScript types, write tests, and update docs" --max-agents 4
 *
 *   # Analyze and improve codebase
 *   bun run agents/multi-agent-orchestrator.ts "Analyze code quality, fix security issues, and optimize performance" --verbose
 */

import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface OrchestratorOptions {
  task: string;
  maxParallelAgents: number;
  verbose: boolean;
}

function printHelp(): void {
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
  --help, -h              Show this help message

Examples:
  # Build a full-stack feature
  bun run agents/multi-agent-orchestrator.ts "Create a user authentication system with frontend, backend, and tests"

  # Refactor and document a module
  bun run agents/multi-agent-orchestrator.ts "Refactor src/utils, add TypeScript types, write tests, and update docs" --max-agents 4

  # Analyze and improve codebase
  bun run agents/multi-agent-orchestrator.ts "Analyze code quality, fix security issues, and optimize performance" --verbose
  `);
}

function parseOptions(): OrchestratorOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const task = positionals[0];
  if (!task) {
    console.error("❌ Error: Task description is required\n");
    printHelp();
    process.exit(1);
  }

  const rawMaxAgents = values["max-agents"] || values.maxAgents;
  const maxParallelAgents = typeof rawMaxAgents === "string"
    ? parseInt(rawMaxAgents, 10)
    : 3;

  if (isNaN(maxParallelAgents) || maxParallelAgents < 1) {
    console.error("❌ Error: --max-agents must be a positive number");
    process.exit(1);
  }

  const verbose = values.verbose === true;

  return {
    task,
    maxParallelAgents,
    verbose,
  };
}

function buildPrompt(options: OrchestratorOptions): string {
  const { task, maxParallelAgents, verbose } = options;

  return `
You are a multi-agent orchestration coordinator. Your job is to manage the execution of a complex task using multiple specialized subagents working in parallel.

Main Task: "${task}"

Your responsibilities:

PHASE 1: Task Decomposition
1. Analyze the task and identify its key components
2. Break it down into 2-${maxParallelAgents} independent subtasks that can run in parallel
3. For each subtask, specify:
   - A clear, actionable description
   - Required tools (choose from: Read, Write, Edit, Glob, Grep, Bash, WebFetch, WebSearch, Task)
   - Dependencies on other subtasks (if any)
   - Estimated complexity (low/medium/high)

Output format for decomposition:
SUBTASK 1: [description]
TOOLS: [tool1, tool2, ...]
DEPENDENCIES: [none or subtask IDs]
COMPLEXITY: [low/medium/high]

[Repeat for each subtask]

After the subtasks, provide:
MERGE_STRATEGY: [How to combine results from all subtasks]

Important: Make subtasks as independent as possible to maximize parallelization.

PHASE 2: Parallel Execution
Use the Task tool to spawn ${maxParallelAgents} specialized subagents in parallel, each handling one subtask. Each subagent should:
- Execute its subtask completely and independently
- Have appropriate tool permissions for its specific needs
- Provide a clear result summary

PHASE 3: Result Merging
After all subagents complete:
1. Analyze all subtask results
2. Identify any conflicts or inconsistencies
3. Merge the results intelligently, prioritizing quality and coherence
4. Create a comprehensive final output that addresses the original task
5. Note any gaps or areas that need human review

${verbose ? "VERBOSE MODE: Provide detailed progress updates for each phase and subagent." : ""}

Provide a clear, structured final result that synthesizes all subagent outputs into a cohesive solution.
`.trim();
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🎭 Multi-Agent Orchestrator\n");
console.log(`📋 Main Task: ${options.task}`);
console.log(`⚙️  Max Parallel Agents: ${options.maxParallelAgents}`);
console.log(`🔍 Verbose Mode: ${options.verbose ? "Enabled" : "Disabled"}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

removeAgentFlags([
    "max-agents", "maxAgents", "verbose", "help", "h"
  ]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: "Read Write Edit Glob Grep Bash WebFetch WebSearch Task TodoWrite",
  "permission-mode": "acceptEdits",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n🎯 Orchestration complete!\n");
    console.log("✅ All subtasks have been executed and results merged.");
    console.log("\nNext steps:");
    console.log("1. Review the merged output");
    console.log("2. Test the implemented changes");
    console.log("3. Address any gaps or inconsistencies noted");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
