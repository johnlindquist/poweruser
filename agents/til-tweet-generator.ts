#!/usr/bin/env -S bun run

/**
 * TIL Tweet Generator Agent
 *
 * Analyzes Claude Code conversation history to generate authentic TIL (Today I Learned) tweets:
 * - Scans .jsonl conversation files from ~/.claude/projects for specified time periods
 * - Extracts interesting learnings, solutions, and technical insights from conversations
 * - Organizes tweets chronologically by day based on file timestamps
 * - Generates 10-15 genuine, helpful tweets per day
 * - Creates markdown files with tweets grouped by date
 * - Focuses on actionable technical insights rather than generic statements
 * - Perfect for content creators who want to share your learning journey
 * - Can process single days, weeks, or custom date ranges
 *
 * Usage:
 *   bun run agents/til-tweet-generator.ts [output-dir] [options]
 *
 * Examples:
 *   # Generate tweets for last 7 days (default)
 *   bun run agents/til-tweet-generator.ts
 *
 *   # Generate tweets for last 14 days
 *   bun run agents/til-tweet-generator.ts --days 14
 *
 *   # Generate more tweets per day
 *   bun run agents/til-tweet-generator.ts --per-day 20
 *
 *   # Output to specific directory
 *   bun run agents/til-tweet-generator.ts ./tweets --days 30
 *
 *   # Generate single file with all tweets
 *   bun run agents/til-tweet-generator.ts --single-file
 *
 *   # Add prefix to output filenames
 *   bun run agents/til-tweet-generator.ts --prefix "my-"
 */

import { resolve } from "node:path";
import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface TilTweetOptions {
  outputDir: string;
  daysBack: number;
  tweetsPerDay: number;
  outputPrefix: string;
  singleFile: boolean;
}

const DEFAULT_DAYS_BACK = 7;
const DEFAULT_TWEETS_PER_DAY = 12;

function printHelp(): void {
  console.log(`
🐦 TIL Tweet Generator

Usage:
  bun run agents/til-tweet-generator.ts [output-dir] [options]

Arguments:
  output-dir              Directory to save tweet files (default: current directory)

Options:
  --days <number>         Number of days back to analyze (default: ${DEFAULT_DAYS_BACK})
  --per-day <number>      Number of tweets per day (default: ${DEFAULT_TWEETS_PER_DAY})
  --prefix <string>       Prefix for output filenames
  --single-file           Generate single file instead of one per day
  --help, -h              Show this help

Examples:
  bun run agents/til-tweet-generator.ts
  bun run agents/til-tweet-generator.ts ./tweets --days 14
  bun run agents/til-tweet-generator.ts --per-day 20 --single-file
  bun run agents/til-tweet-generator.ts --prefix "til-" --days 30
  `);
}

function parseOptions(): TilTweetOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const outputDir = positionals[0]
    ? resolve(positionals[0])
    : process.cwd();

  const rawDays = values.days;
  const rawPerDay = values["per-day"];
  const rawPrefix = values.prefix;
  const singleFile = values["single-file"] === true;

  const daysBack = typeof rawDays === "string" && rawDays.length > 0
    ? parseInt(rawDays, 10)
    : DEFAULT_DAYS_BACK;

  const tweetsPerDay = typeof rawPerDay === "string" && rawPerDay.length > 0
    ? parseInt(rawPerDay, 10)
    : DEFAULT_TWEETS_PER_DAY;

  const outputPrefix = typeof rawPrefix === "string" && rawPrefix.length > 0
    ? rawPrefix
    : "";

  if (isNaN(daysBack) || daysBack < 1) {
    console.error("❌ Error: --days must be a positive number");
    process.exit(1);
  }

  if (isNaN(tweetsPerDay) || tweetsPerDay < 1) {
    console.error("❌ Error: --per-day must be a positive number");
    process.exit(1);
  }

  return {
    outputDir,
    daysBack,
    tweetsPerDay,
    outputPrefix,
    singleFile,
  };
}

function buildSystemPrompt(options: TilTweetOptions): string {
  const { daysBack, tweetsPerDay, singleFile, outputPrefix } = options;
  const prefixInstruction = outputPrefix
    ? `\nWhen saving files, prefix each filename with "${outputPrefix}".`
    : "";

  return `You are a TIL Tweet Generator agent that transforms Claude Code conversation history into engaging, educational tweets.

Your task is to:
1. Discover and analyze Claude conversation files:
   - Find .jsonl files in ~/.claude/projects/**/*.jsonl
   - Filter files by timestamp to match the requested date range (last ${daysBack} days)
   - Use file modification time to organize conversations by day
   - Identify which conversations have substantial technical content

2. Extract meaningful learnings from conversations:
   - Read conversation JSONL files using head/tail and jq to parse JSON
   - Look for human prompts and assistant responses with technical insights
   - Identify patterns: debugging solutions, API discoveries, tool usage, configuration fixes
   - Extract specific technical details: version numbers, command examples, API patterns
   - Focus on actionable insights rather than vague generalizations
   - Note project names from directory paths for context

3. Analyze conversation content for tweet-worthy material:
   - **Technical discoveries:** "TIL: Electron 38+ uses Node 22.18, not Node 20!"
   - **Configuration tips:** "TIL: Always externalize native modules in Vite config"
   - **Debugging insights:** "TIL: The \`open\` package causes __dirname errors when bundled"
   - **API patterns:** "TIL: React Server Actions must use 'use server' directive"
   - **Tooling tricks:** "TIL: Use \`gh pr create --web\` to review PR in browser first"
   - **Performance wins:** "TIL: Switching from fetch to axios reduced API latency by 40%"
   - **Security findings:** "TIL: Never commit .env files - use .env.example instead"

4. Generate authentic TIL tweets:
   - Keep tweets concise (under 280 characters ideally, max 2-3 sentences)
   - Start with "TIL:" to maintain the format
   - Be specific with technical details (versions, commands, file names)
   - Include code snippets in backticks when relevant
   - Make them genuinely helpful and actionable
   - Vary the topics to avoid repetition
   - Sound natural and conversational, not robotic

5. Organize tweets by day:
   - Group tweets by the date of the conversation
   - Generate ${tweetsPerDay} tweets per day (or fewer if not enough material)
   - Create clear date headers (e.g., "## September 26, 2025 (Thursday)")
   - Add brief context about what projects were worked on that day
   - Sort chronologically (most recent first)

6. Format output:
   ${singleFile ? `
   Create a single markdown file with all tweets:
   - Filename: YYYY-MM-DD-HH-MM-weekly.md (or -range.md)
   - Structure: Date sections with tweets under each
   - Include summary at top with total tweet count and date range
   ` : `
   Create one markdown file per day:
   - Filename: YYYY-MM-DD.md for each day
   - Structure: Date header, context, tweets numbered 1-N
   - Include project context at top of each file
   `}

Use Bash to find and analyze JSONL files, parse them with jq, and extract conversation content efficiently.

IMPORTANT:
- Only extract real learnings from actual conversations, don't fabricate content
- Focus on technical specifics over generic advice
- Vary tweet topics - don't repeat the same insight in different words
- Skip days with no meaningful technical conversations
- Preserve authenticity - these should sound like real developer discoveries
- Include enough detail to be actionable (versions, commands, specific errors)
- Group related topics together when they came from the same conversation
- Don't force ${tweetsPerDay} tweets if there isn't enough quality material${prefixInstruction}`;
}

function buildPrompt(options: TilTweetOptions): string {
  const { daysBack, tweetsPerDay, singleFile, outputDir, outputPrefix } = options;
  const prefixInstruction = outputPrefix
    ? `\nWhen saving files, prefix each filename with "${outputPrefix}".`
    : "";

  return `Generate TIL tweets from the last ${daysBack} days of Claude conversations.

Follow this workflow:

**Step 1: Discover conversation files**
Find all JSONL files from the last ${daysBack} days:

\`\`\`bash
# Find files modified in the last ${daysBack} days with timestamps
find ~/.claude/projects -name "*.jsonl" -type f -mtime -${daysBack} -exec stat -f "%Sm %N" -t "%Y-%m-%d" {} \\; | sort -r
\`\`\`

Group files by date and note which projects/directories they're in.

**Step 2: Extract conversation content**
For each day, sample conversations to extract learnings:

\`\`\`bash
# Example: Extract human messages and assistant responses
head -200 FILE.jsonl | jq -r 'select(.type == "human" or .type == "assistant") | .text // .content' | grep -v "null"
\`\`\`

Look for:
- Questions asked and solutions provided
- Error messages and their fixes
- Configuration changes that solved problems
- API usage patterns and discoveries
- Tool commands and their purposes
- Version-specific issues and resolutions

**Step 3: Identify tweet-worthy insights**
For each conversation, extract specific learnings:

✅ **Good TIL tweets (specific, actionable):**
- "TIL: Vite's \`optimizeDeps.exclude\` prevents bundling of native modules in Electron"
- "TIL: Next.js 14's Server Actions need 'use server' at top of async functions, not files"
- "TIL: \`gh pr create --draft\` lets you push WIP without triggering CI pipelines"

❌ **Bad TIL tweets (too vague, not helpful):**
- "TIL: Configuration is important in web development"
- "TIL: Reading documentation helps solve problems"
- "TIL: Testing your code before deploying is good practice"

**Step 4: Organize by day**
For each day in the range:
1. List the projects/directories worked on that day
2. Extract ${tweetsPerDay} best learnings from those conversations
3. Create contextual header (e.g., "Heavy Electron development" or "API refactoring")
4. Number tweets 1-${tweetsPerDay}

**Step 5: Generate output files**
${singleFile ? `
Create single file: [timestamp]-range.md

Structure:
\`\`\`markdown
# TIL Tweets - [Date Range]

Generated from ${daysBack} days of Claude conversations

**Summary:**
- Total tweets: N
- Date range: [start] to [end]
- Projects covered: [list]

## [Most Recent Date] (Day Name)
*[Brief context about that day's work]*

1. TIL: [Specific technical insight]
2. TIL: [Another insight]
...

## [Next Date] (Day Name)
*[Context]*

1. TIL: [Insight]
...
\`\`\`
` : `
Create separate files: YYYY-MM-DD.md for each day

Structure for each file:
\`\`\`markdown
# TIL Tweets - [Date]

**Projects:** [List of projects/areas worked on]

**Context:** [Brief description of the day's focus]

1. TIL: [Specific technical insight]
2. TIL: [Another insight]
3. TIL: [Yet another insight]
...${tweetsPerDay}. TIL: [Final insight]

---
*Generated from Claude conversation history on [date]*
\`\`\`
`}

**Step 6: Save results**
${singleFile ? `
Write the combined file to ${outputDir}/[timestamp]-range.md${prefixInstruction}
` : `
Write each daily file to ${outputDir}/YYYY-MM-DD.md${prefixInstruction}
`}

**Quality Guidelines:**
- Every tweet should teach something specific
- Include technical details (versions, commands, file names)
- Vary topics across: debugging, configuration, APIs, tools, performance, security
- Sound conversational and genuine
- Focus on "aha moments" and "gotchas"
- Skip generic advice - only real discoveries

Start by discovering the conversation files and organizing them by date!`;
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🐦 TIL Tweet Generator\n");
console.log(`📁 Output directory: ${options.outputDir}`);
console.log(`📅 Analyzing last ${options.daysBack} days of conversations`);
console.log(`📊 Target: ${options.tweetsPerDay} tweets per day`);
if (options.singleFile) {
  console.log("📄 Mode: Single file with all tweets");
} else {
  console.log("📄 Mode: One file per day");
}
if (options.outputPrefix) {
  console.log(`📝 Filename prefix: ${options.outputPrefix}`);
}
console.log("");

// Change to output directory
const originalCwd = process.cwd();
process.chdir(options.outputDir);

const prompt = buildPrompt(options);
const systemPrompt = buildSystemPrompt(options);
const settings: Settings = {};

removeAgentFlags([
    "days", "per-day", "prefix", "single-file", "help", "h"
  ]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  "append-system-prompt": systemPrompt,
  allowedTools: "Bash Glob Read Write TodoWrite",
  "permission-mode": "bypassPermissions",
};

try {
  const exitCode = await claude(prompt, defaultFlags);

  // Restore original directory
  process.chdir(originalCwd);

  if (exitCode === 0) {
    console.log("\n✨ TIL tweet generation complete!\n");
    console.log(`📁 Tweets saved to: ${options.outputDir}`);
    console.log("🐦 Ready to share your learning journey!");
  }
  process.exit(exitCode);
} catch (error) {
  process.chdir(originalCwd);
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
