#!/usr/bin/env bun

/**
 * Dream Feature Mapper Agent
 *
 * An agent that transforms dream features into actionable implementation roadmaps:
 * - Takes a feature description in plain English
 * - Analyzes existing codebase architecture, patterns, and tech stack
 * - Identifies reusable components and patterns
 * - Suggests new patterns and libraries needed
 * - Creates detailed step-by-step implementation roadmap
 * - Recommends trade-offs between technical approaches
 * - Generates starter code snippets matching your code style
 *
 * Usage:
 *   bun run agents/dream-feature-mapper.ts "real-time collaborative editing"
 *   bun run agents/dream-feature-mapper.ts "user authentication with OAuth" --output roadmap.md
 *   bun run agents/dream-feature-mapper.ts "dark mode support" --complexity detailed
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface MapperOptions {
  featureDescription: string;
  outputPath?: string;
  complexityLevel?: 'quick' | 'detailed' | 'comprehensive';
  includeStarterCode?: boolean;
  focusDirectory?: string;
}

async function runDreamFeatureMapper(options: MapperOptions) {
  const {
    featureDescription,
    outputPath = './FEATURE_ROADMAP.md',
    complexityLevel = 'detailed',
    includeStarterCode = true,
    focusDirectory,
  } = options;

  console.log('🗺️  Dream Feature Mapper Agent\n');
  console.log(`Feature: "${featureDescription}"`);
  console.log(`Complexity: ${complexityLevel}`);
  console.log(`Output: ${outputPath}\n`);

  const focusScope = focusDirectory
    ? `focusing primarily on the "${focusDirectory}" directory`
    : 'analyzing the entire codebase';

  const prompt = `You are a Dream Feature Mapper. Your mission is to transform a developer's dream feature idea into a concrete, actionable implementation roadmap.

## The Dream Feature
"${featureDescription}"

## Your Task

Create a comprehensive implementation roadmap that turns this dream into reality, ${focusScope}.

### Phase 1: Codebase Analysis & Discovery

1. Understand the project structure:
   - Use Glob to discover key files and directories: \`**/*.{ts,tsx,js,jsx,py,go,java}\`
   - Use Read to check package.json, pyproject.toml, go.mod, or similar for tech stack
   - Identify the primary language and framework being used

2. Analyze existing architecture and patterns:
   ${focusDirectory ? `- Focus heavily on: ${focusDirectory}` : '- Scan the main source directories'}
   - Use Grep to find similar existing features or patterns: \`pattern: "class|function|interface"\`
   - Identify state management approach (Redux, Context, Vuex, etc.)
   - Find API/backend integration patterns
   - Discover component/module organization conventions
   - Identify testing patterns and frameworks

3. Discover reusable components and utilities:
   - Use Grep to find components, hooks, utilities that might be relevant
   - Look for existing authentication, data fetching, or UI patterns
   - Identify shared types, interfaces, or schemas
   - Find configuration files and environment setups

### Phase 2: Implementation Planning

Based on your analysis, create a detailed roadmap with these sections:

#### 🎯 Feature Overview
- Clarify what the feature will do (1-2 paragraphs)
- Identify the primary user benefit
- Estimate overall complexity: Low/Medium/High

#### 🏗️ Architecture Assessment
- **Tech Stack Compatibility**: How well does this feature fit the existing stack?
- **Existing Assets**: What components/patterns can be reused? (List with file paths)
- **New Patterns Needed**: What new patterns or abstractions will be required?
- **Dependencies Required**: What new libraries/packages should be added?

#### 📚 Recommended Approach
Present 2-3 possible technical approaches:

**Approach 1: [Name, e.g., "WebSocket-based Real-time"]**
- How it works (brief description)
- Pros: What makes this approach good
- Cons: What are the trade-offs
- Complexity: Low/Medium/High
- Estimated time: X days/weeks

**Approach 2: [Alternative approach]**
- (Same structure as above)

**Recommendation**: Which approach and why?

#### 🛠️ Implementation Roadmap

Break down implementation into phases with concrete steps:

**Phase 1: Foundation (Estimated: X hours)**
1. [Specific task with file paths where applicable]
   - Why: Brief rationale
   - Files to modify: src/...
   - Dependencies: Any new packages needed

2. [Next task]
   - Why: ...
   - Files: ...

**Phase 2: Core Feature (Estimated: X hours)**
[Continue similar structure]

**Phase 3: Integration & Polish (Estimated: X hours)**
[Continue similar structure]

#### ⚠️ Key Considerations
- **Data Flow**: How will data move through the system?
- **State Management**: Where will state live and how will it update?
- **Error Handling**: What could go wrong and how to handle it?
- **Testing Strategy**: What types of tests are needed?
- **Performance Impact**: What are potential bottlenecks?
- **Security Considerations**: Any security implications?

#### 🔌 Integration Points
Identify where this feature connects to existing code:
- Entry points (which files to start modifying)
- API endpoints (existing or new)
- Database/storage changes
- UI components to create or modify

${includeStarterCode ? `
#### 💻 Starter Code Snippets

Generate 2-3 starter code snippets that match the project's coding style:

**Snippet 1: [e.g., "Core Feature Component"]**
\`\`\`typescript
// File: src/features/${featureDescription.toLowerCase().replace(/\s+/g, '-')}/FeatureComponent.tsx
// Based on patterns found in: [reference existing files]

[Generate actual starter code here that matches the codebase style]
\`\`\`

**Snippet 2: [e.g., "API Integration"]**
\`\`\`typescript
// File: src/api/${featureDescription.toLowerCase().replace(/\s+/g, '-')}.ts
[Generate actual code]
\`\`\`
` : ''}

#### 📋 Checklist Before Starting
- [ ] Review existing [relevant files] to understand patterns
- [ ] Install required dependencies: \`npm install ...\`
- [ ] Set up any necessary environment variables
- [ ] Create feature branch: \`git checkout -b feature/...\`
- [ ] Review this roadmap with team (if applicable)

#### 🚀 Next Steps
1. Start with Phase 1, Step 1
2. Test incrementally after each step
3. Commit frequently with descriptive messages
4. Update this roadmap if you discover better approaches

### Phase 3: Write the Roadmap
- Use the Write tool to create the roadmap file at: ${outputPath}
- Make it practical, specific, and actionable
- Include file paths, code examples, and concrete steps
- Reference actual files from the codebase where relevant

## Guidelines
- Be specific with file paths and concrete examples
- Prioritize reusing existing patterns and code
- Consider the developer's skill level - make it approachable
- Include both quick wins and longer-term considerations
- Estimate times realistically
- Highlight potential pitfalls
- Make the roadmap feel achievable and exciting

Start by analyzing the codebase structure and tech stack.`;

  const queryStream = query({
    prompt,
    options: {
      cwd: process.cwd(),
      model: 'claude-sonnet-4-5-20250929',
      permissionMode: 'acceptEdits',
      maxTurns: 40,

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
                  if (input.tool_name === 'Glob') {
                    console.log('🔍 Discovering project structure...');
                  } else if (input.tool_name === 'Grep') {
                    console.log('🔎 Analyzing code patterns...');
                  } else if (input.tool_name === 'Read') {
                    const filePath = (input.tool_input as any).file_path || '';
                    if (filePath.includes('package.json') || filePath.includes('tsconfig')) {
                      console.log('📦 Analyzing tech stack...');
                    }
                  } else if (input.tool_name === 'Write') {
                    console.log('📝 Generating implementation roadmap...');
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
                    console.log(`✅ Roadmap written to: ${filePath}`);
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
  let roadmapComplete = false;

  // Stream results
  for await (const message of queryStream) {
    switch (message.type) {
      case 'assistant':
        // Show key insights from assistant
        for (const block of message.message.content) {
          if (block.type === 'text') {
            const text = block.text;
            // Show important analysis points
            if (text.includes('Tech Stack:') || text.includes('Found:') || text.includes('Approach:')) {
              const snippet = text.length > 150 ? text.substring(0, 150) + '...' : text;
              console.log(`\n💭 ${snippet}`);
            }
          }
        }
        break;

      case 'result':
        roadmapComplete = true;
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n' + '='.repeat(60));
        if (message.subtype === 'success') {
          console.log('✨ Dream Feature Roadmap Complete!');
          console.log('='.repeat(60));
          console.log(`🗺️  Your implementation roadmap is ready at: ${outputPath}`);
          console.log(`\n📊 Statistics:`);
          console.log(`   Time: ${elapsedTime}s`);
          console.log(`   Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`   Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);

          if (message.usage.cache_read_input_tokens) {
            console.log(`   Cache hits: ${message.usage.cache_read_input_tokens} tokens`);
          }

          console.log('\n🚀 Next Step: Open the roadmap and start with Phase 1, Step 1!');
          console.log('💡 Tip: Adjust the roadmap as you learn more during implementation.');
        } else {
          console.log('❌ Error generating roadmap');
          console.log('='.repeat(60));
          console.log(`Error type: ${message.subtype}`);
        }
        break;

      case 'system':
        if (message.subtype === 'init') {
          console.log('🚀 Initializing Dream Feature Mapper...');
          console.log(`   Model: ${message.model}`);
          console.log(`   Working Directory: ${message.cwd}\n`);
        }
        break;
    }
  }

  if (!roadmapComplete) {
    console.log('\n⚠️  Roadmap generation was interrupted.');
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  console.log(`
🗺️  Dream Feature Mapper

Transforms your dream feature ideas into actionable implementation roadmaps!

Usage:
  bun run agents/dream-feature-mapper.ts "<feature description>" [options]

Arguments:
  <feature description>   Your dream feature in plain English (required)

Options:
  --output <path>        Output file path (default: ./FEATURE_ROADMAP.md)
  --complexity <level>   Detail level: quick|detailed|comprehensive (default: detailed)
  --no-code             Skip starter code generation
  --focus <directory>   Focus analysis on specific directory
  --help, -h            Show this help message

Examples:
  # Basic usage
  bun run agents/dream-feature-mapper.ts "real-time collaborative editing"

  # With custom output
  bun run agents/dream-feature-mapper.ts "user authentication with OAuth" --output docs/auth-roadmap.md

  # Quick overview without code
  bun run agents/dream-feature-mapper.ts "dark mode support" --complexity quick --no-code

  # Focus on specific part of codebase
  bun run agents/dream-feature-mapper.ts "export to PDF" --focus src/features/documents

  # Comprehensive analysis
  bun run agents/dream-feature-mapper.ts "AI-powered search" --complexity comprehensive
  `);
  process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
}

// Parse feature description (first non-flag argument)
let featureDescription = '';
const options: MapperOptions = {
  featureDescription: '',
  outputPath: './FEATURE_ROADMAP.md',
  complexityLevel: 'detailed',
  includeStarterCode: true,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (!arg) continue;

  if (arg.startsWith('--')) {
    switch (arg) {
      case '--output':
        options.outputPath = args[++i];
        break;
      case '--complexity':
        options.complexityLevel = args[++i] as 'quick' | 'detailed' | 'comprehensive';
        break;
      case '--no-code':
        options.includeStarterCode = false;
        break;
      case '--focus':
        options.focusDirectory = args[++i];
        break;
    }
  } else if (!featureDescription) {
    featureDescription = arg;
  }
}

if (!featureDescription) {
  console.error('❌ Error: Feature description is required\n');
  console.log('Example: bun run agents/dream-feature-mapper.ts "real-time notifications"');
  console.log('Run with --help for more information');
  process.exit(1);
} else {
  options.featureDescription = featureDescription;
}

// Run the mapper
runDreamFeatureMapper(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
