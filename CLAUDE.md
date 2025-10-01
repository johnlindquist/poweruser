# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a collection of autonomous AI agents built with the `@anthropic-ai/claude-agent-sdk`. Each agent is a standalone TypeScript/Bun script that performs a specific development task using Claude's capabilities.

## Development Commands

### Essential Commands
- **Install dependencies**: `bun install`
- **Type checking**: `bun run typecheck` - Run this after creating/modifying agents
- **Run an agent**: `bun run agents/<agent-name>.ts [args]`

### Agent Development Workflow
1. Create new agent in `./agents/<name>.ts`
2. Make it executable: `chmod +x agents/<name>.ts`
3. Run type checking: `bun run typecheck`
4. Test the agent: `bun run agents/<name>.ts`

## Architecture

### Agent Structure
All agents follow a consistent pattern:

```typescript
#!/usr/bin/env bun

import { query } from '@anthropic-ai/claude-agent-sdk';

// 1. Argument parsing (custom parseArgs function)
// 2. Construct agent prompt with instructions
// 3. Execute query() with systemPrompt and options
// 4. Stream and display results
```

### Key Patterns
- **Executable scripts**: All agents have shebang `#!/usr/bin/env bun` and execute permission
- **Self-documenting**: Agents include usage documentation in header comments
- **Argument parsing**: Custom `parseArgs()` function handles flags and positionals
- **System prompts**: Each agent has a specialized system prompt defining its role
- **Streaming results**: Agents iterate through query results and display assistant messages

### Agent Categories
- **Chrome DevTools**: Browser automation using Chrome MCP integration
- **Code quality**: Linting, refactoring, dead code detection
- **Developer productivity**: Commit messages, PRs, documentation
- **Career development**: Learning paths, portfolio generation, interview prep

### Special Files
- `ideas.md`: Contains backlog of unimplemented agent ideas
- `agent-creator-prompt.md`: Template/instructions for creating new agents
- `agent-sdk-reference-prompt.md`: Complete SDK API reference documentation

## Configuration

### Claude Settings (`.claude/settings.local.json`)
Permissions and hooks are configured for this project:
- Auto-approved commands: `Bash(bun run:*)`, `Bash(chmod:*)`, `Bash(awk:*)`
- SessionEnd hook: Runs `.claude/hooks/SessionEnd.ts` on session completion

### TypeScript Configuration
- Target: ESNext with bundler module resolution
- Strict mode enabled
- Allows importing `.ts` extensions (Bun-specific)
- No emit (runtime only via Bun)

## SDK Integration

This project uses `@anthropic-ai/claude-agent-sdk` version `^0.1.1`. The SDK provides:
- `query()`: Main function for executing agent prompts
- Tool access: Bash, Read, Write, Grep, Glob, Task, WebSearch, WebFetch, etc.
- Streaming results: AsyncGenerator interface for real-time output
- System prompts: Configure agent behavior and capabilities

### Common SDK Patterns
- Always set `systemPrompt` to define agent role and capabilities
- Use `allowedTools` to limit agent permissions when needed
- Stream results with `for await (const message of result)`
- Check `message.type === 'assistant'` for agent responses

## Working with This Codebase

### Creating New Agents
1. Check `ideas.md` for inspiration or add your own idea
2. Reference existing agents in `./agents/` for patterns
3. Use `agent-creator-prompt.md` as a template
4. Follow the standard agent structure (see Architecture section)
5. Always run `bun run typecheck` after implementation

### Agent Naming Convention
Files use kebab-case: `accessibility-audit-helper.ts`, `chrome-performance-analyzer.ts`

### Important Notes
- **Never run agents automatically** - they are meant to be invoked explicitly
- The `index.ts` file is minimal (just logs "Hello via Bun!")
- This is a Bun project - use Bun-specific features freely
- Most agents complete their work in under 90 seconds
