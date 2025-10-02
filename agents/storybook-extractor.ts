#!/usr/bin/env -S bun run
/**
 * STORYBOOK-EXTRACTOR: Launch Claude with a design system extraction prompt
 *
 * - Analyzes existing codebases to extract design patterns and tokens
 * - Generates Storybook stories from discovered patterns
 * - Creates design system documentation from implicit styles
 *
 * Usage:
 *   bun run agents/storybook-extractor.ts --scan
 *   bun run agents/storybook-extractor.ts --extract colors
 *   bun run agents/storybook-extractor.ts --generate-stories
 *   bun run agents/storybook-extractor.ts --full-extraction
 */

import { spawn } from "bun";
import type { ClaudeFlags } from "./lib/claude-flags.types";
import { buildClaudeFlags, getPositionals, parsedArgs } from "./lib/flags";

// Inline MCP configuration
const extractorMcp = {
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
};

// Inline settings configuration
const extractorSettings = {
  "permissions": {
    "defaultMode": "default",
    "allow": [
      "mcp__chrome-devtools__navigate_page",
      "mcp__chrome-devtools__click",
      "mcp__chrome-devtools__fill",
      "mcp__chrome-devtools__wait_for",
      "mcp__chrome-devtools__take_screenshot",
      "mcp__chrome-devtools__take_snapshot",
      "mcp__chrome-devtools__evaluate_script"
    ]
  },
  "outputStyle": "storybook-extractor"
};

function resolvePath(relativeFromThisFile: string): string {
    const url = new URL(relativeFromThisFile, import.meta.url);
    return url.pathname;
}

const projectRoot = resolvePath("../");

async function main() {
    const positionals = getPositionals();
    const userPrompt = positionals.join(" ").trim();

    // Parse extraction-specific flags
    const extractionMode = parsedArgs.values["scan"] ? "scan" :
                          parsedArgs.values["extract"] ? `extract ${parsedArgs.values["extract"]}` :
                          parsedArgs.values["generate-stories"] ? "generate-stories" :
                          parsedArgs.values["full-extraction"] ? "full-extraction" :
                          "";

    const extractionPrompt = extractionMode ?
        `Begin extraction process: ${extractionMode}. Analyze the current project directory and extract design patterns according to the extraction methodology.` :
        userPrompt;

    // Merge user-provided flags with our defaults
    const flags = buildClaudeFlags(
        {
            settings: JSON.stringify(extractorSettings),
            "mcp-config": JSON.stringify(extractorMcp),
            "model": "sonnet",
            "dangerously-skip-permissions": true
        },
        parsedArgs.values as ClaudeFlags,
    );
    const args = extractionPrompt ? [...flags, extractionPrompt] : [...flags];

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
