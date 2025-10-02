/**
 * Utility functions for handling Claude CLI flags
 */
import { parseArgs } from "node:util"
import type { ClaudeFlags } from "./claude-flags.types"

// Parse command line arguments once
const args = parseArgs({
    strict: false,
    allowPositionals: true
})

/**
 * Convert flags object to command line arguments
 */
export function toFlags(flagsObj: ClaudeFlags): string[] {
    return Object.entries(flagsObj).flatMap(([key, value]) => {
        if (value === true) return [`--${key}`]
        if (value === false) return [`--no-${key}`]
        if (value !== undefined) return [`--${key}`, String(value)]
        return []
    })
}

/**
 * Merge default flags with user flags and convert to CLI format
 * User flags override defaults. Uses parsed command line args automatically.
 */
export function buildClaudeFlags(
    defaults: ClaudeFlags,
    userFlags: ClaudeFlags = args.values as ClaudeFlags
): string[] {
    const merged = { ...defaults, ...userFlags }
    return toFlags(merged)
}

/**
 * Get parsed positional arguments
 */
export function getPositionals(): string[] {
    return args.positionals
}

// Expose parsed args for advanced cases where direct access is helpful
export const parsedArgs = args