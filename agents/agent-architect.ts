#!/usr/bin/env -S bun run

/**
 * Agent Architect
 *
 * Meta-agent that accepts an agent brief and scaffolds a fully-functional
 * Claude Agent SDK TypeScript agent matching this repository's conventions.
 *
 * Usage:
 *   bun run agents/agent-architect.ts <task-description> [options]
 *
 * Examples:
 *   # Create an agent using inline brief
 *   bun run agents/agent-architect.ts "Create a mobile APK rebuild coach"
 *
 *   # Supply a detailed spec file and custom output path
 *   bun run agents/agent-architect.ts "agent brief" --spec-file ./specs/apk-coach.md --output agents/apk-rebuild-coach.ts
 *
 *   # Preview proposed changes without writing files
 *   bun run agents/agent-architect.ts "Document Slack Electron app" --dry-run
 */

import { resolve } from "node:path";
import { claude, parsedArgs, removeAgentFlags } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface AgentArchitectOptions {
  task: string;
  specFile?: string;
  outputPath: string;
  dryRun: boolean;
  model: string;
}

function buildPrompt(options: AgentArchitectOptions): string {
  const { task } = options;
  return task;
}

function buildSystemPrompt(options: AgentArchitectOptions): string {
  const { outputPath, dryRun, specFile } = options;

  return `You are the Agent Architect meta-agent. Build a new agent according to the brief provided by the user.

${specFile ? 'Additional context has been provided via spec file and merged into the user prompt.' : ''}

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

Always:
- Read existing similar agents for reference
- Use TodoWrite to track your progress
- Validate TypeScript syntax
- Include usage examples in comments
- Make the agent executable with proper shebang

Deliverable: a ready-to-run TypeScript agent file implementing the requested functionality.`;
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

function parseOptions(): AgentArchitectOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawSpecFile = values["spec-file"] || values.specFile;
  const rawOutput = values.output;
  const dryRun = values["dry-run"] === true || values.dryRun === true;
  const rawModel = values.model;

  const specFile = typeof rawSpecFile === "string" && rawSpecFile.length > 0
    ? resolve(rawSpecFile)
    : undefined;

  const model = typeof rawModel === "string" && rawModel.length > 0
    ? rawModel
    : "claude-sonnet-4-5-20250929";

  // Collect task from positionals
  let task = positionals.join(" ").trim();

  // If spec file provided, read it
  if (specFile) {
    try {
      const { readFileSync } = require("node:fs");
      const spec = readFileSync(specFile, "utf8");
      if (spec.trim().length > 0) {
        task = spec.trim();
      }
    } catch (error) {
      console.error(`❌ Unable to read spec file: ${specFile}`, error);
      process.exit(1);
    }
  }

  // Allow empty task to launch with empty prompt
  if (!task) {
    task = "";
  }

  // Determine output path
  let outputPath: string;
  if (typeof rawOutput === "string" && rawOutput.length > 0) {
    outputPath = rawOutput;
  } else {
    const sanitized = task
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "generated-agent";
    outputPath = `agents/${sanitized}.ts`;
  }

  return {
    task,
    specFile,
    outputPath,
    dryRun,
    model,
  };
}

const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🏗️  Agent Architect\n");
console.log(`Task: ${options.task.slice(0, 100)}${options.task.length > 100 ? "..." : ""}`);
if (options.specFile) console.log(`Spec File: ${options.specFile}`);
console.log(`Output: ${options.outputPath}`);
console.log(`Dry Run: ${options.dryRun ? "Yes" : "No"}`);
console.log(`Model: ${options.model}`);
console.log("");

const prompt = buildPrompt(options);
const systemPrompt = buildSystemPrompt(options);
const settings: Settings = {};

removeAgentFlags(["spec-file", "specFile", "output", "dry-run", "dryRun", "max-turns", "maxTurns", "model", "help"]);

const defaultFlags: ClaudeFlags = {
  model: options.model,
  settings: JSON.stringify(settings),
  "append-system-prompt": systemPrompt,
  allowedTools: "Bash Read Write Edit Glob Grep Task TodoWrite",
  "permission-mode": options.dryRun ? "default" : "acceptEdits",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Agent Architect complete!\n");
    console.log(`📄 Generated agent: ${options.outputPath}`);
    if (options.dryRun) {
      console.log("(Dry run - no files written)");
    }
    console.log("\nNext steps:");
    console.log("1. Review the generated agent code");
    console.log("2. Make the agent executable: chmod +x " + options.outputPath);
    console.log("3. Run type checking: bun run typecheck");
    console.log("4. Test the agent: bun run " + options.outputPath);
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
