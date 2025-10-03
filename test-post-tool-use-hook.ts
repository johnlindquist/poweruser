#!/usr/bin/env -S bun run

import { claude, getPositionals } from "./agents/lib";

const [userPrompt] = getPositionals()

await claude(userPrompt, {
    settings: JSON.stringify({
        hooks: {
            PostToolUse: [
                {
                    matcher: "*",
                    hooks: [
                        {
                            type: "command",
                            command: "echo '[PostToolUse Hook Triggered]' >&2"
                        }
                    ]
                }
            ]
        }
    }),
    model: "sonnet",
});
