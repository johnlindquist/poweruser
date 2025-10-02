#!/usr/bin/env bun

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
 * - Perfect for content creators who want to share their learning journey
 * - Can process single days, weeks, or custom date ranges
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const TWEETS_DIR = process.argv[2] || process.cwd();
const DAYS_BACK = parseInt(process.argv[3] || '7');
const TWEETS_PER_DAY = parseInt(process.argv.find(arg => arg.startsWith('--per-day='))?.split('=')[1] || '12');
const OUTPUT_PREFIX = process.argv.find(arg => arg.startsWith('--prefix='))?.split('=')[1] || '';
const SINGLE_FILE = process.argv.includes('--single-file');
const prefixInstruction = OUTPUT_PREFIX
  ? `\nWhen saving files, prefix each filename with \"${OUTPUT_PREFIX}\".`
  : '';

async function main() {
  console.log('🐦 TIL Tweet Generator Agent');
  console.log(`📁 Output directory: ${TWEETS_DIR}`);
  console.log(`📅 Analyzing last ${DAYS_BACK} days of conversations`);
  console.log(`📊 Target: ${TWEETS_PER_DAY} tweets per day`);
  if (SINGLE_FILE) {
    console.log('📄 Mode: Single file with all tweets');
  } else {
    console.log('📄 Mode: One file per day');
  }
  console.log();

  const systemPrompt = `You are a TIL Tweet Generator agent that transforms Claude Code conversation history into engaging, educational tweets.

Your task is to:
1. Discover and analyze Claude conversation files:
   - Find .jsonl files in ~/.claude/projects/**/*.jsonl
   - Filter files by timestamp to match the requested date range (last ${DAYS_BACK} days)
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
   - Generate ${TWEETS_PER_DAY} tweets per day (or fewer if not enough material)
   - Create clear date headers (e.g., "## September 26, 2025 (Thursday)")
   - Add brief context about what projects were worked on that day
   - Sort chronologically (most recent first)

6. Format output:
   ${SINGLE_FILE ? `
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
- Don't force ${TWEETS_PER_DAY} tweets if there isn't enough quality material`;

  const prompt = `Generate TIL tweets from the last ${DAYS_BACK} days of Claude conversations.

Follow this workflow:

**Step 1: Discover conversation files**
Find all JSONL files from the last ${DAYS_BACK} days:

\`\`\`bash
# Find files modified in the last ${DAYS_BACK} days with timestamps
find ~/.claude/projects -name "*.jsonl" -type f -mtime -${DAYS_BACK} -exec stat -f "%Sm %N" -t "%Y-%m-%d" {} \\; | sort -r
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
2. Extract ${TWEETS_PER_DAY} best learnings from those conversations
3. Create contextual header (e.g., "Heavy Electron development" or "API refactoring")
4. Number tweets 1-${TWEETS_PER_DAY}

**Step 5: Generate output files**
${SINGLE_FILE ? `
Create single file: [timestamp]-range.md

Structure:
\`\`\`markdown
# TIL Tweets - [Date Range]

Generated from ${DAYS_BACK} days of Claude conversations

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
...${TWEETS_PER_DAY}. TIL: [Final insight]

---
*Generated from Claude conversation history on [date]*
\`\`\`
`}

**Step 6: Save results**
${SINGLE_FILE ? `
Write the combined file to ${TWEETS_DIR}/[timestamp]-range.md${prefixInstruction}
` : `
Write each daily file to ${TWEETS_DIR}/YYYY-MM-DD.md${prefixInstruction}
`}

**Quality Guidelines:**
- Every tweet should teach something specific
- Include technical details (versions, commands, file names)
- Vary topics across: debugging, configuration, APIs, tools, performance, security
- Sound conversational and genuine
- Focus on "aha moments" and "gotchas"
- Skip generic advice - only real discoveries

Start by discovering the conversation files and organizing them by date!`;

  try {
    const result = query({
      prompt,
      options: {
        cwd: TWEETS_DIR,
        systemPrompt,
        allowedTools: [
          'Bash',
          'Glob',
          'Read',
          'Write'
        ],
        permissionMode: 'bypassPermissions',
        model: 'sonnet',
      }
    });

    for await (const message of result) {
      if (message.type === 'assistant') {
        // Show assistant thinking/working
        for (const block of message.message.content) {
          if (block.type === 'text') {
            console.log(block.text);
          }
        }
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          console.log('\n✅ TIL tweet generation complete!');
          console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
          console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`📊 Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);

          if (message.result) {
            console.log('\n' + message.result);
          }

          console.log(`\n📁 Tweets saved to: ${TWEETS_DIR}`);
          console.log('🐦 Ready to share your learning journey!');
        } else {
          console.error('\n❌ Tweet generation failed:', message.subtype);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error running TIL Tweet Generator:', error);
    process.exit(1);
  }
}

main();
