/**
 * Type definitions for Claude CLI flags
 * Based on claude --help output
 */

/**
 * Available output formats for --print mode
 */
export type OutputFormat = "text" | "json" | "stream-json"

/**
 * Available input formats for --print mode
 */
export type InputFormat = "text" | "stream-json"

/**
 * Permission modes for the session
 */
export type PermissionMode = "acceptEdits" | "bypassPermissions" | "default" | "plan"

/**
 * Claude CLI flags configuration
 */
export interface ClaudeFlags {
    /**
     * Enable debug mode
     */
    debug?: boolean

    /**
     * Override verbose mode setting from config
     */
    verbose?: boolean

    /**
     * Print response and exit (useful for pipes)
     */
    print?: boolean

    /**
     * Output format (only works with --print)
     * @default "text"
     */
    'output-format'?: OutputFormat

    /**
     * Input format (only works with --print)
     * @default "text"
     */
    'input-format'?: InputFormat

    /**
     * @deprecated Use --debug instead
     * Enable MCP debug mode (shows MCP server errors)
     */
    'mcp-debug'?: boolean

    /**
     * Bypass all permission checks. Recommended only for sandboxes with no internet access.
     */
    'dangerously-skip-permissions'?: boolean

    /**
     * Comma or space-separated list of tool names to allow
     * @example "Bash(git:*) Edit" or "Task,Bash,Glob,Grep"
     */
    allowedTools?: string

    /**
     * Comma or space-separated list of tool names to deny
     * @example "Bash(git:*) Edit"
     */
    disallowedTools?: string

    /**
     * Load MCP servers from a JSON file or string
     */
    'mcp-config'?: string

    /**
     * Append a system prompt to the default system prompt
     */
    'append-system-prompt'?: string

    /**
     * Permission mode to use for the session
     */
    'permission-mode'?: PermissionMode

    /**
     * Continue the most recent conversation
     */
    continue?: boolean

    /**
     * Resume a conversation - provide a session ID or interactively select
     */
    resume?: string | boolean

    /**
     * Model for the current session. Provide an alias (e.g. 'sonnet' or 'opus')
     * or a model's full name (e.g. 'claude-sonnet-4-20250514')
     */
    model?: string

    /**
     * Enable automatic fallback to specified model when default model is overloaded
     * (only works with --print)
     */
    'fallback-model'?: string

    /**
     * Path to a settings JSON file to load additional settings from
     */
    settings?: string

    /**
     * Additional directories to allow tool access to
     */
    'add-dir'?: string | string[]

    /**
     * Automatically connect to IDE on startup if exactly one valid IDE is available
     */
    ide?: boolean

    /**
     * Only use MCP servers from --mcp-config, ignoring all other MCP configurations
     */
    'strict-mcp-config'?: boolean

    /**
     * Use a specific session ID for the conversation (must be a valid UUID)
     */
    'session-id'?: string

    /**
     * Prompt to use for the conversation
     */
    'prompt'?: string
}