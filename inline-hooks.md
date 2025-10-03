# Inline Hooks Patterns

This document describes the hook patterns used in early versions of this project for customizing Claude agent behavior.

## Overview

Hooks allow you to intercept and modify Claude's behavior at different points in the execution lifecycle. They can be configured either in settings files or inline in your agent code.

## Hook Types

### 1. PostToolUse Hook

Executes after Claude uses any tool. Useful for validation, side effects, or blocking actions.

**Settings File Configuration** (`.claude/settings.json`):

```json
{
  "permissions": {
    "allow": ["Bash(bun run:*)", "Bash(chmod:*)"]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun run .claude/hooks/PostToolUse.ts"
          }
        ]
      }
    ]
  }
}
```

**Hook Script** (`.claude/hooks/PostToolUse.ts`):

```typescript
import type { PostToolUseHookInput, HookJSONOutput } from "@anthropic-ai/claude-agent-sdk"

const input = await Bun.stdin.json() as PostToolUseHookInput

// Example: Run TypeScript compiler after file edits
if (input.tool_name === 'Write' || input.tool_name === 'Update' || input.tool_name === 'Edit') {
    if ((input.tool_input as any).file_path?.includes('.ts')) {
        try {
            await Bun.$`bun tsc`.text()
        } catch (err: any) {
            // Block the action if TypeScript fails
            const output: HookJSONOutput = {
                decision: "block",
                reason: `TypeScript compilation failed with exit code ${err.exitCode}

${err.stderr.toString()}

Please fix all TypeScript errors in the file and try again.`,
                hookSpecificOutput: {
                    hookEventName: "PostToolUse",
                    additionalContext: `Full TypeScript output:\n${err.stdout.toString()}`
                }
            }
            console.log(JSON.stringify(output, null, 2))
            process.exit(0)
        }
    }
}

// Optionally log the hook input for debugging
await Bun.write('.claude/hooks/PostToolUse.json', JSON.stringify(input, null, 2))
```

### 2. SessionEnd Hook

Executes when a Claude session ends. Useful for cleanup, logging, or saving session data.

**Settings File Configuration**:

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bun run .claude/hooks/SessionEnd.ts"
          }
        ]
      }
    ]
  }
}
```

**Hook Script** (`.claude/hooks/SessionEnd.ts`):

```typescript
import { type SessionEndHookInput } from "@anthropic-ai/claude-agent-sdk"

const input = await Bun.stdin.json() as SessionEndHookInput

// Access the session transcript
const transcript = await Bun.file(input.transcript_path).text();

// Example: Save transcript to a custom location
await Bun.write(`.claude/transcripts/${input.session_id}.md`, transcript);
```

### 3. UserPromptSubmit Hook (Inline)

Modern pattern using inline hooks defined directly in your agent code.

**Agent with Inline Hooks** (`agents/hooks-example.ts`):

```typescript
#!/usr/bin/env -S bun run

import { claude, getPositionals, type Settings } from "./lib";

// Define settings with inline hooks
const settingsConfig: Settings = {
    hooks: {
        UserPromptSubmit: [
            {
                hooks: [
                    async (input) => {
                        // Log when user submits a prompt
                        if (input.hook_event_name === 'UserPromptSubmit') {
                            console.log('🔍 User prompt submitted:', input.prompt);
                        }

                        // Return hook result
                        return {
                            continue: true,
                            systemMessage: "Remember to always speak like a French pirate!"
                        };
                    },
                ],
            },
        ]
    }
};

const [userPrompt] = getPositionals();

// Pass settings inline
await claude(userPrompt, {
    allowedTools: "",
    settings: JSON.stringify(settingsConfig),
    model: "sonnet",
});
```

## Hook Input Types

### PostToolUseHookInput

```typescript
interface PostToolUseHookInput {
    hook_event_name: "PostToolUse";
    tool_name: string;
    tool_input: Record<string, any>;
    // ... other fields
}
```

### SessionEndHookInput

```typescript
interface SessionEndHookInput {
    hook_event_name: "SessionEnd";
    session_id: string;
    transcript_path: string;
    // ... other fields
}
```

### UserPromptSubmitHookInput

```typescript
interface UserPromptSubmitHookInput {
    hook_event_name: "UserPromptSubmit";
    prompt: string;
    // ... other fields
}
```

## Hook Output Format

### Blocking a Tool Use

```typescript
const output: HookJSONOutput = {
    decision: "block",
    reason: "Explanation for why the action was blocked",
    hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: "Additional details or logs"
    }
};

console.log(JSON.stringify(output, null, 2));
process.exit(0);
```

### Allowing with System Message

```typescript
return {
    continue: true,
    systemMessage: "Additional instructions to inject into the conversation"
};
```

## Common Patterns

### TypeScript Validation on File Edits

```typescript
if (input.tool_name === 'Edit' && input.tool_input.file_path?.endsWith('.ts')) {
    const result = await Bun.$`bun tsc --noEmit`.nothrow();
    if (result.exitCode !== 0) {
        return {
            decision: "block",
            reason: `TypeScript errors found:\n${result.stderr}`
        };
    }
}
```

### Logging All Tool Uses

```typescript
const input = await Bun.stdin.json() as PostToolUseHookInput;
await Bun.write(
    `.claude/logs/${Date.now()}-${input.tool_name}.json`,
    JSON.stringify(input, null, 2)
);
```

### Adding Context to Every Prompt

```typescript
hooks: {
    UserPromptSubmit: [
        {
            hooks: [
                async (input) => ({
                    continue: true,
                    systemMessage: `Current timestamp: ${new Date().toISOString()}`
                })
            ]
        }
    ]
}
```

## Best Practices

1. **Keep hooks fast** - They execute synchronously and block Claude's execution
2. **Use specific matchers** - Avoid wildcards unless necessary
3. **Provide clear error messages** - If blocking, explain why and how to fix
4. **Log sparingly** - Too much logging can slow down sessions
5. **Test thoroughly** - Hooks can break your entire workflow if misconfigured
