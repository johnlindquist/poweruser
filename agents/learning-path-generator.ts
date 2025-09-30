#!/usr/bin/env bun

/**
 * Learning Path Generator Agent
 *
 * This agent creates personalized, progressive learning paths for understanding complex codebases.
 * It helps developers learn a new codebase by creating structured tutorials that start from
 * user-facing features and progressively reveal implementation layers.
 *
 * Features:
 * - Generates step-by-step tutorials with annotated code examples
 * - Identifies core concepts, design patterns, and architectural principles
 * - Creates dependency graphs showing how components relate
 * - Adapts explanations based on developer experience level
 * - Produces interactive "code tours" with checkpoints and quizzes
 *
 * Usage:
 *   bun run agents/learning-path-generator.ts <path-to-codebase> [options]
 *
 * Options:
 *   --feature <name>        Start from a specific feature/component
 *   --level <beginner|intermediate|advanced>  Developer experience level
 *   --output <path>         Output directory for tutorials (default: ./learning-paths)
 *   --format <markdown|html|json>  Output format (default: markdown)
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { resolve } from 'path';

interface LearningPathOptions {
  codebasePath: string;
  feature?: string;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  outputDir: string;
  outputFormat: 'markdown' | 'html' | 'json';
}

async function generateLearningPath(options: LearningPathOptions) {
  const {
    codebasePath,
    feature,
    experienceLevel,
    outputDir,
    outputFormat,
  } = options;

  console.log('📚 Starting Learning Path Generator...\n');
  console.log(`Codebase: ${codebasePath}`);
  if (feature) console.log(`Feature Focus: ${feature}`);
  console.log(`Experience Level: ${experienceLevel}`);
  console.log(`Output Directory: ${outputDir}`);
  console.log(`Output Format: ${outputFormat}\n`);

  const prompt = `
You are an expert technical educator specializing in helping developers understand complex codebases.

Your mission: Create a comprehensive, progressive learning path for the codebase at "${codebasePath}".

## Context
- Experience Level: ${experienceLevel}
- ${feature ? `Focus on the "${feature}" feature/component` : 'Provide a general overview of the entire codebase'}
- Output Directory: ${outputDir}
- Format: ${outputFormat}

## Your Task

Create a structured learning path by following these steps:

### Phase 1: Discovery & Mapping
1. Use Glob and Grep to analyze the codebase structure:
   - Identify entry points (main files, routes, CLI commands)
   - Map out the project's directory structure
   - Find configuration files and understand the tech stack
   - Locate test files to understand intended behavior

2. Create a high-level architecture overview:
   - Identify main components/modules
   - Understand data flow patterns
   - Recognize design patterns in use
   - Document key dependencies

### Phase 2: Learning Path Design
Create a progressive learning path with these checkpoints:

**Level 1: User-Facing Layer**
- Start with what users see/interact with
- Explain the user journey through the code
- Show entry points and request/response flow
${experienceLevel === 'beginner' ? '- Include basic programming concepts explanations' : ''}

**Level 2: Business Logic Layer**
- Explain core business rules and algorithms
- Show how data is processed and transformed
- Identify service classes and their responsibilities
${experienceLevel === 'advanced' ? '- Analyze architectural trade-offs and design decisions' : ''}

**Level 3: Data & Infrastructure Layer**
- Explain data models and schemas
- Show database interactions or state management
- Cover external service integrations
${experienceLevel === 'advanced' ? '- Discuss scalability and performance considerations' : ''}

### Phase 3: Tutorial Generation
For each level, create tutorial documents with:

1. **Overview Section**: Summarize what will be learned
2. **Key Concepts**: Define important terms and patterns
3. **Code Walkthrough**:
   - Use Read to extract relevant code snippets
   - Add line-by-line annotations explaining complex parts
   - Show how different files connect together
4. **Hands-On Exercise**:
   - Suggest a small modification to try
   - Explain expected outcomes
5. **Quiz/Checkpoint**:
   - 3-5 questions to verify understanding
   - Include answers with explanations
6. **Next Steps**: Preview what comes next

### Phase 4: Reference Materials
Create supplementary materials:
- **Glossary**: Define key terms and concepts
- **Component Index**: Quick reference of main components
- **Dependency Graph**: Visual representation of how components relate
- **Common Patterns**: Document recurring patterns with examples
- **Troubleshooting Guide**: Common issues and solutions

### Phase 5: Output Generation
Use Write to create tutorial files in the output directory:
- Create index file listing all tutorials in order
- Generate one file per learning checkpoint
- Include a README with instructions on how to use the learning path
- Add metadata for tracking progress

## Guidelines
${experienceLevel === 'beginner' ? `
- Avoid jargon; explain technical terms
- Include analogies and real-world comparisons
- Break down complex concepts into simple steps
- Provide context for "why" things are done a certain way
` : ''}
${experienceLevel === 'intermediate' ? `
- Assume familiarity with common patterns
- Focus on project-specific implementations
- Explain trade-offs and alternatives
- Connect concepts to similar patterns in other projects
` : ''}
${experienceLevel === 'advanced' ? `
- Focus on architectural insights and design rationale
- Analyze performance implications
- Discuss scalability and maintainability
- Compare with alternative approaches
- Highlight advanced patterns and techniques
` : ''}

## Use TodoWrite throughout to track your progress:
- Mark each phase as you complete it
- Track individual tutorial generation
- Show progress on reference materials

Start by analyzing the codebase structure, then progressively build out the learning path.
`;

  console.log('🤖 Invoking Claude Agent...\n');

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd: resolve(codebasePath),
        permissionMode: 'acceptEdits',
        includePartialMessages: false,
      },
    })) {
      if (message.type === 'assistant') {
        const content = message.message.content;
        for (const block of content) {
          if (block.type === 'text') {
            console.log(block.text);
          }
        }
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          console.log('\n✅ Learning path generated successfully!');
          console.log(`\nSummary:`);
          console.log(`- Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
          console.log(`- Turns: ${message.num_turns}`);
          console.log(`- Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`- Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);
          console.log(`\n📂 Check ${outputDir} for your learning path materials!`);
        } else {
          console.error('\n❌ Failed to generate learning path');
          if (message.subtype === 'error_max_turns') {
            console.error('Error: Maximum turns reached');
          }
        }
      }
    }
  } catch (error) {
    console.error('\n❌ Error during learning path generation:', error);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Learning Path Generator Agent

Usage: bun run agents/learning-path-generator.ts <path-to-codebase> [options]

Arguments:
  <path-to-codebase>        Path to the codebase to analyze (required)

Options:
  --feature <name>          Start from a specific feature/component
  --level <level>           Developer experience level: beginner, intermediate, or advanced (default: intermediate)
  --output <path>           Output directory for tutorials (default: ./learning-paths)
  --format <format>         Output format: markdown, html, or json (default: markdown)
  --help, -h               Show this help message

Examples:
  bun run agents/learning-path-generator.ts ./my-project
  bun run agents/learning-path-generator.ts ./my-project --level beginner --feature authentication
  bun run agents/learning-path-generator.ts ./my-project --output ./docs/tutorials --format html
`);
    process.exit(0);
  }

  const codebasePath = args[0];

  if (!codebasePath) {
    console.error('Error: Codebase path is required');
    process.exit(1);
  }

  let feature: string | undefined;
  let experienceLevel: 'beginner' | 'intermediate' | 'advanced' = 'intermediate';
  let outputDir = './learning-paths';
  let outputFormat: 'markdown' | 'html' | 'json' = 'markdown';

  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    if (!value) {
      console.error(`Missing value for option: ${flag}`);
      process.exit(1);
    }

    switch (flag) {
      case '--feature':
        feature = value;
        break;
      case '--level':
        if (value !== 'beginner' && value !== 'intermediate' && value !== 'advanced') {
          console.error(`Invalid level: ${value}. Must be beginner, intermediate, or advanced.`);
          process.exit(1);
        }
        experienceLevel = value;
        break;
      case '--output':
        outputDir = value;
        break;
      case '--format':
        if (value !== 'markdown' && value !== 'html' && value !== 'json') {
          console.error(`Invalid format: ${value}. Must be markdown, html, or json.`);
          process.exit(1);
        }
        outputFormat = value;
        break;
      default:
        console.error(`Unknown option: ${flag}`);
        process.exit(1);
    }
  }

  return {
    codebasePath,
    feature,
    experienceLevel,
    outputDir,
    outputFormat,
  };
}

// Main execution
const options = parseArgs();
generateLearningPath(options);