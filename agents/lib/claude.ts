/**
 * Wrapper for spawning Claude CLI commands
 * 
 */

import { homedir } from "node:os";
import { join, normalize } from "node:path";
import { $ } from "bun";
import { buildClaudeFlags } from "./flags"
import type { ClaudeFlags } from "./claude-flags.types"

/**
 * Get the Claude projects path for the current working directory
 * @returns The path to the Claude project directory for the current pwd
 */
export async function getClaudeProjectsPath(): Promise<string> {
  const pwd = process.platform === 'win32'
    ? await $`cd`.quiet().text()
    : await $`pwd`.quiet().text();

  // Normalize the path first, then replace separators and dots
  const normalizedPwd = normalize(pwd.trim());
  const dasherizedPwd = normalizedPwd.replace(/[/\\.]/g, "-");

  const projectPath = join(
    homedir(),
    ".claude",
    "projects",
    dasherizedPwd,
  );

  return projectPath;
}

/**
 * Spawn Claude with given default flags and wait for completion
 * Automatically includes positionals from command line and merges with user flags
 * @param defaultFlags - Default flags object (see ClaudeFlags for available options)
 * @returns Exit code from the Claude process
 */
export async function claude(prompt: string = "", defaultFlags: ClaudeFlags = {}) {
  // Build flags, merging defaults with user-provided flags
  const flags = buildClaudeFlags(defaultFlags)

  const proc = Bun.spawn(['claude', ...flags, prompt], {
    stdio: ['inherit', 'inherit', 'inherit']
  })

  return await proc.exited
}