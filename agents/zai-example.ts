#!/usr/bin/env -S bun run

/**
 * Z.ai Example Agent
 *
 * This agent demonstrates using Claude via the Z.ai API endpoint.
 * It accepts a prompt and uses Z.ai's Anthropic-compatible API.
 *
 * Usage:
 *   bun run agents/zai-example.ts <prompt> [options]
 *
 * Examples:
 *   # Basic query
 *   bun run agents/zai-example.ts "What is the capital of France?"
 *
 *   # With custom system prompt
 *   bun run agents/zai-example.ts "Explain quantum computing" --system "You are a physics professor"
 */

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface ZaiExampleOptions {
  prompt: string;
  systemPrompt: string;
}

const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

function printHelp(): void {
  console.log(`
Z.ai Example Agent

Usage:
  bun run agents/zai-example.ts <prompt> [options]

Arguments:
  prompt                  The prompt/question to send to Claude

Options:
  --system <prompt>       Custom system prompt (default: "${DEFAULT_SYSTEM_PROMPT}")
  --help, -h              Show this help

Examples:
  bun run agents/zai-example.ts "What is the capital of France?"
  bun run agents/zai-example.ts "Explain quantum computing" --system "You are a physics professor"
  `);
}

function parseOptions(): ZaiExampleOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const prompt = positionals[0];
  if (!prompt) {
    console.error("❌ Error: Prompt is required as the first argument");
    printHelp();
    process.exit(1);
  }

  const rawSystem = values.system;
  const systemPrompt = typeof rawSystem === "string" && rawSystem.length > 0
    ? rawSystem
    : DEFAULT_SYSTEM_PROMPT;

  return {
    prompt,
    systemPrompt,
  };
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["system", "help", "h"] as const;

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

console.log("🤖 Z.ai Example Agent\n");

const settings: Settings = {
  env: {
    ANTHROPIC_AUTH_TOKEN: process.env.ZAI_API_KEY || "",
    ANTHROPIC_BASE_URL: "https://api.z.ai/api/anthropic",
  },
};

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  "append-system-prompt": options.systemPrompt,
};

try {
  const exitCode = await claude(options.prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Query complete!\n");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}