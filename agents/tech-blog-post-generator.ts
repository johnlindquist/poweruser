#!/usr/bin/env -S bun run

/**
 * Tech Blog Post Generator Agent
 *
 * An agent that transforms your code into compelling technical blog posts:
 * - Analyzes recent commits, PRs, and code changes
 * - Identifies interesting technical problems you solved
 * - Detects patterns like performance optimizations, architectural decisions, bug fixes
 * - Drafts a complete blog post with introduction, problem, solution, and takeaways
 * - Includes relevant code snippets with explanations
 * - Suggests catchy titles and social media hooks
 * - Helps overcome writer's block and build your personal brand
 *
 * Usage:
 *   bun run agents/tech-blog-post-generator.ts [options]
 *   bun run agents/tech-blog-post-generator.ts --since "1 week ago"
 *   bun run agents/tech-blog-post-generator.ts --focus performance
 *   bun run agents/tech-blog-post-generator.ts --file src/api/users.ts
 */

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type FocusType = 'all' | 'performance' | 'architecture' | 'bugfix' | 'feature';
type ToneType = 'technical' | 'casual' | 'tutorial';

interface BlogGeneratorOptions {
  since: string;
  focus: FocusType;
  file?: string;
  outputPath: string;
  includeCodeSnippets: boolean;
  tone: ToneType;
}

const DEFAULT_SINCE = '2 weeks ago';
const DEFAULT_FOCUS: FocusType = 'all';
const DEFAULT_OUTPUT = './blog-post-draft.md';
const DEFAULT_TONE: ToneType = 'technical';

function printHelp(): void {
  console.log(`
✍️  Tech Blog Post Generator

Transforms your recent code changes into compelling technical blog posts!

Usage:
  bun run agents/tech-blog-post-generator.ts [options]

Options:
  --since <time>         Time range to analyze (default: "${DEFAULT_SINCE}")
  --focus <type>         Focus area: all|performance|architecture|bugfix|feature (default: ${DEFAULT_FOCUS})
  --file <path>          Focus on a specific file's changes
  --output <path>        Output file path (default: ${DEFAULT_OUTPUT})
  --tone <style>         Writing tone: technical|casual|tutorial (default: ${DEFAULT_TONE})
  --no-code              Exclude code snippets from the post
  --help, -h             Show this help message

Examples:
  # Generate a post from recent changes
  bun run agents/tech-blog-post-generator.ts

  # Focus on performance improvements
  bun run agents/tech-blog-post-generator.ts --focus performance --since "1 month ago"

  # Create a tutorial-style post about a specific file
  bun run agents/tech-blog-post-generator.ts --file src/api/auth.ts --tone tutorial

  # Generate a casual post about bug fixes
  bun run agents/tech-blog-post-generator.ts --focus bugfix --tone casual

  # Custom output location
  bun run agents/tech-blog-post-generator.ts --output posts/my-new-post.md
  `);
}

function parseOptions(): BlogGeneratorOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawSince = values.since;
  const rawFocus = values.focus;
  const rawFile = values.file;
  const rawOutput = values.output;
  const rawTone = values.tone;
  const noCode = values["no-code"] === true || values.noCode === true;

  const since = typeof rawSince === "string" && rawSince.length > 0
    ? rawSince
    : DEFAULT_SINCE;

  const focus = typeof rawFocus === "string" && rawFocus.length > 0
    ? (rawFocus as FocusType)
    : DEFAULT_FOCUS;

  if (!(['all', 'performance', 'architecture', 'bugfix', 'feature'] as const).includes(focus)) {
    console.error("❌ Error: Invalid focus type. Must be all, performance, architecture, bugfix, or feature");
    process.exit(1);
  }

  const file = typeof rawFile === "string" && rawFile.length > 0
    ? resolve(rawFile)
    : undefined;

  const outputPath = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : DEFAULT_OUTPUT;

  const tone = typeof rawTone === "string" && rawTone.length > 0
    ? (rawTone as ToneType)
    : DEFAULT_TONE;

  if (!(['technical', 'casual', 'tutorial'] as const).includes(tone)) {
    console.error("❌ Error: Invalid tone. Must be technical, casual, or tutorial");
    process.exit(1);
  }

  return {
    since,
    focus,
    file,
    outputPath,
    includeCodeSnippets: !noCode,
    tone,
  };
}

function buildPrompt(options: BlogGeneratorOptions): string {
  const {
    since,
    focus,
    file,
    outputPath,
    includeCodeSnippets,
    tone,
  } = options;

  const focusDescription =
    focus === 'performance' ? 'performance optimizations and improvements' :
    focus === 'architecture' ? 'architectural decisions and design patterns' :
    focus === 'bugfix' ? 'interesting bug fixes and debugging stories' :
    focus === 'feature' ? 'new feature implementations' :
    'interesting technical problems';

  const toneDescription =
    tone === 'casual' ? 'casual and approachable, like talking to a fellow developer over coffee' :
    tone === 'tutorial' ? 'educational and step-by-step, perfect for teaching others' :
    'professional yet engaging, suitable for tech blogs and Medium';

  return `You are a Tech Blog Post Generator. Your mission is to analyze recent code changes and craft a compelling technical blog post that showcases the developer's problem-solving skills and helps build their personal brand.

## Your Task

Generate a complete blog post draft about ${focusDescription} from recent commits and code changes. This blog post should be engaging, insightful, and valuable to other developers.

### Phase 1: Discovery & Analysis
1. Use Bash to analyze recent git activity:
   - Get recent commits: \`git log --since="${since}" --pretty=format:"%h|%an|%ad|%s|%b" --date=short\`
   - Find most changed files: \`git log --since="${since}" --name-only --pretty=format: | sort | uniq -c | sort -rn | head -15\`
   - Get detailed diff statistics: \`git log --since="${since}" --stat --pretty=format:"%h %s"\`
   ${file ? `- Get specific file history: \`git log --since="${since}" -p -- "${file}"\`` : ''}
   ${focus === 'performance' ? '- Look for commits mentioning: performance, optimize, faster, speed, cache, efficient' : ''}
   ${focus === 'architecture' ? '- Look for commits mentioning: refactor, architecture, design, pattern, structure, redesign' : ''}
   ${focus === 'bugfix' ? '- Look for commits mentioning: fix, bug, issue, debug, resolve, patch' : ''}
   ${focus === 'feature' ? '- Look for commits mentioning: add, implement, feature, new, create' : ''}

2. Identify the most interesting story:
   - What was the most challenging or interesting problem solved?
   - What unique approach or insight was used?
   - What would other developers find valuable to learn about?
   - What demonstrates technical growth or expertise?

3. Gather context:
   - Use Read to examine the relevant code files
   - Use Grep to find related code patterns
   - Understand the "before" and "after" state
   - Identify why this problem mattered (user impact, performance, maintainability, etc.)

### Phase 2: Blog Post Structure
Create a complete blog post with these sections:

#### 1. Catchy Title
Generate 3-5 title options that are:
- Intriguing and specific (not generic)
- Promise value to the reader
- Use numbers or questions when appropriate
- Examples: "How We Reduced API Response Time by 80% with This Simple Trick" or "The Bug That Taught Me Everything About Async JavaScript"

#### 2. Hook/Introduction (2-3 paragraphs)
- Start with a relatable scenario or problem statement
- Explain why this matters to other developers
- Preview the insights they'll gain
- Make it personal and engaging

#### 3. The Problem (2-4 paragraphs)
- Describe the specific challenge faced
- Include context: what was happening, why it was problematic
- Show the impact (performance metrics, user complaints, team friction, etc.)
- Make it relatable - other devs should think "I've faced this too!"

#### 4. The Journey/Attempts (2-3 paragraphs)
- Describe the investigation process
- What approaches were tried first?
- What didn't work and why?
- This section shows your problem-solving process

#### 5. The Solution (3-5 paragraphs)
- Explain the approach that worked
- Break down the key insights or "aha!" moments
${includeCodeSnippets ? '- Include 2-3 well-commented code snippets showing the solution' : ''}
- Explain WHY it works, not just WHAT it does
- Compare before/after (performance numbers, code clarity, etc.)

${includeCodeSnippets ? `
#### Code Snippet Guidelines:
- Keep snippets short (10-20 lines max)
- Add inline comments explaining key parts
- Show before/after comparisons when possible
- Use syntax: \`\`\`typescript or \`\`\`javascript
- Include context comments above the code
` : ''}

#### 6. Key Takeaways (3-5 bullet points)
- What are the main lessons learned?
- What can other developers apply to their own work?
- What would you do differently next time?
- What general principles does this illustrate?

#### 7. Conclusion (1-2 paragraphs)
- Summarize the journey
- Encourage readers to try the approach
- Invite discussion and questions
- End with a forward-looking statement

#### 8. Social Media Hooks (3 options)
Generate 3 tweet-sized hooks (280 chars) that could promote this post:
- One focusing on the problem
- One focusing on the solution
- One focusing on the learning/outcome

### Phase 3: Writing Guidelines
- Tone: ${toneDescription}
- Use "I" and "we" to make it personal
- Break up text with subheadings
- Use specific numbers and metrics when available
- Be honest about challenges and failures
- Make it scannable (bullet points, short paragraphs, code blocks)
- Include relatable developer humor where appropriate
- Focus on teaching and sharing insights, not just describing what you did

### Phase 4: Output
- Use the Write tool to create the blog post at: ${outputPath}
- Format in markdown with proper headings
- Include metadata at the top: suggested title, tags, estimated reading time
- Add a note about what technologies/tools were used
- Suggest related topics for future posts

## Important Notes
- This is a DRAFT - the developer will edit and personalize it
- Focus on making it valuable to other developers
- Balance technical depth with readability
- Include enough detail to be useful, but not overwhelming
- Make it engaging - this should be fun to read!

Start by analyzing the git history to find the best story to tell.`.trim();
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["since", "focus", "file", "output", "tone", "no-code", "noCode", "help", "h"] as const;

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

console.log('✍️  Tech Blog Post Generator\n');
console.log(`Time Range: Since ${options.since}`);
console.log(`Focus: ${options.focus}`);
if (options.file) console.log(`File: ${options.file}`);
console.log(`Output: ${options.outputPath}`);
console.log('');

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  'Bash',
  'Read',
  'Glob',
  'Grep',
  'Write',
  'TodoWrite',
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: 'claude-sonnet-4-5-20250929',
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(' '),
  'permission-mode': 'acceptEdits',
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log('\n✨ Blog Post Draft Generated!\n');
    console.log(`📝 Your blog post draft is ready at: ${options.outputPath}`);
    console.log('\n💡 Next Steps:');
    console.log('   1. Read and personalize the draft');
    console.log('   2. Add your own voice and experiences');
    console.log('   3. Include screenshots or diagrams if helpful');
    console.log('   4. Publish to your blog, Medium, Dev.to, or LinkedIn!');
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}