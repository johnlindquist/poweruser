import type { UserPromptSubmitHookInput, HookJSONOutput } from "@anthropic-ai/claude-agent-sdk"

const input = await Bun.stdin.json() as UserPromptSubmitHookInput

console.error(`[UserPromptSubmit Hook] Received prompt: ${input.prompt}`)

if (input.prompt.includes('stop')) {
    const output: HookJSONOutput = {
        decision: "block",
        reason: "User requested to stop the session"
    }
    console.log(JSON.stringify(output, null, 2))
    process.exit(0)
}