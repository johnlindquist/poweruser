#!/usr/bin/env -S bun run

/**
 * Breaking Change Detector
 *
 * A practical everyday agent that prevents API breaking changes before they ship.
 * Scans git changes to identify potential breaking changes for library/API consumers.
 *
 * Usage: bun agents/breaking-change-detector.ts [base-branch]
 */

import { claude, getPositionals, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

function printHelp(): void {
  console.log(`\n🔍 Breaking Change Detector\n\nUsage:\n  bun run agents/breaking-change-detector.ts [base-branch]\n\nArguments:\n  base-branch   Git ref to compare against (default: main)\n\nOptions:\n  --help, -h    Show this help message\n`);
}

const values = parsedArgs.values as Record<string, unknown>;
const help = values.help === true || values.h === true;

if (help) {
  printHelp();
  process.exit(0);
}

const baseBranch = getPositionals()[0] ?? 'main';

const prompt = `You are a Breaking Change Detector agent that analyzes code changes to identify potential breaking changes for library/API consumers.

## Your Task

Analyze the git changes in this repository (comparing current branch to ${baseBranch}) and identify:

1. **Function Signature Changes**:
   - New required parameters added to exported functions
   - Removed parameters from exported functions
   - Changed parameter types (e.g., string → number)
   - Changed return types

2. **Removed/Renamed Exports**:
   - Deleted exported functions, classes, or variables
   - Renamed exports without maintaining backward compatibility

3. **TypeScript Interface Changes**:
   - New required properties in interfaces
   - Removed properties from interfaces
   - Changed property types
   - Changed from optional to required (or vice versa)

4. **Class API Changes**:
   - Removed public methods
   - Changed method signatures in public APIs
   - Changed constructor signatures

## Steps to Complete

1. **Get Git Changes**:
   - Run \`git diff ${baseBranch}...HEAD\` to see all changes
   - If that fails, try \`git diff ${baseBranch}\`
   - Focus on files that likely contain public APIs (index.ts, exports, etc.)

2. **Analyze Each Changed File**:
   - Read the full current version of changed files
   - Identify what's exported (functions, classes, interfaces, types)
   - Look for breaking patterns in the diff

3. **Categorize Breaking Changes**:
   - MAJOR (breaking): Removed exports, required param changes, type changes
   - MINOR (potentially breaking): New optional params, new exports
   - PATCH (safe): Bug fixes, internal changes, documentation

4. **Generate Upgrade Guide**:
   For each breaking change, provide:
   - What changed
   - Why it breaks consumers
   - Before/after code examples
   - Migration steps

5. **Suggest Semver Bump**:
   Based on findings, recommend: major, minor, or patch

## Output Format

Generate a markdown report with:

\`\`\`markdown
# Breaking Change Analysis

## Summary
- **Recommended Version Bump**: [MAJOR|MINOR|PATCH]
- **Breaking Changes Found**: [count]
- **Potentially Breaking**: [count]
- **Safe Changes**: [count]

## Breaking Changes (MAJOR)

### [File Path]

#### [Export Name]
**Type**: [Function|Class|Interface|Type]
**Change**: [Description]
**Impact**: [How it breaks consumers]

**Before**:
\`\`\`typescript
// old code
\`\`\`

**After**:
\`\`\`typescript
// new code
\`\`\`

**Migration Guide**:
[Step-by-step instructions]

---

## Potentially Breaking Changes (MINOR)

[Same format as above]

## Safe Changes (PATCH)

[Brief list]

## Recommendations

1. [Specific recommendations for minimizing breaking changes]
2. [Alternative approaches if possible]
3. [Communication strategy for users]
\`\`\`

Start by getting the git diff, then analyze the changes systematically.`;

console.log('🔍 Breaking Change Detector Starting...\n');
console.log(`📊 Comparing current branch with: ${baseBranch}\n`);

const settings: Settings = {};
const allowedTools = [
  'Bash',
  'Read',
  'Grep',
  'Glob',
  'Write',
];

const defaultFlags: ClaudeFlags = {
  model: 'claude-sonnet-4-5-20250929',
  allowedTools: allowedTools.join(' '),
  'permission-mode': 'bypassPermissions',
  settings: JSON.stringify(settings),
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
  console.log('\n✅ Analysis Complete!');
} catch (error) {
  console.error('❌ Error running Breaking Change Detector:', error);
  process.exit(1);
}
