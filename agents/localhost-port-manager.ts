#!/usr/bin/env -S bun run

/**
 * Localhost Port Manager
 *
 * A practical everyday agent that eliminates the frustrating "port already in use" error.
 * Scans for processes using development ports, kills zombie processes, and finds available ports.
 *
 * Usage:
 *   bun run agents/localhost-port-manager.ts [--port=N] [--scan-all] [--dry-run]
 *
 * Examples:
 *   # Check common development ports
 *   bun run agents/localhost-port-manager.ts
 *
 *   # Check a specific port
 *   bun run agents/localhost-port-manager.ts --port=3000
 *
 *   # Scan all common ports
 *   bun run agents/localhost-port-manager.ts --scan-all
 *
 *   # Dry run mode (show what would be done)
 *   bun run agents/localhost-port-manager.ts --port=3000 --dry-run
 */

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface PortManagerOptions {
  targetPort: number | null;
  scanAll: boolean;
  dryRun: boolean;
}

const COMMON_PORTS = [3000, 8080, 5173, 8000, 5432, 27017, 6379, 9000, 4200, 3001, 5000, 8888];

function printHelp(): void {
  console.log(`
🔌 Localhost Port Manager

Usage:
  bun run agents/localhost-port-manager.ts [options]

Options:
  --port <number>         Check and manage a specific port
  --scan-all              Scan all common development ports
  --dry-run               Show what would be done without killing processes
  --help, -h              Show this help

Examples:
  bun run agents/localhost-port-manager.ts
  bun run agents/localhost-port-manager.ts --port 3000
  bun run agents/localhost-port-manager.ts --scan-all
  bun run agents/localhost-port-manager.ts --port 3000 --dry-run
  `);
}

function parseOptions(): PortManagerOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawPort = values.port;
  const targetPort = typeof rawPort === "string" || typeof rawPort === "number"
    ? parseInt(String(rawPort))
    : null;

  if (targetPort !== null && (isNaN(targetPort) || targetPort < 1 || targetPort > 65535)) {
    console.error("❌ Error: Invalid port number. Must be between 1 and 65535");
    process.exit(1);
  }

  const scanAll = values["scan-all"] === true || values.scanAll === true;
  const dryRun = values["dry-run"] === true || values.dryRun === true;

  return {
    targetPort,
    scanAll,
    dryRun,
  };
}

function buildPrompt(options: PortManagerOptions): string {
  const { targetPort, scanAll, dryRun } = options;

  return `You are a Localhost Port Manager - a specialized agent that helps developers resolve port conflicts and manage development server ports efficiently.

Your task is to analyze port usage on this system and help resolve "port already in use" errors.

## Analysis Steps:

1. **Identify target ports**: ${targetPort ? `Focus on port ${targetPort}` : scanAll ? `Scan all common development ports: ${COMMON_PORTS.join(", ")}` : `Scan common development ports: ${COMMON_PORTS.slice(0, 6).join(", ")}`}
2. **Check port availability**: Use lsof, netstat, or similar commands to find which processes are using these ports
3. **Identify process details**: For each occupied port, get:
   - Process ID (PID)
   - Process name
   - Command that started it
   - User who started it
   - How long it's been running
4. **Classify processes**:
   - **Active dev servers**: Running development servers that might be intentionally running
   - **Zombie processes**: Orphaned processes from crashed/stopped dev sessions
   - **System processes**: Important system services (databases, etc.)
   - **Unknown processes**: Processes that aren't easily identifiable
5. **Find available ports**: If requested ports are occupied, suggest alternative available ports
6. **Check project configuration**: Look for port configurations in:
   - package.json (scripts section)
   - .env files
   - vite.config.ts/js
   - next.config.js
   - Other common config files

## Port Management Actions:

${dryRun ? "## DRY RUN MODE\nYou are in dry-run mode. Show what WOULD be done but DO NOT execute any kill commands or configuration changes." : "## ACTIVE MODE\nYou can kill processes and update configurations after analyzing the situation."}

For each occupied port:
1. **If it's a zombie process**: ${dryRun ? "Suggest" : "Offer to"} kill it safely
2. **If it's an active dev server**: Report it and ask if the user wants to kill it
3. **If it's a system process**: Warn the user and suggest using an alternative port instead
4. **If port conflict detected**: ${dryRun ? "Suggest" : "Offer to"} update project configuration to use available port

## Output Format:

Generate a clear report with:
1. **Port Status Summary**:
   - Total ports scanned
   - Occupied ports
   - Available ports
   - Conflicts detected
2. **Detailed Port Analysis**:
   - For each occupied port: PID, process name, command, runtime duration
   - Classification (zombie, active, system, unknown)
3. **Recommended Actions**:
   - Which processes to kill
   - Alternative ports to use
   - Configuration files that need updating
4. **Available Ports**: List of nearby available ports if conflicts exist
${dryRun ? "5. **Dry Run Summary**: Show commands that would be executed" : ""}

## Important Safety Rules:
- NEVER kill system processes without explicit warning
- NEVER kill database processes (postgres, mongodb, redis) unless explicitly confirmed by user
- Always show process details before killing
- Verify the user owns the process before attempting to kill it
- When updating config files, create backups or show diffs first
- If unsure about a process, ask the user before taking action

## Project Port Registry:
Optionally create/update a .port-registry.json file in the project root to track:
- Which ports this project uses
- When they were last used
- What services run on each port

Start by scanning for port usage and generating the port management report.`;
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["port", "scan-all", "scanAll", "dry-run", "dryRun", "help", "h"] as const;

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

console.log("🔌 Localhost Port Manager\n");
if (options.targetPort) {
  console.log(`Target port: ${options.targetPort}`);
} else {
  console.log(`Scanning: ${options.scanAll ? "All common ports" : "Common ports"}`);
}
console.log(`Mode: ${options.dryRun ? "Dry run" : "Active"}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": options.dryRun ? "acceptEdits" : "default",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✅ Port analysis complete!");
    if (options.dryRun) {
      console.log("\n💡 This was a dry run - no processes were killed");
    }
    console.log("\nNext steps:");
    console.log("1. Review identified port conflicts");
    console.log("2. Kill zombie processes if found");
    console.log("3. Update project configuration if needed");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}