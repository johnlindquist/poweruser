import { resolve } from "node:path";
import type { ClaudeFlags } from "./claude-flags.types";
import type { Settings, HooksConfig, HookCommand } from "./settings";

const hookTypes = ["UserPromptSubmit", "PostToolUse", "PreToolUse", "SessionStart", "SessionEnd", "Stop", "SubagentStop", "Notification", "PreCompact"] as const;

export async function applyConventionalHooks(defaultFlags: ClaudeFlags): Promise<ClaudeFlags> {
    const agentPath = process.argv[1];
    if (!agentPath) {
        console.error("[conventional-hooks] No agent path found in process.argv[1]");
        return defaultFlags;
    }

    // Resolve to absolute path to ensure consistent path handling
    const absoluteAgentPath = resolve(agentPath);
    console.error(`[conventional-hooks] Looking for hooks for: ${absoluteAgentPath}`);

    let settings: Settings = {};
    if (defaultFlags.settings) {
        try {
            settings = JSON.parse(defaultFlags.settings);
        } catch (error) {
            console.error("[conventional-hooks] Error parsing existing settings JSON:", error);
            return defaultFlags;
        }
    }

    let foundHooks = 0;
    for (const hookType of hookTypes) {
        const hookFilePath = absoluteAgentPath.replace(/\.ts$/, `.${hookType}.ts`);
        const file = Bun.file(hookFilePath);
        const exists = await file.exists();

        if (exists) {
            console.error(`[conventional-hooks] Found hook: ${hookFilePath}`);
            foundHooks++;

            if (!settings.hooks) {
                settings.hooks = {} as HooksConfig;
            }
            const hooksConfig = settings.hooks as HooksConfig;
            if (!hooksConfig[hookType]) {
                hooksConfig[hookType] = [];
            }
            const hookCommand: HookCommand = {
                type: "command",
                command: `bun run ${hookFilePath}`
            };
            hooksConfig[hookType]?.push({
                matcher: "*",
                hooks: [hookCommand]
            });
        }
    }

    if (foundHooks > 0) {
        console.error(`[conventional-hooks] Applied ${foundHooks} conventional hook(s)`);
        return {
            ...defaultFlags,
            settings: JSON.stringify(settings, null, 2)
        };
    }

    console.error("[conventional-hooks] No conventional hooks found");
    return defaultFlags;
}
