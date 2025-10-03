# Headless Claude CLI

A basic Bun/TypeScript CLI that demonstrates how to spawn and communicate with Claude Code using `--input-format stream-json`.

## Overview

This CLI tool spawns a `claude` process in headless mode and sends messages using the streaming JSON input format. It demonstrates:

- Spawning `claude` with `--input-format=stream-json` and `--output-format=stream-json`
- Formatting user messages in the required JSON schema
- Parsing streaming JSON responses
- Handling multi-turn conversations

## Usage

### Single Message

Pass a message as a command-line argument:

```bash
bun run headless/claude-chat.ts "Explain the code in agents/test-generator.ts"
```

### Verbose Mode

Enable verbose output to see metadata and debug information:

```bash
bun run headless/claude-chat.ts -v "List all TypeScript files in the agents directory"
```

### Stdin Input

Send JSON-formatted messages via stdin:

```bash
echo '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Hello Claude"}]}}' | bun run headless/claude-chat.ts
```

### Multi-turn Conversation

Create a multi-turn conversation by sending multiple messages:

```bash
# Create a file with multiple messages (JSONL format - one JSON object per line)
cat << 'EOF' > messages.jsonl
{"type":"user","message":{"role":"user","content":[{"type":"text","text":"What files are in the agents directory?"}]}}
{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Now explain what the test-generator.ts agent does"}]}}
EOF

# Send to Claude
cat messages.jsonl | bun run headless/claude-chat.ts
```

## Message Format

User messages must follow this JSON schema:

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "text",
        "text": "Your message here"
      }
    ]
  }
}
```

## Response Format

Claude responds with streaming JSON messages:

- `type: "assistant"` - Assistant responses with content
- `type: "result"` - Final message with session metadata (cost, duration, session_id)
- Other types for system messages and events

## Implementation Details

The CLI:

1. Spawns `claude` with `-p --output-format=stream-json --input-format=stream-json`
2. Writes user messages to `claude.stdin` in JSONL format
3. Parses streaming JSON from `claude.stdout`
4. Extracts and displays assistant text content
5. Shows session metadata in verbose mode

## Examples

### Ask a simple question

```bash
bun run headless/claude-chat.ts "What is the purpose of this codebase?"
```

### Analyze a specific file

```bash
bun run headless/claude-chat.ts "Review the code in agents/chrome-perf-agent.ts"
```

### Get verbose session info

```bash
bun run headless/claude-chat.ts -v "Count the number of agent files"
```

## See Also

- [Claude Code Headless Mode Documentation](https://docs.claude.com/en/docs/claude-code/headless-mode)
- [CLI Reference](https://docs.claude.com/en/docs/claude-code/cli-reference)
