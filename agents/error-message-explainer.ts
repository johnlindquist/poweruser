#!/usr/bin/env bun

/**
 * Error Message Explainer Agent
 *
 * A tiny quick agent that translates cryptic errors into actionable fixes.
 * Runs in under 3 seconds.
 *
 * Usage: bun run agents/error-message-explainer.ts "your error message here"
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

const errorMessage = process.argv.slice(2).join(" ");

if (!errorMessage) {
  console.error("❌ Please provide an error message to explain.");
  console.error("\nUsage: bun run agents/error-message-explainer.ts \"your error message\"");
  console.error("\nExample: bun run agents/error-message-explainer.ts \"TypeError: Cannot read property 'foo' of undefined\"");
  process.exit(1);
}

const prompt = `You are an expert debugging assistant. Analyze this error message and help fix it quickly.

ERROR MESSAGE:
${errorMessage}

Your task:
1. Search the codebase for where this error might be occurring using Grep
2. Read relevant files to understand the context
3. Explain the error in plain English (what went wrong, why, what it means)
4. Provide 2-3 specific fix suggestions ranked by likelihood of success
5. Show relevant code snippets with file:line references

Be concise and actionable. This should take under 3 seconds.

IMPORTANT RULES:
- Use Grep to search for error-related patterns (function names, error types, stack trace elements)
- Read only the most relevant files (max 3)
- Focus on the most likely cause first
- Provide specific line numbers and file paths
- Give concrete fix examples, not just general advice
- If this is a common framework error, mention it and link to relevant docs`;

console.log("🔍 Analyzing error message...\n");

(async () => {
  try {
    const result = query({
      prompt,
      options: {
        allowedTools: ["Grep", "Read"],
        permissionMode: "bypassPermissions",
        maxTurns: 5,
      }
    });

    let finalResult = "";
    for await (const message of result) {
      if (message.type === "result" && message.subtype === "success") {
        finalResult = message.result;
      }
    }

    if (finalResult) {
      console.log("\n📋 Analysis Complete:\n");
      console.log(finalResult);
      console.log("\n✅ Done!");
    }
  } catch (error) {
    console.error("❌ Error analyzing message:", error);
    process.exit(1);
  }
})();
