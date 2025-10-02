#!/usr/bin/env -S bun run

/**
 * Interactive Migration Assistant
 *
 * An agent that helps migrate codebases between frameworks/versions with:
 * - Codebase analysis and migration planning
 * - Step-by-step incremental migrations with user approval
 * - Automated pattern updates (imports, APIs, deprecated code)
 * - Test validation after each step
 * - Rollback capability on failures
 *
 * Usage:
 *   bun run agents/migration-assistant.ts <migration-goal> [options]
 *
 * Examples:
 *   bun run agents/migration-assistant.ts "Migrate from React 17 to React 18"
 *   bun run agents/migration-assistant.ts "Upgrade Express 4 to Express 5"
 *   bun run agents/migration-assistant.ts "Convert Jest to Vitest"
 *   bun run agents/migration-assistant.ts "Migrate to TypeScript 5" --strict
 */

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface MigrationOptions {
  migrationGoal: string;
  strict: boolean;
}

function printHelp(): void {
  console.log(`
🔄 Interactive Migration Assistant

Usage:
  bun run agents/migration-assistant.ts <migration-goal> [options]

Arguments:
  migration-goal          Description of the migration to perform

Options:
  --strict                Enable strict mode with conservative changes only
  --help, -h              Show this help

Examples:
  bun run agents/migration-assistant.ts "Migrate from React 17 to React 18"
  bun run agents/migration-assistant.ts "Upgrade Express 4 to Express 5"
  bun run agents/migration-assistant.ts "Convert Jest to Vitest"
  bun run agents/migration-assistant.ts "Migrate to TypeScript 5" --strict
  `);
}

function parseOptions(): MigrationOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const migrationGoal = positionals[0];
  if (!migrationGoal) {
    console.error("❌ Error: Migration goal is required");
    printHelp();
    process.exit(1);
  }

  const strict = values.strict === true;

  return {
    migrationGoal,
    strict,
  };
}

function buildPrompt(options: MigrationOptions): string {
  const { migrationGoal, strict } = options;

  return `You are an Interactive Migration Assistant. Your goal is to help migrate this codebase with the following objective:

${migrationGoal}

Follow this process:

1. **Analysis Phase**
   - Analyze the current codebase structure
   - Identify all files that need changes
   - Check current dependency versions
   - Identify deprecated patterns and breaking changes
   - Create a comprehensive migration plan with steps

2. **Planning Phase**
   - Use TodoWrite to create a detailed task list
   - Break down the migration into small, safe steps
   - Identify potential risks and rollback points
   - Present the plan to the user for approval

3. **Execution Phase** (only after user approval)
   - Execute each migration step incrementally
   - Run tests after EVERY step to validate correctness
   - If tests fail, rollback the changes and report the issue
   - Mark tasks as completed in the todo list
   - Provide clear progress updates

4. **Validation Phase**
   - Run full test suite
   - Check for any remaining deprecated patterns
   - Generate a migration report with:
     - Changes made
     - Test results
     - Known issues or warnings
     - Recommended next steps

**Important Guidelines:**
- NEVER make changes without analyzing first
- ALWAYS use TodoWrite to track progress
- ALWAYS run tests after each change
- If any tests fail, STOP and report the failure
- Ask for user confirmation before major changes
- Provide rollback instructions if something goes wrong
- Be conservative and safe - it's better to take small steps${strict ? `
- STRICT MODE ENABLED: Only make the most conservative changes
- Avoid any changes that could potentially break existing functionality
- Prefer manual review over automatic changes when in doubt` : ""}

Start by analyzing the codebase.`;
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["strict", "help", "h"] as const;

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

console.log("🔄 Interactive Migration Assistant\n");
console.log(`📋 Migration Goal: ${options.migrationGoal}`);
console.log(`Strict Mode: ${options.strict ? "Enabled" : "Disabled"}`);
console.log("");

const systemPrompt = buildPrompt(options);

// Build hooks for monitoring migration process
const hooks = {
  PreToolUse: [
    {
      hooks: [
        {
          type: "command" as const,
          command: `node -e "const input = JSON.parse(process.argv[1]); if (input.tool_name === 'Edit' || input.tool_name === 'Write') { const filePath = input.tool_input?.file_path || ''; if (filePath.includes('package.json') || filePath.includes('package-lock.json') || filePath.includes('tsconfig.json')) { console.log(\\\`⚠️  About to modify critical file: \\\${filePath}\\\`); } } if (input.tool_name === 'Bash') { const command = input.tool_input?.command || ''; if (command.includes('test') || command.includes('npm test')) { console.log('🧪 Running tests...'); } }" -- "$CLAUDE_HOOK_INPUT"`
        }
      ]
    }
  ],
  PostToolUse: [
    {
      hooks: [
        {
          type: "command" as const,
          command: `node -e "const input = JSON.parse(process.argv[1]); if (input.tool_name === 'Bash') { const command = input.tool_input?.command || ''; const output = input.tool_response?.output || ''; if (command.includes('test') || command.includes('npm test')) { if (output.includes('FAIL') || output.includes('failed')) { console.log('❌ Tests failed! Migration step may have issues.'); } else if (output.includes('PASS') || output.includes('passed')) { console.log('✅ Tests passed! Safe to continue.'); } } }" -- "$CLAUDE_HOOK_INPUT"`
        }
      ]
    }
  ]
};

const settings: Settings = {
  hooks
};

const allowedTools = [
  "Read",
  "Glob",
  "Grep",
  "Bash",
  "Edit",
  "Write",
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": options.strict ? "default" : "acceptEdits",
  "append-system-prompt": systemPrompt,
};

try {
  const exitCode = await claude("", defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Migration complete!\n");
    console.log("Next steps:");
    console.log("1. Review all changes made during migration");
    console.log("2. Run full test suite to validate");
    console.log("3. Check for any remaining deprecated patterns");
    console.log("4. Commit changes incrementally");
  } else {
    console.log("\n⚠️  Migration was interrupted or encountered errors.");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}