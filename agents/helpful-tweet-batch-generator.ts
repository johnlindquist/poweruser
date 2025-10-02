#!/usr/bin/env -S bun run

/**
 * Helpful Tweet Batch Generator Agent
 *
 * This agent generates batches of helpful tweets in John Lindquist's voice:
 * - Creates exactly N tweets matching the helpful tone and style
 * - Uses template families: Hook + Micro-Insight, One-Breath "Do this → Get that", Curious Counter-Question
 * - Follows strict character limits (100-190 characters, single line)
 * - Optionally includes reply variants
 * - Outputs structured markdown file with QA checklist
 *
 * Usage:
 *   bun run agents/helpful-tweet-batch-generator.ts [idea] [options]
 *
 * Examples:
 *   # Generate 10 helpful tweets (default)
 *   bun run agents/helpful-tweet-batch-generator.ts
 *
 *   # Generate 5 tweets based on a specific idea
 *   bun run agents/helpful-tweet-batch-generator.ts "Claude Code agents are powerful" --count 5
 *
 *   # Generate 10 tweets with reply variants
 *   bun run agents/helpful-tweet-batch-generator.ts --include-replies
 *
 *   # Specify custom output file
 *   bun run agents/helpful-tweet-batch-generator.ts --output ./my-tweets.md
 */

import { resolve, dirname } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface TweetGeneratorOptions {
  count: number;
  idea?: string;
  output: string;
  includeReplies: boolean;
}

const DEFAULT_COUNT = 10;
const DEFAULT_OUTPUT = "./tweet-batch.md";

function printHelp(): void {
  console.log(`
🐦 Helpful Tweet Batch Generator

Usage:
  bun run agents/helpful-tweet-batch-generator.ts [idea] [options]

Arguments:
  idea                    Central idea or draft to expand (optional)

Options:
  --count <number>        Number of tweets to generate (default: ${DEFAULT_COUNT})
  --idea <text>           Alternative way to specify the idea/draft
  --draft <text>          Alternative way to specify the idea/draft
  --tweet-idea <text>     Alternative way to specify the idea/draft
  --output <file>         Output file path (default: ${DEFAULT_OUTPUT})
  --include-replies       Include reply variants in the batch
  --help, -h              Show this help

Examples:
  bun run agents/helpful-tweet-batch-generator.ts
  bun run agents/helpful-tweet-batch-generator.ts "Claude Code agents" --count 5
  bun run agents/helpful-tweet-batch-generator.ts --include-replies
  bun run agents/helpful-tweet-batch-generator.ts --output ./my-tweets.md
  `);
}

function parseOptions(): TweetGeneratorOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawCount = values.count;
  const tweetCount = typeof rawCount === "string"
    ? Number.parseInt(rawCount, 10)
    : DEFAULT_COUNT;

  if (!Number.isFinite(tweetCount) || tweetCount <= 0) {
    console.error('❌ Invalid --count value. Please provide a positive integer.');
    process.exit(1);
  }

  const rawIdea =
    values.idea ??
    values.draft ??
    values['tweet-idea'] ??
    (positionals.length > 0 ? positionals[0] : undefined);
  const trimmedIdea = (rawIdea as string | undefined)?.trim();
  const idea = trimmedIdea && trimmedIdea.length > 0 ? trimmedIdea : undefined;

  const rawOutput = values.output;
  const output = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : DEFAULT_OUTPUT;

  const includeReplies = values['include-replies'] === true;

  return {
    count: tweetCount,
    idea,
    output,
    includeReplies,
  };
}

function buildPrompt(options: TweetGeneratorOptions): string {
  const { count, idea, output, includeReplies } = options;
  const outputPath = resolve(output);
  const outputDir = dirname(outputPath);
  const runDate = new Date().toISOString().split('T')[0];

  const STYLE_SAMPLES = `# Voice Samples — Helpful (Top Performers)

- Install the Gemini CLI; add this to your \`.zshrc\`: \`google()\` → free web searches (try: "what's the latest egghead lesson?").
- 🧵 My current AI dev stack — 8 tools I use daily (+2 honorable mentions). What they do and what they cost. 👇
- For the people asking "how?": automated research chain — drop in a source link → system prompt spins up 3+ sub-agents to scour the latest → loop.
- The claude code version: \`web(){ claude -p -p ... }\` — no tool restriction (yet) and a bit slower.
- Claude Code getting stale? Add this to \`.zshrc\` to refresh prompts (with sadistic commentary and comically R-rated todo lists 🙃).
- zsh + \`gh\`: wrap Claude Code + GitHub CLI so \`gist\` builds a verbose, AI-generated summary of the selected files.
- Preload context in Claude Code from the CLI: \`claude "/preload Verify user logged in during checkout"\`.
- 1) vibe-code a project → 2) generate event/user-flow diagrams → 3) ask the agent for test coverage; then sit back and watch 🍿
- Configuring Claude agents feels like Cursor's \`.mdc\` rules — the future is frontmatter.
- Superwhisper 2 (Parakeet): instant, accurate dictation; update all the things — ~$9/mo.
- New free 🍌 lesson: "Batch generate nano banana image variations" with Google AI Studio + Bun scripting 👇
- My #1 tip to quickly improve your AI dev skills: PRACTICE (workshops help, but mostly PRACTICE).
`;

  const TEMPLATE_FAMILIES = `### Template Families

1. **Hook + Micro-Insight**
   - One crisp hook about the topic, then a surprising actionable detail.
   - Length: 100–180 characters, single line.
   - Optional question ending.

2. **One-Breath "Do this → Get that"**
   - Mini how-to with 1–2 concrete steps and outcome.
   - Allow exactly one inline \`code\` token if it clarifies a flag/CLI snippet.

3. **Curious Counter-Question**
   - Contrast conventional wisdom with your observation, end with sincere question.
   - Great for nudging reflection without sounding combative.
`;

  return `You are preparing a batch of ${count} helpful tweets that sound exactly like John Lindquist.

## Inputs
- Draft/idea provided: ${idea ?? 'None (derive a central helpful theme yourself)'}
- Include reply variants? ${includeReplies ? 'Yes' : 'No'}
- Output path: ${outputPath}
- Run date: ${runDate}

## Resources
1. Treat the draft/idea as the nucleus—deconstruct it into multiple helpful angles or refinements.
2. You may inspect repo files (e.g., ideas.md, recent agent scripts) for fresh hooks that align with the helpful tone.
3. Use the STYLE_SAMPLES block to mimic cadence and phrasing.

## Production Guidelines
- Deliver exactly ${count} tweets.
- Use the template families below. Aim for a 4 / 3 / 3 split across Hook + Micro-Insight, One-Breath "Do this → Get that", and Curious Counter-Question. If replies are requested, reserve up to 3 slots for reply-style outputs while keeping totals at ${count}.
- Keep every tweet under 200 characters; hard stop at 270 characters.
- Each tweet must be a single physical line with no list formatting.
- Never reuse the same emoji twice in a single tweet; skip emoji when it feels forced.
- Ground each tweet in a concrete action, tip, workflow, or observation tied to agents, AI dev tooling, or lessons the repo hints at.
- Where helpful, cite tiny metrics, file names, or CLI flags to keep it actionable.
- Vary openings so the batch doesn't feel templated (e.g., rotate between hook, direct insight, soft question).
- If crafting reply variants, preface with the handle supplied in your planning table (e.g., "@handle ...").

${TEMPLATE_FAMILIES}

### Style Samples to Emulate
\`\`\`markdown
${STYLE_SAMPLES}
\`\`\`

## Workflow
1. Expand the provided draft/idea into at least six angles (if none provided, infer timely angles from repo context).
2. Build a planning table (angle, template family, emoji usage, reply vs original) in your scratchpad.
3. Draft candidate tweets for each slot; revise until they satisfy all constraints.
4. Run a quick QA pass: length within bounds, emoji set correct, no hashtags, first-person perspective, helpful takeaway.
5. Use the Write tool to create ${outputPath}. Ensure directory exists first (${outputDir}).
6. File format must follow:

\`\`\`markdown
# Helpful Tweet Batch — ${runDate}

- Total tweets: ${count}
- Template mix: Hook + Micro-Insight (4) · One-Breath Do this → Get that (3) · Curious Counter-Question (3${includeReplies ? ' including up to 3 replies' : ''})
- Voice reference: Helpful top-performing posts (see samples below)

## Hook + Micro-Insight
1. [tweet]
2. ...

## One-Breath "Do this → Get that"
5. [tweet]

## Curious Counter-Question
8. [tweet]

## QA Checklist
- [ ] Character counts + emoji usage confirmed
- [ ] Angles covered: <comma-separated list>
- [ ] Ready to schedule via agent tooling
\`\`\`

7. Append a final section "### Style Samples Reference" that embeds the STYLE_SAMPLES block (so the file is self-contained).
8. After writing, print a short console recap listing the angles covered and the file path.

Focus on quality: every tweet should feel like a mini lesson or provocation John would share today.`;
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["count", "idea", "draft", "tweet-idea", "output", "include-replies", "help", "h"] as const;

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

console.log('🐦 Helpful Tweet Batch Generator\n');
console.log(`📝 Target tweets: ${options.count}`);
console.log(`📄 Output: ${resolve(options.output)}`);
console.log(options.idea ? `💡 Draft/idea: ${options.idea}` : '💡 Draft/idea: (agent will derive helpful angles itself)');
console.log(options.includeReplies ? '💬 Include reply variants: yes' : '💬 Include reply variants: no');
console.log();

const SYSTEM_PROMPT = `You are the helpful tweet ghostwriter for John Lindquist.

Quick style DNA you must honor:
- First-person, technical yet friendly; audience = AI builders & power users.
- Single line per tweet; 100–190 characters; keep it scannable.
- 0–1 emoji chosen from [😇 😅 👀 😉 🙃 🔥 💛 🍿].
- No hashtags. No ALL CAPS hype. No exclamation points unless explicitly required.
- Questions outperform statements; feel free to end with one when natural.
- Avoid marketing fluff; prefer concrete verbs, setup → payoff, and practical proof.
- Inline \`code\` is welcome when it conveys a flag, command, or file.
- Prefer links only when vital (most tweets will have none).

Your priority is to surface genuinely useful, specific insights. Mirror the pacing, diction, and vibe of the supplied voice samples.
If a reply variant is requested, keep the tone polite, curious, and additive while staying one line.`;

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Bash",
  "Read",
  "Write",
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
  "append-system-prompt": SYSTEM_PROMPT,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Helpful tweet batch complete!\n");
    console.log(`📄 Output saved to: ${resolve(options.output)}`);
    console.log("\nNext steps:");
    console.log("1. Review the generated tweets");
    console.log("2. Check the QA checklist");
    console.log("3. Schedule via agent tooling or manually");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
