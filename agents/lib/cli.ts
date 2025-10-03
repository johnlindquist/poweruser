/**
 * Shared CLI utility functions for agent scripts
 *
 * This module provides common helpers for parsing command-line arguments
 * across all agents, reducing code duplication and ensuring consistent behavior.
 */

import { parsedArgs } from './flags';

/**
 * Get process.argv for parsing
 * @internal
 */
const argv = process.argv.slice(2);

/**
 * Get parsed values from parsedArgs
 * @internal
 */
const values = parsedArgs.values as Record<string, unknown>;

/**
 * Read a string flag value from command-line arguments.
 * Supports both `--flag value` and `--flag=value` formats.
 *
 * @param name - The flag name (without the -- prefix)
 * @returns The string value if found, undefined otherwise
 *
 * @example
 * ```typescript
 * // For: bun run script.ts --output report.md
 * const output = readStringFlag('output'); // 'report.md'
 * ```
 */
export function readStringFlag(name: string): string | undefined {
  const raw = values[name];
  if (typeof raw === 'string' && raw.length > 0) {
    return raw;
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;

    // Handle --flag value format
    if (arg === `--${name}`) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        return next;
      }
    }

    // Handle --flag=value format
    if (arg.startsWith(`--${name}=`)) {
      const [, value] = arg.split('=', 2);
      if (value && value.length > 0) {
        return value;
      }
    }
  }

  return undefined;
}

/**
 * Read a number flag value from command-line arguments.
 * Validates that the value is a positive finite number.
 *
 * @param name - The flag name (without the -- prefix)
 * @param defaultValue - The default value to use if flag is not provided
 * @returns The parsed number value or the default value
 * @throws Exits process with error if value is invalid
 *
 * @example
 * ```typescript
 * // For: bun run script.ts --timeout 5000
 * const timeout = readNumberFlag('timeout', 3000); // 5000
 * ```
 */
export function readNumberFlag(name: string, defaultValue: number): number {
  const raw = readStringFlag(name);
  if (!raw) {
    return defaultValue;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.error(`❌ Error: --${name} must be a positive integer`);
    process.exit(1);
  }

  return Math.floor(parsed);
}

/**
 * Read a boolean flag from command-line arguments.
 * Checks for presence of the flag in argv.
 *
 * @param name - The flag name (without the -- prefix)
 * @param defaultValue - The default value to use if flag is not provided
 * @returns true if flag is present, otherwise the default value
 *
 * @example
 * ```typescript
 * // For: bun run script.ts --verbose
 * const verbose = readBooleanFlag('verbose', false); // true
 *
 * // For: bun run script.ts --no-warnings
 * const warnings = !readBooleanFlag('no-warnings', false);
 * ```
 */
export function readBooleanFlag(name: string, defaultValue: boolean): boolean {
  if (values[name] === true) return true;
  if (values[name] === false) return false;
  return argv.includes(`--${name}`) ? true : defaultValue;
}

/**
 * Collect all values for a repeated flag.
 * Useful for flags that can be specified multiple times.
 *
 * @param name - The flag name (without the -- prefix)
 * @returns Array of all values found for this flag
 *
 * @example
 * ```typescript
 * // For: bun run script.ts --file a.ts --file b.ts --file=c.ts
 * const files = collectRepeatedFlag('file'); // ['a.ts', 'b.ts', 'c.ts']
 * ```
 */
export function collectRepeatedFlag(name: string): string[] {
  const collected: string[] = [];

  // Handle --name=value form
  for (const rawArg of argv) {
    const arg = rawArg ?? '';
    if (arg.startsWith(`--${name}=`)) {
      const [, value] = arg.split('=', 2);
      if (value) {
        collected.push(value);
      }
    }
  }

  // Handle --name value form
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === `--${name}`) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        collected.push(next);
      }
    }
  }

  // Handle values from parsedArgs
  const rawValue = values[name];
  if (typeof rawValue === 'string') {
    collected.push(rawValue);
  } else if (Array.isArray(rawValue)) {
    for (const item of rawValue) {
      if (typeof item === 'string') {
        collected.push(item);
      }
    }
  }

  return collected;
}

/**
 * Remove agent-specific flags from parsedArgs.values before passing to claude wrapper.
 * This prevents agent flags from interfering with Claude Code's internal flag parsing.
 *
 * @param agentKeys - Array of flag names to remove from parsedArgs.values
 *
 * @example
 * ```typescript
 * // Remove agent-specific flags before calling claude()
 * removeAgentFlags(['output', 'verbose', 'timeout']);
 * const result = await claude(prompt, settings);
 * ```
 */
export function removeAgentFlags(agentKeys: readonly string[]): void {
  for (const key of agentKeys) {
    delete values[key];
  }
}
