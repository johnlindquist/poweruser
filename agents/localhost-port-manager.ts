#!/usr/bin/env bun

/**
 * Localhost Port Manager
 *
 * A practical everyday agent that eliminates the frustrating "port already in use" error.
 * Scans for processes using development ports, kills zombie processes, and finds available ports.
 *
 * Usage:
 *   bun run agents/localhost-port-manager.ts [--port=3000] [--scan-all] [--dry-run]
 *
 * Options:
 *   --port=N      Check and manage a specific port (default: scan common ports)
 *   --scan-all    Scan all common development ports
 *   --dry-run     Show what would be done without actually killing processes
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const scanAll = args.includes("--scan-all");
const portArg = args.find((arg) => arg.startsWith("--port="));
const targetPort = portArg ? parseInt(portArg.split("=")[1] || "0") : null;

const commonPorts = [3000, 8080, 5173, 8000, 5432, 27017, 6379, 9000, 4200, 3001, 5000, 8888];

const prompt = `You are a Localhost Port Manager - a specialized agent that helps developers resolve port conflicts and manage development server ports efficiently.

Your task is to analyze port usage on this system and help resolve "port already in use" errors.

## Analysis Steps:

1. **Identify target ports**: ${targetPort ? `Focus on port ${targetPort}` : scanAll ? `Scan all common development ports: ${commonPorts.join(", ")}` : `Scan common development ports: ${commonPorts.slice(0, 6).join(", ")}`}
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

async function main() {
  console.log("🔌 Localhost Port Manager starting...\n");
  console.log(`Configuration:`);
  if (targetPort) {
    console.log(`  - Target port: ${targetPort}`);
  } else {
    console.log(`  - Scanning common ports: ${scanAll ? "ALL" : "COMMON"}`);
  }
  console.log(`  - Dry run mode: ${dryRun ? "YES" : "NO"}`);
  console.log();

  const result = query({
    prompt,
    options: {
      permissionMode: dryRun ? "acceptEdits" : "default",
      allowedTools: [
        "Bash",
        "Read",
        "Write",
        "Edit",
        "Glob",
        "Grep",
        "TodoWrite",
      ],
      maxTurns: 25,
    },
  });

  // Stream the agent's responses
  for await (const message of result) {
    if (message.type === "assistant") {
      // Process text content
      for (const block of message.message.content) {
        if (block.type === "text") {
          console.log(block.text);
        }
      }
    } else if (message.type === "result") {
      if (message.subtype === "success") {
        console.log("\n✅ Port analysis complete!");
        console.log(`\nStatistics:`);
        console.log(`  - Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`  - Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`  - Turns: ${message.num_turns}`);
      } else if (message.subtype === "error_max_turns") {
        console.error("\n❌ Error: Maximum turns reached");
        process.exit(1);
      } else {
        console.error("\n❌ Error during execution");
        process.exit(1);
      }
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});