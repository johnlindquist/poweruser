import { type SessionEndHookInput } from "@anthropic-ai/claude-agent-sdk"

const input = await Bun.stdin.json() as SessionEndHookInput

const transcript = await Bun.file(input.transcript_path).text();

// await Bun.write(`.claude/transcripts/${input.session_id}.md`, transcript);