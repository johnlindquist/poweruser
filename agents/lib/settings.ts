/**
 * Type definitions aligned with claude-code-settings.schema.json
 */

import type { PermissionMode } from "./claude-flags.types";

export interface HookCommand {
  type: "command";
  command: string;
  timeout?: number;
}

export interface HookMatcher {
  matcher?: string;
  hooks: HookCommand[];
}

export interface HooksConfig {
  PreToolUse?: HookMatcher[];
  PostToolUse?: HookMatcher[];
  Notification?: HookMatcher[];
  UserPromptSubmit?: HookMatcher[];
  Stop?: HookMatcher[];
  SubagentStop?: HookMatcher[];
  PreCompact?: HookMatcher[];
  SessionStart?: HookMatcher[];
  SessionEnd?: HookMatcher[];
}

export type PermissionRule = string;

export interface PermissionsConfig {
  allow?: PermissionRule[];
  ask?: PermissionRule[];
  deny?: PermissionRule[];
  defaultMode?: PermissionMode;
  disableBypassPermissionsMode?: "disable";
  additionalDirectories?: string[];
}

type EnvKey = `${Uppercase<string>}`;
export type EnvConfig = Partial<Record<EnvKey, string>>;

export interface StatusLineConfig {
  type: "command";
  command: string;
  padding?: number;
}

export type LoginMethod = "claudeai" | "console";

export interface Settings {
  $schema?: string;
  apiKeyHelper?: string;
  cleanupPeriodDays?: number;
  env?: EnvConfig;
  includeCoAuthoredBy?: boolean;
  model?: string;
  permissions?: PermissionsConfig;
  enableAllProjectMcpServers?: boolean;
  enabledMcpjsonServers?: string[];
  disabledMcpjsonServers?: string[];
  hooks?: HooksConfig;
  forceLoginMethod?: LoginMethod;
  disableAllHooks?: boolean;
  spinnerTipsEnabled?: boolean;
  alwaysThinkingEnabled?: boolean;
  statusLine?: StatusLineConfig;
  outputStyle?: string;
  forceLoginOrgUUID?: string;
  awsAuthRefresh?: string;
  awsCredentialExport?: string;
}
