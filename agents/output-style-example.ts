#!/usr/bin/env -S bun run
/**
 * OUTPUT STYLE EXAMPLE: Launch Claude with custom output style
 *
 * Demonstrates how to:
 * - Inline settings and MCP configuration
 * - Pass custom output styles via --settings flag
 * - Merge user flags with default flags
 *
 * Usage:
 *   bun run agents/output-style-example.ts "<your prompt>"
 */

import { claude, getPositionals } from "./lib";

// Inline settings configuration
const settingsConfig = {
    outputStyle: "socrates",
};

const [userPrompt] = getPositionals()


await claude(userPrompt, {
    settings: JSON.stringify(settingsConfig),
    model: "sonnet",
});

