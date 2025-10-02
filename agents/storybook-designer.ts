#!/usr/bin/env -S bun run
/**
 * STORYBOOK-DESIGNER: Launch Claude with a design partner system prompt appended
 *
 * - Uses inline configuration for MCP and settings
 * - Provides design-focused development environment
 *
 * Usage:
 *   bun run agents/storybook-designer.ts "<your design task>"
 */

import { spawn } from "bun";
import type { ClaudeFlags } from "./lib/claude-flags.types";
import { buildClaudeFlags, getPositionals, parsedArgs } from "./lib/flags";

// Inline MCP configuration
const designerMcp = {
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
};

// Inline settings configuration
const designerSettings = {
  "permissions": {
    "defaultMode": "default",
    "allow": [
      "mcp__chrome-devtools__navigate_page",
      "mcp__chrome-devtools__click",
      "mcp__chrome-devtools__fill",
      "mcp__chrome-devtools__wait_for",
      "mcp__chrome-devtools__take_screenshot",
      "mcp__chrome-devtools__take_snapshot"
    ]
  },
  "outputStyle": "storybook-designer"
};

function resolvePath(relativeFromThisFile: string): string {
    const url = new URL(relativeFromThisFile, import.meta.url);
    return url.pathname;
}

const projectRoot = resolvePath("../");

async function main() {
    const positionals = getPositionals();
    const userPrompt = positionals.join(" ").trim();

    // Merge user-provided flags with our defaults
    const flags = buildClaudeFlags(
        {
            settings: JSON.stringify(designerSettings),
            "mcp-config": JSON.stringify(designerMcp),
            "model": "sonnet",
            "dangerously-skip-permissions": true
        },
        parsedArgs.values as ClaudeFlags,
    );
    const args = userPrompt ? [...flags, userPrompt] : [...flags];

    const child = spawn(["claude", ...args], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
        env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: projectRoot,
        },
    });

    const onExit = () => {
        try {
            child.kill("SIGTERM");
        } catch { }
    };
    process.on("SIGINT", onExit);
    process.on("SIGTERM", onExit);

    await child.exited;
    process.exit(child.exitCode ?? 0);
}

await main();
