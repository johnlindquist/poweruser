#!/usr/bin/env -S bun run

/**
 * Agent Explainer
 *
 * Your comprehensive guide to understanding and creating Claude Code agents.
 * This agent is loaded with complete SDK documentation, CLI references, hooks,
 * and examples from all existing agents in this repository.
 *
 * Purpose:
 * - Explain how any existing agent works
 * - Brainstorm ideas for new agents
 * - Provide implementation guidance for custom agents
 * - Document agent architecture patterns and best practices
 * - Answer questions about the SDK, tools, hooks, and workflows
 *
 * What makes this agent special:
 * - Full access to agent-sdk-reference-prompt.md (complete TypeScript SDK API)
 * - Complete CLI reference including all flags and commands
 * - Comprehensive hooks documentation (PreToolUse, PostToolUse, SessionStart, etc.)
 * - Examples from 90+ existing agents in this repository
 * - Access to ideas.md for future agent inspiration
 * - Knowledge of project conventions from CLAUDE.md
 *
 * Usage:
 *   bun run agents/agent-explainer.ts [query] [options]
 *
 * Examples:
 *   # Ask how a specific agent works
 *   bun run agents/agent-explainer.ts "How does the npm-package-auditor work?"
 *
 *   # Brainstorm new agent ideas
 *   bun run agents/agent-explainer.ts "I want to create an agent that analyzes API endpoints"
 *
 *   # Get implementation guidance
 *   bun run agents/agent-explainer.ts "How do I use hooks in my agent?"
 *
 *   # Interactive mode
 *   bun run agents/agent-explainer.ts
 *
 * Options:
 *   --verbose              Show detailed explanations with code examples
 *   --output <file>        Save the explanation to a file
 *   --focus <topic>        Focus on specific aspect: sdk, cli, hooks, patterns, tools
 *   --help, -h             Show this help message
 */

import { claude, parsedArgs, removeAgentFlags, readStringFlag, readBooleanFlag } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface AgentExplainerOptions {
  query: string | null;
  verbose: boolean;
  outputFile: string | null;
  focus: string | null;
}

function printHelp(): void {
  console.log(`
🤖 Agent Explainer - Your Guide to Claude Code Agents

Usage:
  bun run agents/agent-explainer.ts [query] [options]

Arguments:
  query                   Your question or topic (optional - omit for interactive mode)

Options:
  --verbose              Show detailed explanations with code examples
  --output <file>        Save the explanation to a markdown file
  --focus <topic>        Focus on specific aspect (sdk|cli|hooks|patterns|tools)
  --help, -h             Show this help message

Examples:
  # Explain how an existing agent works
  bun run agents/agent-explainer.ts "How does the dependency-health-monitor work?"

  # Get SDK documentation
  bun run agents/agent-explainer.ts --focus sdk "How do I use the query() function?"

  # Brainstorm new agent ideas
  bun run agents/agent-explainer.ts "Create an agent that monitors database migrations"

  # Learn about hooks
  bun run agents/agent-explainer.ts --focus hooks --verbose "When should I use PreToolUse vs PostToolUse?"

  # Get implementation patterns
  bun run agents/agent-explainer.ts --focus patterns "Show me common agent architecture patterns"

  # Interactive exploration
  bun run agents/agent-explainer.ts

Focus Topics:
  sdk       - TypeScript SDK API reference (query, tools, types, MCP)
  cli       - Command-line interface (flags, commands, workflows)
  hooks     - Hook system (PreToolUse, PostToolUse, SessionStart, etc.)
  patterns  - Agent architecture patterns and best practices
  tools     - Available tools (Bash, Read, Write, Grep, Task, etc.)
  `);
}

function parseOptions(): AgentExplainerOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const query = positionals[0] || null;
  const verbose = readBooleanFlag("verbose", false);
  const outputFile = readStringFlag("output") || null;
  const focus = readStringFlag("focus") || null;

  return {
    query,
    verbose,
    outputFile,
    focus,
  };
}

function buildSystemPrompt(options: AgentExplainerOptions): string {
  const { verbose, focus } = options;

  let focusGuidance = "";
  if (focus) {
    switch (focus.toLowerCase()) {
      case "sdk":
        focusGuidance = `
FOCUS: TypeScript SDK API Reference
Priority topics: query() function, Options type, message types, tool inputs/outputs, MCP servers,
hooks API, permission system, subagents (AgentDefinition), streaming, error handling.
Reference agent-sdk-reference-prompt.md extensively.`;
        break;
      case "cli":
        focusGuidance = `
FOCUS: Command-Line Interface
Priority topics: CLI commands, flags (--print, --model, --agents, etc.), permission modes,
output formats, session management (--resume, --continue), MCP configuration.
Reference CLI documentation extensively.`;
        break;
      case "hooks":
        focusGuidance = `
FOCUS: Hook System
Priority topics: Hook events (PreToolUse, PostToolUse, SessionStart, SessionEnd, Stop, etc.),
hook input/output schemas, matchers, permissions, command vs programmatic hooks.
Reference hooks documentation extensively.`;
        break;
      case "patterns":
        focusGuidance = `
FOCUS: Agent Architecture Patterns
Priority topics: Argument parsing, prompt building, tool selection, error handling,
working directory management, permission modes, reporting formats, CLI utilities.
Analyze existing agents for patterns.`;
        break;
      case "tools":
        focusGuidance = `
FOCUS: Available Tools
Priority topics: Bash, Read, Write, Edit, Glob, Grep, Task (subagents), WebFetch, WebSearch,
TodoWrite, NotebookEdit, tool input/output schemas, when to use each tool.
Reference tool documentation extensively.`;
        break;
      default:
        console.warn(`⚠️  Unknown focus topic "${focus}". Proceeding with general guidance.`);
    }
  }

  return `You are the Agent Explainer, an expert guide for Claude Code agents.

Your knowledge base includes:

1. **Complete SDK Documentation** (agent-sdk-reference-prompt.md):
   - TypeScript SDK API: query(), tool(), createSdkMcpServer()
   - All types: Options, AgentDefinition, Message types, Tool inputs/outputs
   - Hook system: Events, callbacks, input/output schemas
   - Permission system: PermissionMode, CanUseTool, PermissionResult
   - MCP integration: Server configs, tool definitions

2. **CLI Reference Documentation**:
   - All CLI commands and flags
   - Permission modes and workflows
   - Output formats and streaming
   - Session management and resumption
   - MCP server configuration

3. **Hooks Documentation**:
   - All hook events with schemas
   - Exit code behaviors
   - JSON output formats
   - MCP tool hooks
   - Security best practices

4. **Existing Agent Examples** (90+ agents):
   - dependency-health-monitor.ts: Multi-ecosystem dependency scanning
   - npm-package-auditor.ts: npm-focused security auditing
   - All Chrome DevTools agents: Browser automation patterns
   - Code quality agents: Linting, refactoring, dead code detection
   - Career development agents: Learning paths, portfolio generation
   - See the full ./agents/ directory for more examples

5. **Project Conventions** (CLAUDE.md):
   - Agent structure: shebang, imports, argument parsing, prompt building
   - File naming: kebab-case
   - CLI utilities: parsedArgs, readStringFlag, removeAgentFlags
   - Permission patterns: default, acceptEdits, bypassPermissions, plan
   - Allowed tools selection
   - Runtime: Bun with TypeScript

6. **Future Ideas** (ideas.md):
   - Brainstorming material for new agents
   - Patterns for outside-the-box automation
   - Quick agents (under 5 seconds) vs complex agents

${focusGuidance}

Your capabilities:

1. **Explain Existing Agents**:
   - Read agent source code from ./agents/ directory
   - Explain architecture, patterns, and implementation details
   - Highlight interesting techniques and design decisions
   - Compare similar agents and their approaches

2. **Brainstorm New Agents**:
   - Generate creative agent ideas based on user needs
   - Suggest tools, prompts, and architecture
   - Estimate complexity and execution time
   - Reference similar existing agents as inspiration

3. **Provide Implementation Guidance**:
   - Show code examples from SDK and existing agents
   - Explain best practices and conventions
   - Help with tool selection and prompt engineering
   - Guide through hook implementation when needed

4. **Answer SDK/CLI Questions**:
   - Reference exact API signatures and types
   - Explain flag combinations and workflows
   - Clarify permission modes and settings
   - Demonstrate hook patterns and usage

Guidelines:

- **Be Comprehensive**: Load relevant documentation files when needed
- **Use Examples**: Reference existing agents liberally
- **Show Code**: Provide concrete TypeScript examples when helpful
- **Be Practical**: Focus on actionable guidance and real implementations
${verbose ? '- **Be Detailed**: Provide extensive explanations with code snippets and examples\n- **Show Context**: Include surrounding code and full function signatures' : '- **Be Concise**: Keep explanations focused unless detail is requested'}
- **Stay Current**: Base answers on actual code in this repository
- **Cite Sources**: Reference specific files (with line numbers when relevant)

When explaining agents, structure your response:
1. **Purpose**: What the agent does
2. **Architecture**: How it's structured (options, prompt, tools)
3. **Key Patterns**: Interesting implementation details
4. **Usage**: How to run it with examples
5. **Related Agents**: Similar agents or alternative approaches

When brainstorming new agents, provide:
1. **Concept**: Clear description of what the agent would do
2. **Tools Needed**: Which SDK tools would be used
3. **Prompt Strategy**: How to instruct the agent
4. **Architecture**: Recommended structure and options
5. **Example Usage**: Sample CLI invocations
6. **Estimated Complexity**: Quick (<5s), Medium (<90s), or Complex

Remember: You have read access to the entire repository. When answering questions,
actually read the relevant files to provide accurate, up-to-date information.
`.trim();
}

function buildUserPrompt(options: AgentExplainerOptions): string {
  const { query, outputFile } = options;

  if (!query) {
    return `Hello! I'm the Agent Explainer. I can help you:

1. Understand how existing agents work
2. Brainstorm ideas for new agents
3. Get implementation guidance and best practices
4. Learn about the SDK, CLI, hooks, and tools

What would you like to explore?

Some ideas to get started:
- "How does the dependency-health-monitor agent work?"
- "I want to create an agent that analyzes Docker containers"
- "Explain the hook system and when to use different hook types"
- "What tools are available and when should I use each one?"
- "Show me common patterns for parsing agent arguments"`;
  }

  let prompt = query;

  if (outputFile) {
    prompt += `\n\nPlease save the complete explanation to: ${outputFile}`;
  }

  return prompt;
}

// Parse options
const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🤖 Agent Explainer\n");

if (options.query) {
  console.log(`Query: ${options.query}`);
}
if (options.focus) {
  console.log(`Focus: ${options.focus}`);
}
if (options.verbose) {
  console.log("Mode: Verbose");
}
if (options.outputFile) {
  console.log(`Output: ${options.outputFile}`);
}
console.log("");

// Build prompts
const systemPrompt = buildSystemPrompt(options);
const userPrompt = buildUserPrompt(options);

// Configure settings with comprehensive tool access
const settings: Settings = {};

const allowedTools = [
  "Read",          // Read documentation and agent source code
  "Glob",          // Find agents and files
  "Grep",          // Search for patterns in code
  "Write",         // Create output files if requested
  "WebFetch",      // Optional: fetch external documentation
  "TodoWrite",     // Track analysis tasks
];

// Remove agent-specific flags before passing to claude
removeAgentFlags([
  "verbose",
  "output",
  "focus",
  "help",
  "h",
]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "default",
  "append-system-prompt": systemPrompt,
};

try {
  const exitCode = await claude(userPrompt, defaultFlags);

  if (exitCode === 0) {
    console.log("\n✨ Agent explanation complete!\n");
    if (options.outputFile) {
      console.log(`📄 Explanation saved to: ${options.outputFile}`);
    }
  }

  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
