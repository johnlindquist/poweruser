#!/usr/bin/env -S bun run

/**
 * Git History Storyteller Agent
 *
 * An agent that analyzes git history and generates narrative documentation:
 * - Creates visual timelines of major architectural changes
 * - Identifies key decisions and their rationale from commit messages and PRs
 * - Documents the evolution of specific features or modules
 * - Generates "archaeology reports" tracing how code sections developed over time
 * - Links related changes across different time periods
 * - Produces onboarding-friendly historical context for new developers
 *
 * Usage:
 *   bun run agents/git-history-storyteller.ts [options]
 *
 * Examples:
 *   # Generate full codebase history
 *   bun run agents/git-history-storyteller.ts
 *
 *   # Focus on a specific file
 *   bun run agents/git-history-storyteller.ts --file src/api/auth.ts
 *
 *   # Focus on a module with custom time range
 *   bun run agents/git-history-storyteller.ts --module src/features/billing --since "2 years ago"
 */

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type FocusType = "full" | "module" | "file";
type OutputFormat = "markdown" | "html";

interface StorytellerOptions {
  focus: FocusType;
  target?: string;
  since: string;
  outputFormat: OutputFormat;
  outputPath: string;
  includeTimeline: boolean;
  includeArchitecture: boolean;
}

const DEFAULT_SINCE = "1 year ago";
const DEFAULT_OUTPUT_PATH = "./HISTORY.md";
const DEFAULT_OUTPUT_FORMAT: OutputFormat = "markdown";

function printHelp(): void {
  console.log(`
📚 Git History Storyteller

Generates narrative documentation from your git history!

Usage:
  bun run agents/git-history-storyteller.ts [options]

Options:
  --file <path>          Focus on a specific file's history
  --module <path>        Focus on a module/directory's history
  --since <time>         Time range (default: "${DEFAULT_SINCE}")
  --output <path>        Output file path (default: ${DEFAULT_OUTPUT_PATH})
  --format <type>        Output format: markdown|html (default: ${DEFAULT_OUTPUT_FORMAT})
  --no-timeline          Skip timeline visualization
  --no-architecture      Skip architectural milestones section
  --help, -h             Show this help message

Examples:
  # Generate full codebase history
  bun run agents/git-history-storyteller.ts

  # Focus on a specific file
  bun run agents/git-history-storyteller.ts --file src/api/auth.ts

  # Focus on a module with custom time range
  bun run agents/git-history-storyteller.ts --module src/features/billing --since "2 years ago"

  # Custom output location
  bun run agents/git-history-storyteller.ts --output docs/CODEBASE_EVOLUTION.md

  # Generate recent history only
  bun run agents/git-history-storyteller.ts --since "3 months ago"
  `);
}

function parseOptions(): StorytellerOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  let focus: FocusType = "full";
  let target: string | undefined;

  const rawFile = values.file;
  const rawModule = values.module;
  const rawSince = values.since;
  const rawOutput = values.output;
  const rawFormat = values.format;

  if (typeof rawFile === "string" && rawFile.length > 0) {
    focus = "file";
    target = resolve(rawFile);
  } else if (typeof rawModule === "string" && rawModule.length > 0) {
    focus = "module";
    target = resolve(rawModule);
  }

  const since = typeof rawSince === "string" && rawSince.length > 0
    ? rawSince
    : DEFAULT_SINCE;

  const outputPath = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : DEFAULT_OUTPUT_PATH;

  const outputFormat: OutputFormat = typeof rawFormat === "string" && rawFormat.length > 0
    ? (rawFormat as OutputFormat)
    : DEFAULT_OUTPUT_FORMAT;

  if (!["markdown", "html"].includes(outputFormat)) {
    console.error("❌ Error: Invalid format. Must be markdown or html");
    process.exit(1);
  }

  const includeTimeline = values["no-timeline"] !== true;
  const includeArchitecture = values["no-architecture"] !== true;

  // Validate focus options
  if ((focus === "file" || focus === "module") && !target) {
    console.error(`❌ Error: --${focus} requires a target path\n`);
    console.log("Run with --help for usage information");
    process.exit(1);
  }

  return {
    focus,
    target,
    since,
    outputFormat,
    outputPath,
    includeTimeline,
    includeArchitecture,
  };
}

function buildPrompt(options: StorytellerOptions): string {
  const {
    focus,
    target,
    since,
    outputFormat,
    outputPath,
    includeTimeline,
    includeArchitecture,
  } = options;

  const focusDescription =
    focus === "file" ? `the specific file: "${target}"` :
    focus === "module" ? `the module/directory: "${target}"` :
    "the entire codebase";

  return `You are a Git History Storyteller. Your mission is to analyze the git history and create a compelling narrative documentation about the evolution of ${focusDescription}.

## Your Task

Generate a comprehensive historical narrative that tells the story of how this codebase evolved over time. This documentation will be invaluable for new developers joining the team.

### Phase 1: Historical Analysis
1. Use Bash to run git commands and gather historical data:
   - Get commit history with: \`git log --since="${since}" --pretty=format:"%h|%an|%ad|%s" --date=short\`
   - Identify major milestones and version tags: \`git tag -l --sort=-version:refname\`
   - Find the most modified files: \`git log --since="${since}" --name-only --pretty=format: | sort | uniq -c | sort -rn | head -20\`
   ${focus === 'file' ? `- Get detailed history for ${target}: \`git log --since="${since}" --follow --pretty=format:"%h|%an|%ad|%s" --date=short -- "${target}"\`` : ''}
   ${focus === 'file' ? `- Analyze how the file changed over time: \`git log --since="${since}" --follow -p -- "${target}" | head -500\`` : ''}
   ${focus === 'module' ? `- Get history for the module: \`git log --since="${since}" --pretty=format:"%h|%an|%ad|%s" --date=short -- "${target}/**"\`` : ''}

2. Identify architectural changes:
   - Look for commits mentioning: refactor, architecture, redesign, migration, upgrade
   - Find breaking changes and major version bumps
   - Identify new feature additions and deprecations

3. Analyze patterns and trends:
   - Who are the main contributors to this area?
   - What were the major pain points (bugs, hotfixes)?
   - What technologies or patterns were adopted?
   - What design decisions were made?

### Phase 2: Story Creation
Using your analysis, create a narrative document with these sections:

${includeTimeline ? `
#### Timeline of Major Changes
Create a visual timeline showing key milestones, releases, and architectural changes. Use markdown formatting:
\`\`\`
📅 YYYY-MM-DD | Major Event
---
🎯 YYYY-MM-DD | Feature Addition
---
🔧 YYYY-MM-DD | Refactoring
---
🐛 YYYY-MM-DD | Critical Bug Fix
\`\`\`
` : ''}

#### The Evolution Story
Write a narrative (3-5 paragraphs) that tells the story of how ${focusDescription} evolved:
- What was the initial state/purpose?
- What problems needed to be solved?
- How did the design change over time?
- What key decisions were made and why?
- What lessons were learned?

${includeArchitecture ? `
#### Architectural Milestones
Document major architectural changes with:
- What changed and when
- The rationale behind the change (infer from commit messages)
- Impact on the codebase
- Related commits and contributors
` : ''}

#### Key Contributors & Their Impact
Identify the main contributors and describe their contributions:
- Who built the initial version?
- Who drove major refactorings?
- Who are the domain experts?

#### Code Archaeology: Notable Patterns
Trace interesting patterns in the code:
- Legacy code that's still around (and why)
- Code that was removed (and why)
- Patterns that emerged and evolved
- Technical debt that accumulated and was addressed

#### Onboarding Guide
Based on the history, provide guidance for new developers:
- What should they know about the history before modifying this code?
- What are the sensitive/critical areas?
- What patterns should they follow?
- Where can they find more context?

### Phase 3: Write the Documentation
- Use the Write tool to create the documentation file at: ${outputPath}
- Format it in ${outputFormat}
- Make it engaging, informative, and practical
- Include links to specific commits when relevant (format: \`<commit-hash>\`)

## Guidelines
- Be thorough but concise - aim for quality over quantity
- Infer motivations and rationale when commit messages are sparse
- Highlight interesting or unusual decisions
- Make the narrative engaging and easy to read
- Include specific examples and commit references
- Format dates consistently (YYYY-MM-DD)

Start by gathering the git history data.`.trim();
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["file", "module", "since", "output", "format", "no-timeline", "no-architecture", "help", "h"] as const;

  for (const key of agentKeys) {
    if (key in values) {
      delete values[key];
    }
  }
}

const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("📚 Git History Storyteller Agent\n");
console.log(`Focus: ${options.focus}${options.target ? ` (${options.target})` : ""}`);
console.log(`Time Range: Since ${options.since}`);
console.log(`Output: ${options.outputPath}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Bash",
  "Read",
  "Glob",
  "Grep",
  "Write",
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "acceptEdits",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Git History Story Generated!\n");
    console.log(`📖 Your history documentation is ready at: ${options.outputPath}`);
    console.log("\n💡 Tip: Share this documentation with your team or include it in your onboarding materials!");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
