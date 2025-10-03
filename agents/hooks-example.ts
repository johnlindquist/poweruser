#!/usr/bin/env -S bun run
/**
 * OUTPUT STYLE EXAMPLE: Launch Claude with custom output style
 *
 * Demonstrates how to:
 * - Inline settings and MCP configuration
 * - Pass custom output styles via --settings flag
 * - Merge user flags with default flags
 *
 * Usage:
 *   bun run agents/output-style-example.ts "<your prompt>"
 */

import { claude, getPositionals, type Settings } from "./lib";

// Inline settings configuration
const settingsConfig: Settings = {
    hooks: {
        UserPromptSubmit: [
            {
                hooks: [
                    async (input) => {
                        if (input.hook_event_name === 'UserPromptSubmit') {
                            console.log('🔍 User prompt submitted:', input.prompt);
                        }
                        return { continue: true, systemMessage: "Remember to always speak like a French pirate!" };
                    },
                ],
            },
        ]
    }
};


const [userPrompt] = getPositionals()


await claude(userPrompt, {
    allowedTools: "",
    disallowedTools: "Task, Bash, Glob, Grep, ExitPlanMode, Read, Edit, Write, NotebookEdit, WebFetch, TodoWrite, WebSearch, BashOutput, KillShell, SlashCommand, mcp__playwright__browser_close, mcp__playwright__browser_resize, mcp__playwright__browser_console_messages, mcp__playwright__browser_handle_dialog, mcp__playwright__browser_evaluate, mcp__playwright__browser_file_upload, mcp__playwright__browser_fill_form, mcp__playwright__browser_install, mcp__playwright__browser_press_key, mcp__playwright__browser_type, mcp__playwright__browser_navigate, mcp__playwright__browser_navigate_back, mcp__playwright__browser_network_requests, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_drag, mcp__playwright__browser_hover, mcp__playwright__browser_select_option, mcp__playwright__browser_tabs, mcp__playwright__browser_wait_for, mcp__chrome-devtools__list_console_messages, mcp__chrome-devtools__emulate_cpu, mcp__chrome-devtools__emulate_network, mcp__chrome-devtools__click, mcp__chrome-devtools__drag, mcp__chrome-devtools__fill, mcp__chrome-devtools__fill_form, mcp__chrome-devtools__hover, mcp__chrome-devtools__upload_file, mcp__chrome-devtools__get_network_request, mcp__chrome-devtools__list_network_requests, mcp__chrome-devtools__close_page, mcp__chrome-devtools__handle_dialog, mcp__chrome-devtools__list_pages, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__navigate_page_history, mcp__chrome-devtools__new_page, mcp__chrome-devtools__resize_page, mcp__chrome-devtools__select_page, mcp__chrome-devtools__performance_analyze_insight, mcp__chrome-devtools__performance_start_trace, mcp__chrome-devtools__performance_stop_trace, mcp__chrome-devtools__take_screenshot, mcp__chrome-devtools__evaluate_script, mcp__chrome-devtools__take_snapshot, mcp__chrome-devtools__wait_for, mcp__ide__getDiagnostics, mcp__ide__executeCode",
    settings: JSON.stringify(settingsConfig),
    "strict-mcp-config": true,
    model: "sonnet",
});

