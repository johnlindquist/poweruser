# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains a collection of **Claude AI agents** and utilities built using the `@anthropic-ai/claude-agent-sdk`. The project demonstrates various patterns for building specialized agents that leverage the Claude CLI for tasks ranging from code analysis to browser automation.

## Key Directories

- **`agents/`** - 100+ specialized Claude agents (interactive CLI scripts)
- **`sdk/`** - Refactored versions of agents using the SDK query() API
- **`headless/`** - Headless Claude integrations (webhooks, bridges, chat interfaces)
- **`mcp/`** - Model Context Protocol (MCP) server implementations
- **`proxy/`** - mitmproxy integration for inspecting Claude Code HTTPS traffic
- **`agents/lib/`** - Shared utilities and functions for agent development

## Development Commands

### Type Checking
```bash
bun run typecheck
```

### Running Agents

All agents are executable TypeScript files using the Bun shebang:
```bash
# Interactive agents (most common)
bun run agents/<agent-name>.ts [options]

# SDK-based agents
bun run sdk/<agent-name>.ts [options]

# Headless examples
bun run headless/<script-name>.ts [options]
```

Examples:
```bash
bun run agents/test-generator.ts "Generate tests for src/utils.ts"
bun run sdk/migration-assistant.ts "Migrate from React 17 to React 18"
bun run headless/claude-chat.ts "List all TypeScript files"
```

### Running with Proxy (for debugging)
```bash
cd proxy
bun start
# In another terminal
bun run agents/<agent-name>.ts [args]
```

## Architecture Patterns

### Agent Structure (agents/)

Standard agent pattern used throughout `agents/`:

1. **Shebang**: `#!/usr/bin/env -S bun run`
2. **Usage documentation**: Multi-line comment at top with examples
3. **Imports**: From `./lib` for shared utilities
4. **Option parsing**: Use `parsedArgs` from `./lib/flags`
5. **Help text**: `printHelp()` function with usage examples
6. **Main execution**: Call `claude()` with prompt and flags

Key utilities from `agents/lib/`:
- `claude(prompt, flags)` - Spawn Claude CLI with configuration
- `parsedArgs` - Pre-parsed command-line arguments
- `removeAgentFlags()` - Clean flags before passing to Claude
- `buildClaudeFlags()` - Convert flag object to CLI args
- `getClaudeProjectsPath()` - Get Claude project directory path

### SDK Pattern (sdk/)

Agents in `sdk/` use the `@anthropic-ai/claude-agent-sdk` query() API:
- Import from `../agents/lib` for CLI utilities
- Use `claude()` function to spawn Claude with proper configuration
- Follow same CLI conventions as interactive agents

### Headless Pattern (headless/)

Headless scripts spawn Claude with `--input-format=stream-json` and `--output-format=stream-json`:
- Parse streaming JSONL responses
- Handle multi-turn conversations
- Examples: GitHub PR reviewer, Slack bridge, log analysis

Message format for stdin:
```json
{"type":"user","message":{"role":"user","content":[{"type":"text","text":"..."}]}}
```

### MCP Servers (mcp/)

MCP servers wrap CLI tools (curl, jq, ripgrep, ffprobe, tldr) as MCP tools:
- Use `@modelcontextprotocol/sdk`
- Spawn child processes safely with timeouts
- Provide structured input/output schemas using Zod

## Inline Hooks System

Agents can define hooks inline for customization:

```typescript
import { claude, type Settings } from "./lib";

const settingsConfig: Settings = {
  hooks: {
    UserPromptSubmit: [{
      hooks: [async (input) => ({
        continue: true,
        systemMessage: "Additional context here"
      })]
    }],
    PostToolUse: [{
      matcher: "*",
      hooks: [async (input) => {
        // Validate, block, or modify behavior
        return { decision: "continue" };
      }]
    }]
  }
};

await claude(userPrompt, {
  settings: JSON.stringify(settingsConfig)
});
```

Hook types:
- `UserPromptSubmit` - Intercept before processing user input
- `PostToolUse` - Validate after Claude uses tools
- `SessionEnd` - Cleanup when session ends

## Agent Conventions

When creating or modifying agents:

1. **Naming**: Use kebab-case for filenames (e.g., `test-generator.ts`)
2. **Shebang**: Always include `#!/usr/bin/env -S bun run`
3. **Documentation**: Include multi-line comment with:
   - Agent name
   - Description
   - Usage examples
   - Options
4. **CLI Interface**:
   - Accept positional arguments via `parsedArgs.positionals`
   - Support `--help` or `-h` flag
   - Use `printHelp()` function for usage text
5. **Type Safety**:
   - Define options interfaces
   - Use explicit types, avoid `any`
   - Import types from `./lib/claude-flags.types`
6. **Error Handling**:
   - Validate required arguments
   - Print clear error messages
   - Exit with non-zero code on error
7. **Permissions**: Consider what Claude permissions the agent needs (file access, bash commands, etc.)

## Meta-Agents

Special agents for creating and managing other agents:

- **`agent-architect.ts`** - Scaffolds new agents from a brief
- **`agent-explainer.ts`** - Documents existing agents comprehensively
- **`output-style-builder.ts`** - Creates custom Claude output styles

Usage:
```bash
bun run agents/agent-architect.ts "Create an agent that..."
bun run agents/agent-explainer.ts --agent agents/test-generator.ts
```

## Common Patterns

### Reading flags:
```typescript
import { parsedArgs } from "./lib";

const { values, positionals } = parsedArgs;
const help = values.help === true || values.h === true;
const dryRun = values["dry-run"] === true;
const model = (values.model as string) || "sonnet";
```

### Launching Claude:
```typescript
import { claude } from "./lib";

await claude(prompt, {
  model: "sonnet",
  allowedTools: "Read,Grep,Bash",
  systemPrompt: "You are a specialized agent...",
  settings: JSON.stringify(settingsConfig)
});
```

### Building system prompts:
```typescript
function buildSystemPrompt(options: Options): string {
  return `You are a specialized agent for ${options.task}.

Your workflow:
1. Analyze the codebase
2. Use TodoWrite to track progress
3. Execute the task step by step
4. Validate results

Important constraints:
- Always validate changes
- Use explicit error messages
- Follow repository conventions`;
}
```

## Dependencies

Core dependencies:
- `@anthropic-ai/claude-agent-sdk` - Claude agent SDK
- `@modelcontextprotocol/sdk` - MCP server SDK
- `zod` - Schema validation
- Bun runtime (implicit)

All agents assume Bun runtime and TypeScript module resolution (bundler mode).

## TypeScript Configuration

The project uses strict TypeScript settings:
- `strict: true`
- `noUncheckedIndexedAccess: true`
- `noUnusedLocals: true`
- `moduleResolution: "bundler"`
- Target: `ESNext`

## Testing Agents

Most agents are designed to be self-testing:
1. Run with `--dry-run` (if supported) to preview changes
2. Use verbose flags (`-v`, `--verbose`) for debugging
3. Check output in Claude's project directory: `~/.claude/projects/`
