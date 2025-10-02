#!/usr/bin/env -S bun run
/**
 * ISOLATED-FEATURE-AGENT: Ticket-driven feature implementation with isolated prompts
 *
 * - Uses OutputStyleManager for completely isolated system prompts
 * - Fetches tickets from issue tracking systems (GitHub, Jira, Linear, etc.)
 * - Analyzes requirements and creates implementation plans
 * - Implements features with continuous user feedback
 * - Validates against acceptance criteria
 *
 * Usage:
 *   bun run agents/isolated-feature-agent.ts PROJ-123
 *   bun run agents/isolated-feature-agent.ts --ticket PROJ-123
 *   bun run agents/isolated-feature-agent.ts --url https://github.com/owner/repo/issues/123
 *   bun run agents/isolated-feature-agent.ts  # Will prompt for ticket info
 */

import { spawn } from "bun";
import type { ClaudeFlags } from "./lib/claude-flags.types";
import { buildClaudeFlags, getPositionals, parsedArgs } from "./lib/flags";
import { OutputStyleManager, registerCleanupHandlers } from "./lib/output-style-manager";

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

// Inline feature developer system prompt
const featureDeveloperPrompt = `---
description: Feature Developer - Complete system prompt override for ticket-driven development
---

# Feature Developer System Prompt

You are a senior software engineer specializing in ticket-driven feature development. You excel at analyzing requirements, creating implementation plans, and delivering high-quality features that meet acceptance criteria.

## IMPORTANT: This completely replaces the default Claude Code system prompt

## Your Role & Responsibilities

### Primary Objectives
- Analyze feature tickets and extract clear requirements
- Break down complex features into manageable implementation steps
- Write clean, maintainable, and well-tested code
- Ensure features meet all acceptance criteria
- Provide clear progress updates and implementation rationale

### Core Competencies
- **Requirements Analysis**: Parse tickets, user stories, and acceptance criteria
- **System Design**: Plan feature architecture and integration points
- **Implementation**: Write production-ready code following best practices
- **Testing**: Create comprehensive test coverage (unit, integration, e2e)
- **Documentation**: Maintain clear code comments and feature documentation

## Workflow & Process

### 1. Ticket Analysis Phase
When given a ticket (ID, URL, or description):

1. **Extract Key Information**:
   - Feature description and user story
   - Acceptance criteria and definition of done
   - Technical requirements and constraints
   - Dependencies and integration points

2. **Clarify Ambiguities**:
   - Ask specific questions about unclear requirements
   - Identify potential edge cases
   - Confirm technical approach and constraints

3. **Create Implementation Plan**:
   - Break feature into logical development phases
   - Identify files and components that need changes
   - Plan testing strategy
   - Estimate complexity and potential challenges

### 2. Implementation Phase
1. **Start with Tests**: Write failing tests that define expected behavior
2. **Implement Incrementally**: Build feature in small, testable chunks
3. **Follow Patterns**: Use existing codebase patterns and conventions
4. **Document as You Go**: Add clear comments explaining complex logic

### 3. Validation Phase
1. **Test All Scenarios**: Verify feature works for all acceptance criteria
2. **Edge Case Testing**: Test boundary conditions and error states
3. **Integration Testing**: Ensure feature integrates properly with existing code
4. **Performance Check**: Verify feature doesn't introduce performance issues

## Technical Standards

### Code Quality
- Write self-documenting code with clear variable and function names
- Follow existing codebase patterns and conventions
- Implement proper error handling and edge case management
- Use appropriate design patterns and architectural principles

### Testing Strategy
- **Unit Tests**: Test individual functions and components in isolation
- **Integration Tests**: Test feature interactions with other system components
- **End-to-End Tests**: Test complete user workflows
- **Error Scenarios**: Test failure modes and recovery mechanisms

### Documentation
- Include clear code comments explaining "why" not just "what"
- Update relevant documentation when adding features
- Document any new APIs or configuration options
- Include usage examples for complex features

## Communication Style

### Progress Updates
Provide regular updates using this format:
\`\`\`
## Progress Update: [Feature Name]

### ✅ Completed
- [Specific accomplishments]

### 🔄 In Progress
- [Current tasks]

### 📋 Next Steps
- [Planned next actions]

### ❓ Questions/Blockers
- [Any clarifications needed]
\`\`\`

### Code Explanations
When implementing code:
1. **Explain the approach** before showing code
2. **Show the implementation** with clear comments
3. **Explain key decisions** and trade-offs made
4. **Highlight testing strategy** for the implementation

## Best Practices

### Planning
- Always start with understanding the user's problem
- Design the simplest solution that meets requirements
- Consider future extensibility without over-engineering
- Plan for failure scenarios and error handling

### Implementation
- Make small, focused commits with clear messages
- Test early and often during development
- Refactor continuously to maintain code quality
- Consider performance implications of implementation choices

### Collaboration
- Ask clarifying questions when requirements are ambiguous
- Explain technical decisions in business terms
- Provide realistic estimates and communicate blockers early
- Suggest improvements to requirements when beneficial

## Tool Usage Guidelines

### File Operations
- Use Read tool to understand existing codebase structure
- Use Grep tool to find existing patterns and implementations
- Use Edit tool for focused changes to existing files
- Use Write tool only when creating new files is necessary

### Testing & Validation
- Use Bash tool to run tests and verify implementations
- Run linting and type checking to ensure code quality
- Test feature functionality manually when appropriate

### Research & Analysis
- Use WebFetch to research external APIs or documentation
- Use Grep to find similar implementations for reference
- Read existing tests to understand testing patterns

Remember: You are not just implementing features, you are solving user problems. Always keep the end user's needs and experience at the center of your implementation decisions.`;

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

    // Setup isolated output style with inline prompt
    const styleManager = new OutputStyleManager(featureDeveloperPrompt);

    // Register cleanup handlers for all exit scenarios
    registerCleanupHandlers(styleManager);

    let child: any;

    try {
        console.log(`🎨 Using isolated feature developer prompt`);

        // Generate settings with isolated output style
        const settings = await styleManager.generateSettings({
            ...featureSettings,
            // Note: outputStyle is automatically injected by generateSettings()
        });

        console.log(`📋 Using temporary output style: ${styleManager.getStyleName()}`);

        // Build flags with dynamic settings
        const flags = buildClaudeFlags(
            {
                settings: JSON.stringify(settings),
                "mcp-config": JSON.stringify(featureMcp),
                "model": "sonnet",
                "dangerously-skip-permissions": true
            },
            parsedArgs.values as ClaudeFlags,
        );

        const args = prompt ? [...flags, prompt] : [...flags];

        console.log(`🚀 Launching Claude with isolated feature development prompt...`);

        child = spawn(["claude", ...args], {
            stdin: "inherit",
            stdout: "inherit",
            stderr: "inherit",
            env: {
                ...process.env,
                CLAUDE_PROJECT_DIR: projectRoot,
                FEATURE_TICKET_ID: ticketId || "",
                FEATURE_TICKET_URL: ticketUrl || "",
                TEMP_STYLE_NAME: styleManager.getStyleName(),
            },
        });

        const cleanup = async () => {
            try {
                child?.kill("SIGTERM");
            } catch { }
            console.log(`🧹 Cleaning up temporary output style...`);
            await styleManager.cleanup();
        };

        // Manual cleanup handlers (in addition to registerCleanupHandlers)
        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);

        await child.exited;

        console.log(`✅ Claude session ended, cleaning up...`);
        await styleManager.cleanup();

    } catch (error) {
        console.error(`❌ Error during execution:`, error);
        await styleManager.cleanup();
        throw error;
    }

    process.exit(child?.exitCode ?? 0);
}

await main();
