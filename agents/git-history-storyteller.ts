#!/usr/bin/env bun

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
 *   bun run agents/git-history-storyteller.ts --module auth
 *   bun run agents/git-history-storyteller.ts --file src/api/users.ts
 *   bun run agents/git-history-storyteller.ts --since "6 months ago"
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface StorytellerOptions {
  focus?: 'full' | 'module' | 'file';
  target?: string;
  since?: string;
  outputFormat?: 'markdown' | 'html';
  outputPath?: string;
  includeTimeline?: boolean;
  includeArchitecture?: boolean;
}

async function runGitHistoryStoryteller(options: StorytellerOptions) {
  const {
    focus = 'full',
    target,
    since = '1 year ago',
    outputFormat = 'markdown',
    outputPath = './HISTORY.md',
    includeTimeline = true,
    includeArchitecture = true,
  } = options;

  console.log('📚 Git History Storyteller Agent\n');
  console.log(`Focus: ${focus}${target ? ` (${target})` : ''}`);
  console.log(`Time Range: Since ${since}`);
  console.log(`Output: ${outputPath}\n`);

  const focusDescription =
    focus === 'file' ? `the specific file: "${target}"` :
    focus === 'module' ? `the module/directory: "${target}"` :
    'the entire codebase';

  const prompt = `You are a Git History Storyteller. Your mission is to analyze the git history and create a compelling narrative documentation about the evolution of ${focusDescription}.

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

Start by gathering the git history data.`;

  const queryStream = query({
    prompt,
    options: {
      cwd: process.cwd(),
      model: 'claude-sonnet-4-5-20250929',
      permissionMode: 'acceptEdits', // Auto-accept file writes
      maxTurns: 30,

      // Only allow tools needed for git analysis and documentation
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
                      console.log('📜 Analyzing git history...');
                    } else if (command.includes('git tag')) {
                      console.log('🏷️  Identifying version tags...');
                    }
                  } else if (input.tool_name === 'Write') {
                    console.log('✍️  Writing history documentation...');
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
                    console.log(`✅ Documentation written to: ${filePath}`);
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
  let storyComplete = false;

  // Stream results
  for await (const message of queryStream) {
    switch (message.type) {
      case 'assistant':
        // Show assistant progress
        for (const block of message.message.content) {
          if (block.type === 'text') {
            // Show key parts of the assistant's thinking
            const text = block.text;
            if (text.includes('Analysis:') || text.includes('Story:') || text.includes('Found:')) {
              console.log(`\n💭 ${text.substring(0, 120)}...`);
            }
          }
        }
        break;

      case 'result':
        storyComplete = true;
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n' + '='.repeat(60));
        if (message.subtype === 'success') {
          console.log('✨ Git History Story Generated!');
          console.log('='.repeat(60));
          console.log(`📖 Your history documentation is ready at: ${outputPath}`);
          console.log(`\n📊 Statistics:`);
          console.log(`   Time: ${elapsedTime}s`);
          console.log(`   Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`   Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);

          if (message.usage.cache_read_input_tokens) {
            console.log(`   Cache hits: ${message.usage.cache_read_input_tokens} tokens`);
          }

          console.log('\n💡 Tip: Share this documentation with your team or include it in your onboarding materials!');
        } else {
          console.log('❌ Error generating history');
          console.log('='.repeat(60));
          console.log(`Error type: ${message.subtype}`);
        }
        break;

      case 'system':
        if (message.subtype === 'init') {
          console.log('🚀 Initializing Git History Storyteller...');
          console.log(`   Model: ${message.model}`);
          console.log(`   Working Directory: ${message.cwd}\n`);
        }
        break;
    }
  }

  if (!storyComplete) {
    console.log('\n⚠️  Story generation was interrupted.');
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
📚 Git History Storyteller

Generates narrative documentation from your git history!

Usage:
  bun run agents/git-history-storyteller.ts [options]

Options:
  --file <path>          Focus on a specific file's history
  --module <path>        Focus on a module/directory's history
  --since <time>         Time range (default: "1 year ago")
  --output <path>        Output file path (default: ./HISTORY.md)
  --format <type>        Output format: markdown|html (default: markdown)
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
  process.exit(0);
}

// Parse options
const options: StorytellerOptions = {
  focus: 'full',
  since: '1 year ago',
  outputFormat: 'markdown',
  outputPath: './HISTORY.md',
  includeTimeline: true,
  includeArchitecture: true,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--file':
      options.focus = 'file';
      options.target = args[++i];
      break;
    case '--module':
      options.focus = 'module';
      options.target = args[++i];
      break;
    case '--since':
      options.since = args[++i];
      break;
    case '--output':
      options.outputPath = args[++i];
      break;
    case '--format':
      options.outputFormat = args[++i] as 'markdown' | 'html';
      break;
    case '--no-timeline':
      options.includeTimeline = false;
      break;
    case '--no-architecture':
      options.includeArchitecture = false;
      break;
  }
}

// Validate focus options
if ((options.focus === 'file' || options.focus === 'module') && !options.target) {
  console.error(`❌ Error: --${options.focus} requires a target path\n`);
  console.log('Run with --help for usage information');
  process.exit(1);
}

// Run the storyteller
runGitHistoryStoryteller(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
