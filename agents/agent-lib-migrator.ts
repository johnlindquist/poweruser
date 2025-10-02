#!/usr/bin/env -S bun run

/**
 * AGENT LIB MIGRATOR
 *
 * Migrates existing agents to the shared lib patterns used by newer agents.
 * - Replaces direct SDK calls with the shared `claude` wrapper
 * - Standardizes argument parsing via `parsedArgs`/`getPositionals`
 * - Emits default flags (`settings`, `allowedTools`, `mcp-config`, etc.) like accessibility-audit-healer
 * - Ensures top-level execution with structured completion output
 *
 * Usage:
 *   bun run agents/agent-lib-migrator.ts <agent-path> [options]
 *
 * Options:
 *   --apply            Allow the assistant to edit the target file directly
 *   --model <name>     Override the Claude model alias (default: claude-sonnet-4-5-20250929)
 *   --help, -h         Show this help
 */

import { readFileSync, readdirSync, type Dirent } from "node:fs";
import { join, resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type MigrationOptions = {
  targetPaths: string[];
  model: string;
  applyChanges: boolean;
  runAll: boolean;
};

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

function printHelp() {
  console.log(`
AGENT LIB MIGRATOR

Usage:
  bun run agents/agent-lib-migrator.ts <agent-path> [options]

Arguments:
  agent-path             Path to the agent file to migrate

Options:
  --all                 Migrate every agent missing the shared lib import
  --apply                Allow automatic edits using the Edit tool
  --model <name>         Override the Claude model alias (default: ${DEFAULT_MODEL})
  --help, -h             Show this help message
`);
}

function findAgentsMissingLibImport(rootDir: string): string[] {
  const agentsDir = resolve(rootDir, "agents");
  let entries: Dirent[];

  try {
    entries = readdirSync(agentsDir, { withFileTypes: true });
  } catch (error) {
    console.error("❌ Error reading agents directory:", error);
    process.exit(1);
  }

  const targets: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (!entry.name.endsWith(".ts")) continue;

    const fullPath = join(agentsDir, entry.name);
    const content = readFileSync(fullPath, "utf8");

    if (!content.includes("./lib")) {
      targets.push(fullPath);
    }
  }

  return targets;
}

function parseOptions(): MigrationOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const runAll = values.all === true;
  let targetPaths: string[] = [];

  if (runAll) {
    targetPaths = findAgentsMissingLibImport(process.cwd());

    if (targetPaths.length === 0) {
      console.log("✅ All agents already import the shared lib.");
      return null;
    }
  } else {
    const targetArg = positionals[0];
    if (!targetArg) {
      console.error("❌ Error: agent path is required");
      printHelp();
      process.exit(1);
    }

    targetPaths = [resolve(process.cwd(), targetArg)];
  }

  const model = typeof values.model === "string" && values.model.length > 0 ? values.model : DEFAULT_MODEL;
  const applyChanges = values.apply === true;

  return {
    targetPaths,
    model,
    applyChanges,
    runAll,
  };
}

function buildPrompt(targetPath: string, applyChanges: boolean): string {
  return `
You are a migration assistant tasked with updating an existing Claude agent to match the shared lib patterns.

Target agent: ${targetPath}

**IMPORTANT PRELIMINARY STEPS:**
Before proposing any changes, you MUST:
1. Read the target agent file to understand its current structure
2. Read ./agents/accessibility-audit-healer.ts as the reference implementation
3. Read ./agents/lib/index.ts to see all available exports
4. Read ./agents/lib/settings.ts to understand the Settings type schema
5. Read ./agents/lib/claude-flags.types.ts to understand ClaudeFlags interface

Focus on these upgrades:
1. Replace direct SDK usage with the shared helpers in ./agents/lib (claude wrapper, parsedArgs, getPositionals, Settings, etc.).
2. Standardize CLI handling:
   - Use the shared parsedArgs to pull flags and positionals.
   - Provide a clear help printer and validation similar to accessibility-audit-healer.
   - Resolve file paths via node:path utilities when needed.
3. Build default flags the new way:
   - Use Settings type correctly (it does NOT have cwd or maxTurns properties)
   - Settings is typically an empty object {} unless you need specific config like model, env, etc.
   - Pass MCP server definitions through --mcp-config JSON objects.
   - Use allowedTools (space-separated string) and permission-mode flags for tool access.
   - Add strict-mcp-config when providing custom MCP servers.
4. Handle working directory:
   - IMPORTANT: Settings does NOT support a 'cwd' property
   - If you need to change working directory, use process.chdir() before calling claude()
   - Store the original cwd if you need to restore it later
5. Ensure the script runs at top level (no manual run() wrapper) and awaits claude directly.
6. Preserve existing agent-specific logic (prompts, logging, domain-specific behavior) while reorganizing structure.
7. Update imports, types, and completion messages to match the style of agents/accessibility-audit-healer.ts.
8. System prompts should use the 'append-system-prompt' flag instead of inline systemPrompt option.

Migration checklist:
- Keep the shebang as \`#!/usr/bin/env -S bun run\`.
- Import { claude, parsedArgs } from "./lib" and types from "./lib".
- Remove import from '@anthropic-ai/claude-agent-sdk'.
- Remove import from 'util' parseArgs (use parsedArgs from lib instead).
- Add proper TypeScript interfaces for options.
- Create Settings object (usually empty {}).
- NEVER add cwd or maxTurns to Settings - these properties don't exist on that type.
- Use process.chdir() if you need to change working directory.
- Build ClaudeFlags with model, settings (JSON string), allowedTools (space-separated), permission-mode, etc.
- Add removeAgentFlags() function to clean up agent-specific flags from parsedArgs.
- Replace query() loop with await claude(prompt, defaultFlags).
- Remove main() wrapper, run at top level.
- Confirm CLI help text is accurate after the migration.

${applyChanges ? "Apply the necessary edits directly using the Edit tool and save the file when ready." : "Propose the full diff and wait for approval before applying edits."}

When finished, summarize the changes and include any follow-up steps.
`;
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["apply", "model", "help", "h", "all"] as const;

  for (const key of agentKeys) {
    if (key in values) {
      delete values[key];
    }
  }
}

const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🛠️ Agent Lib Migrator\n");
if (options.runAll) {
  console.log(`Targets to migrate: ${options.targetPaths.length}`);
} else {
  console.log(`Target: ${options.targetPaths[0]}`);
}
if (options.targetPaths.length > 1) {
  options.targetPaths.forEach((target, index) => {
    console.log(`  ${index + 1}. ${target}`);
  });
}
console.log(`Model: ${options.model}`);
console.log(`Apply changes: ${options.applyChanges ? "enabled" : "disabled"}`);
console.log("");

const claudeSettings: Settings = {};

const allowedTools = [
  "Read",
  "Write",
  "Edit",
  "TodoWrite",
  "Grep",
  "Glob",
];

removeAgentFlags();

let completed = 0;

for (const [index, targetPath] of options.targetPaths.entries()) {
  const prompt = buildPrompt(targetPath, options.applyChanges);
  const defaultFlags: ClaudeFlags = {
    model: options.model,
    settings: JSON.stringify(claudeSettings),
    allowedTools: allowedTools.join(" "),
    "permission-mode": options.applyChanges ? "acceptEdits" : "default",
    ...(options.applyChanges ? { 'dangerously-skip-permissions': true } : {}),
  };

  console.log(`🚀 [${index + 1}/${options.targetPaths.length}] Migrating: ${targetPath}`);

  try {
    const exitCode = await claude(prompt, defaultFlags);
    if (exitCode !== 0) {
      console.error(`❌ Claude exited with code ${exitCode} while processing ${targetPath}`);
      process.exit(exitCode);
    }

    completed += 1;
  } catch (error) {
    console.error(`❌ Fatal error while migrating ${targetPath}:`, error);
    process.exit(1);
  }
}

console.log(`\n✅ Migration sessions complete (${completed}/${options.targetPaths.length})\n`);
console.log("Next steps:");
console.log("1. Review the proposed or applied changes");
console.log("2. Run relevant tests or scripts");
console.log("3. Commit the migration once verified");

process.exit(0);
