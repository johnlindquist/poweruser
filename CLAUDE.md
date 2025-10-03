# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a **Claude Agent SDK repository** containing 100+ specialized agents that leverage Claude's capabilities for various development tasks. The repository includes:

- **agents/**: 120+ TypeScript agents for tasks like code analysis, Chrome automation, CI/CD, career development, and more
- **sdk/**: Simplified agent examples demonstrating SDK patterns
- **headless/**: Headless Claude CLI examples showing stream-json communication
- **mcp/**: MCP (Model Context Protocol) server implementations (curl, jq, ripgrep, ffprobe, tldr)
- **proxy/**: mitmproxy integration for inspecting Claude Code HTTPS traffic

## Architecture

### Agent Pattern

Agents follow a consistent pattern:
- Built with `@anthropic-ai/claude-agent-sdk` using the `query()` API
- Command-line interface with usage banners and option parsing
- TypeScript with Bun runtime (`#!/usr/bin/env -S bun run` or `#!/usr/bin/env bun`)
- Self-documenting with clear usage examples in header comments

### Directory Structure

- **agents/**: Full-featured agents with comprehensive capabilities
- **sdk/**: Lightweight SDK examples for learning and reference
- **headless/**: CLI tools for programmatic Claude interaction via stream-json
- **mcp/**: MCP servers exposing command-line tools as Claude resources

## Development Commands

### Type Checking
```bash
bun run typecheck      # Run TypeScript compiler without emitting files
```

### Running Agents
```bash
# Standard agent pattern
bun run agents/<agent-name>.ts [arguments] [options]

# Examples
bun run agents/test-generator.ts ./src --framework jest
bun run agents/chrome-perf-agent.ts https://example.com
bun run sdk/api-response-type-generator.ts https://api.github.com/users/octocat
```

### Headless Mode
```bash
# Interactive headless Claude
bun run headless/claude-chat.ts "Your question"
bun run headless/claude-chat.ts -v "Verbose output"
```

### Proxy Inspection
```bash
# Inspect Claude Code HTTPS traffic
cd proxy && bun start              # Web UI
cd proxy && bun start:no-web       # Terminal UI
```

## Key Technical Details

### TypeScript Configuration
- **Target/Module**: ESNext with bundler module resolution
- **Strict mode**: Enabled with `noUncheckedIndexedAccess`
- **No emit**: All TypeScript is type-checked only, Bun handles execution
- **JSX**: `react-jsx` transform enabled

### PostToolUse Hook
The repository uses a PostToolUse hook (`.claude/hooks/PostToolUse.ts`) that automatically runs `bun tsc` after Write/Edit/Update operations on `.ts` files. TypeScript compilation errors will **block** the operation, ensuring type safety.

### Agent SDK Usage
Agents use `query()` from `@anthropic-ai/claude-agent-sdk`:
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const result = await query({
  systemPrompt: "You are a specialized agent...",
  prompt: userInput,
  temperature: 0.7,
  maxTokens: 4000
});
```

### Headless Stream-JSON Format
For programmatic Claude interaction:
```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [{"type": "text", "text": "Your message"}]
  }
}
```

## Agent Categories

The `agents/agent-list.md` file provides a comprehensive directory of all agents grouped by function:
- Chrome automation (performance, SEO, accessibility, testing)
- Code analysis (dead code, test coverage, TypeScript hardening)
- Git/CI/CD (commit messages, PR reviews, changelog generation)
- Career development (portfolio generation, interview prep)
- API tooling (type generation, contract validation)
- Development utilities (environment validation, dependency auditing)

## Creating New Agents

Use the meta-agent to scaffold new agents:
```bash
bun run agents/agent-architect.ts "Your agent description"
bun run agents/agent-architect.ts "Brief" --spec-file ./specs/detail.md --output agents/new-agent.ts
```

The Agent Architect will generate agents matching repository conventions automatically.
