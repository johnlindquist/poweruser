import type { PostToolUseHookInput, HookJSONOutput } from "@anthropic-ai/claude-agent-sdk"

const input = await Bun.stdin.json() as PostToolUseHookInput

if (input.tool_name === 'Write' || input.tool_name === 'Update' || input.tool_name === 'Edit') {
    if ((input.tool_input as any).file_path?.includes('.ts')) {
        try {
            await Bun.$`bun tsc --noEmit`.text()
        } catch (err: any) {
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