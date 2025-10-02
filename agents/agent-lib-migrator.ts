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

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type MigrationOptions = {
  targetPath: string;
  model: string;
  applyChanges: boolean;
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
  --apply                Allow automatic edits using the Edit tool
  --model <name>         Override the Claude model alias (default: ${DEFAULT_MODEL})
  --help, -h             Show this help message
`);
}

function parseOptions(): MigrationOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const targetArg = positionals[0];
  if (!targetArg) {
    console.error("❌ Error: agent path is required");
    printHelp();
    process.exit(1);
  }

  const targetPath = resolve(process.cwd(), targetArg);
  const model = typeof values.model === "string" && values.model.length > 0 ? values.model : DEFAULT_MODEL;
  const applyChanges = values.apply === true;

  return {
    targetPath,
    model,
    applyChanges,
  };
}

function buildPrompt(options: MigrationOptions): string {
  const { targetPath, applyChanges } = options;

  return `
You are a migration assistant tasked with updating an existing Claude agent to match the shared lib patterns.

Target agent: ${targetPath}

Focus on these upgrades:
1. Replace direct SDK usage with the shared helpers in ./agents/lib (claude wrapper, parsedArgs, getPositionals, Settings, etc.).
2. Standardize CLI handling:
   - Use the shared parsedArgs to pull flags and positionals.
   - Provide a clear help printer and validation similar to accessibility-audit-healer.
   - Resolve file paths via node:path utilities when needed.
3. Build default flags the new way:
   - Serialize CLAUDE settings (cwd, maxTurns, output config) via --settings JSON.
   - Pass MCP server definitions through --mcp-config JSON objects.
   - Use allowedTools (space-separated) and permission-mode flags for tool access.
   - Add strict-mcp-config when providing custom MCP servers.
4. Ensure the script runs at top level (no manual run() wrapper) and awaits claude directly.
5. Preserve existing agent-specific logic (prompts, logging, domain-specific behavior) while reorganizing structure.
6. Update imports, types, and completion messages to match the style of agents/accessibility-audit-healer.ts.
7. If the agent writes reports or files, maintain that behavior but route configuration through the new settings style.

Migration checklist:
- Keep the shebang as \`#!/usr/bin/env -S bun run\`.
- Ensure any new helpers (e.g., Settings type) are imported from ./lib as needed.
- Remove redundant flag parsing or spawn logic replaced by the shared claude() helper.
- Confirm CLI help text is accurate after the migration.

${applyChanges ? "Apply the necessary edits directly using the Edit tool and save the file when ready." : "Propose the full diff and wait for approval before applying edits."}

When finished, summarize the changes and include any follow-up steps.
`;
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["apply", "model", "help", "h"] as const;

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
console.log(`Target: ${options.targetPath}`);
console.log(`Model: ${options.model}`);
console.log(`Apply changes: ${options.applyChanges ? "enabled" : "disabled"}`);
console.log("");

const prompt = buildPrompt(options);

const claudeSettings: Settings = {
  cwd: process.cwd(),
  maxTurns: 40,
};

const allowedTools = [
  "Read",
  "Write",
  "Edit",
  "TodoWrite",
  "Grep",
  "Glob",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: options.model,
  settings: JSON.stringify(claudeSettings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": options.applyChanges ? "acceptEdits" : "default",
  ...(options.applyChanges ? { 'dangerously-skip-permissions': true } : {}),
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✅ Migration session complete\n");
    console.log("Next steps:");
    console.log("1. Review the proposed or applied changes");
    console.log("2. Run relevant tests or scripts");
    console.log("3. Commit the migration once verified");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
