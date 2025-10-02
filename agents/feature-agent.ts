#!/usr/bin/env -S bun run
/**
 * FEATURE-AGENT: Ticket-driven feature implementation agent
 *
 * - Fetches tickets from issue tracking systems (GitHub, Jira, Linear, etc.)
 * - Analyzes requirements and creates implementation plans
 * - Implements features with continuous user feedback
 * - Validates against acceptance criteria
 *
 * Usage:
 *   bun run agents/feature-agent.ts PROJ-123
 *   bun run agents/feature-agent.ts --ticket PROJ-123
 *   bun run agents/feature-agent.ts --url https://github.com/owner/repo/issues/123
 *   bun run agents/feature-agent.ts  # Will prompt for ticket info
 */

import { spawn } from "bun";
import type { ClaudeFlags } from "./lib/claude-flags.types";
import { buildClaudeFlags, getPositionals, parsedArgs } from "./lib/flags";

// Inline MCP configuration
const featureMcp = {
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
};

// Inline settings configuration
const featureSettings = {
  "permissions": {
    "defaultMode": "default",
    "allow": [
      "mcp__chrome-devtools__navigate_page",
      "mcp__chrome-devtools__click",
      "mcp__chrome-devtools__fill",
      "mcp__chrome-devtools__fill_form",
      "mcp__chrome-devtools__wait_for",
      "mcp__chrome-devtools__take_screenshot",
      "mcp__chrome-devtools__take_snapshot",
      "mcp__chrome-devtools__evaluate_script",
      "mcp__chrome-devtools__list_network_requests",
      "mcp__chrome-devtools__get_network_request",
      "mcp__chrome-devtools__list_console_messages",
      "gh"
    ]
  },
  "outputStyle": "feature-agent",
  "environment": {
    "trackProgress": true,
    "autoCommit": false,
    "testFirst": false,
    "verboseLogging": true
  }
};

function resolvePath(relativeFromThisFile: string): string {
    const url = new URL(relativeFromThisFile, import.meta.url);
    return url.pathname;
}

const projectRoot = resolvePath("../");

/**
 * Parse ticket information from CLI arguments
 */
function parseTicketInfo(): { ticketId?: string; ticketUrl?: string; prompt: string } {
    const positionals = getPositionals();
    const ticketFlag = parsedArgs.values["ticket"] as string | undefined;
    const urlFlag = parsedArgs.values["url"] as string | undefined;

    // Check for ticket ID in various formats
    let ticketId: string | undefined;
    let ticketUrl: string | undefined;
    let additionalPrompt = "";

    if (urlFlag) {
        // URL provided via --url flag
        ticketUrl = urlFlag;
    } else if (ticketFlag) {
        // Ticket ID provided via --ticket flag
        ticketId = ticketFlag;
    } else if (positionals.length > 0) {
        // Check if first positional is a ticket ID or URL
        const firstArg = positionals[0];

        // Common ticket ID patterns
        const ticketPatterns = [
            /^[A-Z]+-\d+$/,        // JIRA style: PROJ-123
            /^#\d+$/,              // GitHub style: #123
            /^[A-Z]{2,}-\d+$/,     // Linear style: LIN-789
            /^\d+$/,               // Plain number (GitHub issue)
        ];

        // Check if it's a URL
        if (firstArg && (firstArg.startsWith("http://") || firstArg.startsWith("https://"))) {
            ticketUrl = firstArg;
            additionalPrompt = positionals.slice(1).join(" ");
        } else if (firstArg && ticketPatterns.some(pattern => pattern.test(firstArg))) {
            ticketId = firstArg;
            additionalPrompt = positionals.slice(1).join(" ");
        } else {
            // No ticket info found, treat all positionals as additional prompt
            additionalPrompt = positionals.join(" ");
        }
    }

    // Build the initial prompt
    let prompt = "";

    if (ticketUrl) {
        prompt = `Fetch and implement the feature from this ticket URL: ${ticketUrl}`;
    } else if (ticketId) {
        prompt = `Fetch and implement the feature from ticket: ${ticketId}`;
    } else if (!additionalPrompt) {
        prompt = "No ticket ID or URL provided. Please provide either:\n" +
                "1. A ticket ID (e.g., PROJ-123, #456)\n" +
                "2. A full URL to the ticket\n" +
                "3. Or paste the ticket details directly";
    }

    if (additionalPrompt) {
        prompt = prompt ? `${prompt}\n\nAdditional context: ${additionalPrompt}` : additionalPrompt;
    }

    return { ticketId, ticketUrl, prompt };
}

async function main() {
    const { ticketId, ticketUrl, prompt } = parseTicketInfo();

    // Log what we're doing for clarity
    if (ticketId) {
        console.log(`🎫 Fetching ticket: ${ticketId}`);
    } else if (ticketUrl) {
        console.log(`🔗 Fetching ticket from URL: ${ticketUrl}`);
    }

    // Merge user-provided flags with our defaults
    const flags = buildClaudeFlags(
        {
            settings: JSON.stringify(featureSettings),
            "mcp-config": JSON.stringify(featureMcp),
            "model": "sonnet",
            "dangerously-skip-permissions": true
        },
        parsedArgs.values as ClaudeFlags,
    );

    const args = prompt ? [...flags, prompt] : [...flags];

    const child = spawn(["claude", ...args], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
        env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: projectRoot,
            FEATURE_TICKET_ID: ticketId || "",
            FEATURE_TICKET_URL: ticketUrl || "",
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
