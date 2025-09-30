#!/usr/bin/env bun

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

import { query } from '@anthropic-ai/claude-agent-sdk';

interface BlogGeneratorOptions {
  since?: string;
  focus?: 'all' | 'performance' | 'architecture' | 'bugfix' | 'feature';
  file?: string;
  outputPath?: string;
  includeCodeSnippets?: boolean;
  tone?: 'technical' | 'casual' | 'tutorial';
}

async function runTechBlogPostGenerator(options: BlogGeneratorOptions) {
  const {
    since = '2 weeks ago',
    focus = 'all',
    file,
    outputPath = './blog-post-draft.md',
    includeCodeSnippets = true,
    tone = 'technical',
  } = options;

  console.log('✍️  Tech Blog Post Generator Agent\n');
  console.log(`Time Range: Since ${since}`);
  console.log(`Focus: ${focus}`);
  if (file) console.log(`File: ${file}`);
  console.log(`Output: ${outputPath}\n`);

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

  const prompt = `You are a Tech Blog Post Generator. Your mission is to analyze recent code changes and craft a compelling technical blog post that showcases the developer's problem-solving skills and helps build their personal brand.

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

Start by analyzing the git history to find the best story to tell.`;

  const queryStream = query({
    prompt,
    options: {
      cwd: process.cwd(),
      model: 'claude-sonnet-4-5-20250929',
      permissionMode: 'acceptEdits',
      maxTurns: 35,

      allowedTools: [
        'Bash',
        'Read',
        'Glob',
        'Grep',
        'Write',
        'TodoWrite'
      ],

      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  if (input.tool_name === 'Bash') {
                    const command = (input.tool_input as any).command || '';
                    if (command.includes('git log')) {
                      console.log('📊 Analyzing git history...');
                    } else if (command.includes('git diff')) {
                      console.log('🔍 Examining code changes...');
                    }
                  } else if (input.tool_name === 'Read') {
                    console.log('📖 Reading code files...');
                  } else if (input.tool_name === 'Write') {
                    console.log('✍️  Writing blog post draft...');
                  }
                }
                return { continue: true };
              }
            ]
          }
        ],

        PostToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PostToolUse') {
                  if (input.tool_name === 'Write') {
                    const filePath = (input.tool_input as any).file_path;
                    console.log(`✅ Blog post draft written to: ${filePath}`);
                  }
                }
                return { continue: true };
              }
            ]
          }
        ]
      }
    }
  });

  let startTime = Date.now();
  let postComplete = false;

  // Stream results
  for await (const message of queryStream) {
    switch (message.type) {
      case 'assistant':
        // Show assistant progress
        for (const block of message.message.content) {
          if (block.type === 'text') {
            const text = block.text;
            // Show interesting insights
            if (text.includes('Found:') || text.includes('Story:') || text.includes('Title:')) {
              console.log(`\n💭 ${text.substring(0, 150)}...`);
            }
          }
        }
        break;

      case 'result':
        postComplete = true;
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n' + '='.repeat(60));
        if (message.subtype === 'success') {
          console.log('✨ Blog Post Draft Generated!');
          console.log('='.repeat(60));
          console.log(`📝 Your blog post draft is ready at: ${outputPath}`);
          console.log(`\n📊 Statistics:`);
          console.log(`   Time: ${elapsedTime}s`);
          console.log(`   Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`   Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);

          if (message.usage.cache_read_input_tokens) {
            console.log(`   Cache hits: ${message.usage.cache_read_input_tokens} tokens`);
          }

          console.log('\n💡 Next Steps:');
          console.log('   1. Read and personalize the draft');
          console.log('   2. Add your own voice and experiences');
          console.log('   3. Include screenshots or diagrams if helpful');
          console.log('   4. Publish to your blog, Medium, Dev.to, or LinkedIn!');
        } else {
          console.log('❌ Error generating blog post');
          console.log('='.repeat(60));
          console.log(`Error type: ${message.subtype}`);
        }
        break;

      case 'system':
        if (message.subtype === 'init') {
          console.log('🚀 Initializing Tech Blog Post Generator...');
          console.log(`   Model: ${message.model}`);
          console.log(`   Working Directory: ${message.cwd}\n`);
        }
        break;
    }
  }

  if (!postComplete) {
    console.log('\n⚠️  Blog post generation was interrupted.');
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
✍️  Tech Blog Post Generator

Transforms your recent code changes into compelling technical blog posts!

Usage:
  bun run agents/tech-blog-post-generator.ts [options]

Options:
  --since <time>         Time range to analyze (default: "2 weeks ago")
  --focus <type>         Focus area: all|performance|architecture|bugfix|feature (default: all)
  --file <path>          Focus on a specific file's changes
  --output <path>        Output file path (default: ./blog-post-draft.md)
  --tone <style>         Writing tone: technical|casual|tutorial (default: technical)
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
  process.exit(0);
}

// Parse options
const options: BlogGeneratorOptions = {
  since: '2 weeks ago',
  focus: 'all',
  outputPath: './blog-post-draft.md',
  includeCodeSnippets: true,
  tone: 'technical',
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--since':
      options.since = args[++i];
      break;
    case '--focus':
      options.focus = args[++i] as 'all' | 'performance' | 'architecture' | 'bugfix' | 'feature';
      break;
    case '--file':
      options.file = args[++i];
      break;
    case '--output':
      options.outputPath = args[++i];
      break;
    case '--tone':
      options.tone = args[++i] as 'technical' | 'casual' | 'tutorial';
      break;
    case '--no-code':
      options.includeCodeSnippets = false;
      break;
  }
}

// Run the generator
runTechBlogPostGenerator(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});