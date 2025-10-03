# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a collection of Claude Code agent examples, SDK utilities, headless integrations, and MCP servers. The repository demonstrates advanced patterns for building autonomous agents using the Claude Agent SDK and Claude Code CLI.

## Project Structure

### `/agents` (121 files)
Executable agent scripts that wrap Claude Code with custom prompts, tools, and behaviors. Each agent is a standalone CLI tool that spawns Claude with specific configurations.

**Key Pattern**: Agents use `agents/lib/` utilities to:
- Parse CLI arguments
- Build Claude flags programmatically
- Apply conventional hooks
- Spawn Claude CLI with custom system prompts

**Example**: `agents/test-generator.ts` - Generates comprehensive test suites with configurable frameworks and coverage thresholds.

### `/agents/lib`
Shared utilities for building agents:
- `claude.ts` - Core function to spawn Claude CLI with flags
- `flags.ts` - Flag parsing and building utilities
- `hooks.ts` - Hook management and setup
- `settings.ts` - TypeScript types aligned with settings schema
- `cli.ts` - CLI argument parsing helpers

### `/sdk` (22 files)
Agent examples using the `@anthropic-ai/claude-agent-sdk` directly via the `query()` function. These demonstrate headless agent patterns without wrapping the CLI.

**Key Pattern**: SDK agents use:
- `query()` from `@anthropic-ai/claude-agent-sdk`
- Inline agent definitions with `options.agents`
- Hook callbacks for progress tracking
- Permission modes and tool restrictions

**Example**: `sdk/multi-agent-orchestrator.ts` - Decomposes complex tasks into parallel subtasks executed by specialized subagents.

### `/headless` (13 files)
Headless integrations that bridge Claude Code with external systems using `--input-format stream-json` and `--output-format stream-json`.

**Key Pattern**: Headless bridges:
- Spawn Claude with JSONL streaming I/O
- Parse streaming events from stdout
- Send user messages via stdin
- Examples: Slack bot, SMS bridge, webhook server

**Example**: `headless/claude-chat.ts` - Interactive CLI and stdin passthrough mode for JSONL messages.

### `/mcp`
Model Context Protocol (MCP) server implementations that expose tools to Claude:
- `mcp-ripgrep.ts` - Fast file search via ripgrep
- `mcp-jq.ts` - JSON query tool
- `mcp-curl.ts` - HTTP request tool
- `mcp-ffprobe.ts` - Media file inspection

### `/proxy`
Standalone proxy manager for inspecting Claude Code's HTTPS traffic using mitmproxy. See `proxy/README.md` for detailed usage.

### `/prompts` and `/plans`
Documentation and planning materials (not code).

## Development Commands

### Running Agents (CLI Wrappers)
```bash
# General pattern for agents/
bun run agents/<agent-name>.ts [args] [options]

# Example: Generate tests
bun run agents/test-generator.ts src/utils --framework jest

# Most agents support --help
bun run agents/test-generator.ts --help
```

### Running SDK Examples
```bash
# General pattern for sdk/
bun run sdk/<agent-name>.ts [args]

# Example: Multi-agent orchestration
bun run sdk/multi-agent-orchestrator.ts "Create authentication system" --verbose
```

### Running Headless Bridges
```bash
# Interactive mode
bun run headless/claude-chat.ts "Hello, what files are here?"

# JSONL stdin mode
echo '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Hello"}]}}' | bun run headless/claude-chat.ts
```

### Type Checking
```bash
bun run typecheck
```

### Running MCP Servers
MCP servers are typically referenced in Claude Code's MCP configuration, not run directly. They use stdio transport.

## Architecture Patterns

### Agent Pattern (CLI Wrapper)
Agents in `/agents` follow this structure:
1. Parse CLI arguments using `parseArgs` from `agents/lib/cli.ts`
2. Build a prompt string with task-specific instructions
3. Define a system prompt that configures subagents (optional)
4. Configure `ClaudeFlags` including:
   - `model` - Model selection
   - `settings` - JSON-stringified settings
   - `allowedTools` - Space-separated tool list
   - `permission-mode` - Permission strategy
   - `append-system-prompt` - Additional system prompt
5. Call `claude(prompt, flags)` to spawn Claude CLI
6. Handle exit code

### SDK Pattern (Direct Query)
Agents in `/sdk` use the SDK directly:
1. Import `query` from `@anthropic-ai/claude-agent-sdk`
2. Call `query({ prompt, options })` with:
   - `cwd` - Working directory
   - `agents` - Subagent definitions
   - `allowedTools` - Tool restrictions
   - `permissionMode` - Permission strategy
   - `hooks` - Lifecycle callbacks
   - `maxTurns` - Turn limit
3. Iterate over async result stream
4. Handle `assistant`, `result`, and other message types

### Headless Pattern (JSONL Streaming)
Headless bridges spawn Claude with streaming I/O:
1. Spawn Claude with `--input-format stream-json --output-format stream-json`
2. Parse JSONL from `stdout` line-by-line
3. Handle message types: `assistant`, `result`, `tool_call`, etc.
4. Send user messages as JSONL to `stdin`
5. Bridge to external systems (Slack, SMS, webhooks)

### Subagent Definition
Many agents define specialized subagents in system prompts:
```
**subagent-name**: Description of subagent purpose
- Tools: Read, Write, Glob
- Specializes in specific task type
```

Then use the `Task` tool to delegate work to subagents.

## Key Technical Details

### Flag Building
`buildClaudeFlags()` from `agents/lib/flags.ts` merges:
1. Default flags provided by agent
2. User-provided flags from command line
3. Converts to CLI flag format

User flags override defaults. Positionals are automatically included.

### Hook Application
`applyConventionalHooks()` from `agents/lib/conventional-hooks.ts` applies standard hooks before spawning Claude. This allows agents to inject behaviors like progress tracking or file validation.

### Settings Schema
`Settings` type in `agents/lib/settings.ts` is aligned with Claude Code's settings schema. It includes:
- `hooks` - Hook configurations for lifecycle events
- `permissions` - Permission rules
- `env` - Environment variables
- `statusLine` - Custom status line command
- `outputStyle` - Output formatting style

### Permission Modes
Common permission modes used in agents:
- `acceptEdits` - Auto-accept file edits
- `default` - Use default permission behavior
- `auto` - Auto-accept all actions

### Tool Restrictions
Agents restrict tools to prevent unwanted behaviors:
```typescript
allowedTools: [
  "Read", "Write", "Edit", "Glob", "Grep",
  "Bash", "Task", "TodoWrite"
]
```

## Working with This Codebase

### Creating New Agents (CLI Wrapper)
1. Copy an existing agent from `/agents` as a template
2. Modify the prompt and system prompt for your use case
3. Configure allowed tools and permission mode
4. Add CLI argument parsing if needed
5. Make executable: `chmod +x agents/your-agent.ts`

### Creating SDK Agents
1. Copy an existing SDK agent from `/sdk`
2. Import `query` from `@anthropic-ai/claude-agent-sdk`
3. Define subagents inline in the `agents` option
4. Add hooks for progress tracking
5. Stream results and handle message types

### Testing Agents Locally
```bash
# Run agent in current directory
bun run agents/<agent>.ts [args]

# Run with Claude's -p flag (project mode) - agent handles this automatically
bun run agents/<agent>.ts [args]
```

### Debugging with Proxy
Use the proxy manager to inspect Claude's API calls:
```bash
cd proxy
bun start
```

This starts mitmproxy and Claude Code with proxy configuration. See `proxy/README.md`.

## Dependencies

- **Bun**: Runtime and package manager
- **@anthropic-ai/claude-agent-sdk**: SDK for building agents
- **@modelcontextprotocol/sdk**: MCP server framework
- **zod**: Schema validation for MCP tools

## Notes

- All agents use `bun` as the runtime (see shebang: `#!/usr/bin/env bun` or `#!/usr/bin/env -S bun run`)
- The repository uses TypeScript with strict mode enabled
- Most agents support `--help` for usage information
- Agents automatically inherit positionals from command line
- The `/agents/lib` utilities provide reusable patterns for common agent tasks
