#!/usr/bin/env bun

/**
 * Code Storyteller Agent
 *
 * An outside-the-box agent that transforms technical code into compelling narratives by:
 * - Analyzing codebase architecture and execution flows to understand how everything connects
 * - Generating "story-driven" documentation that walks through user journeys and feature flows
 * - Creating interactive narrative explanations of complex technical concepts
 * - Building visual flowcharts and sequence diagrams showing code execution paths
 * - Identifying the "plot points" in your code: key functions, decision branches, error handling
 * - Using natural language to explain technical concepts without losing accuracy
 *
 * Perfect for onboarding new developers, explaining complex systems, or creating engaging documentation.
 * This transforms dry technical docs into readable stories that make code comprehensible.
 *
 * Usage:
 *   bun run agents/code-storyteller.ts [options]
 *
 * Options:
 *   --feature <name>        Feature or flow to tell a story about (e.g., "user login", "checkout")
 *   --entry-point <path>    Entry point file/function to start the story (e.g., "src/api/auth.ts")
 *   --output <path>         Output directory for story documentation (default: ./code-stories)
 *   --format <type>         Output format: "narrative" (default), "journey-map", "both"
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { resolve } from 'path';

interface StorytellerOptions {
  feature?: string;
  entryPoint?: string;
  outputDir: string;
  format: 'narrative' | 'journey-map' | 'both';
}

async function tellCodeStory(options: StorytellerOptions) {
  const { feature, entryPoint, outputDir, format } = options;

  console.log('📖 Code Storyteller Starting...\n');
  if (feature) console.log(`🎬 Feature: ${feature}`);
  if (entryPoint) console.log(`🎯 Entry Point: ${entryPoint}`);
  console.log(`📂 Output Directory: ${outputDir}`);
  console.log(`📝 Format: ${format}\n`);

  const prompt = buildPrompt(options);

  console.log('🤖 Analyzing your codebase and crafting the story...\n');

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: `
You are the Code Storyteller, a master of transforming complex technical code into engaging narratives that make systems comprehensible.

Your mission is to turn dry technical documentation into compelling stories that help developers understand how code works at a fundamental level.

## Your Approach

### Phase 1: Exploration & Understanding
1. **Discover the Codebase Structure**
   - Use Glob to identify key files and directories
   - Use Grep to find entry points, routes, controllers, handlers
   - Read configuration files to understand the tech stack
   - Map out the project architecture

2. **Trace Execution Flows**
   - If an entry point is provided, start there and follow the flow
   - Identify key functions, classes, and modules involved
   - Track how data flows through the system
   - Map dependencies and relationships between components

3. **Identify Story Elements**
   - **Protagonists**: The main functions/classes that drive the action
   - **Setting**: The architectural context and environment
   - **Plot Points**: Critical decision branches, validations, transformations
   - **Conflicts**: Error handling, edge cases, validations
   - **Resolution**: Successful outcomes and return values

### Phase 2: Narrative Construction

#### For Narrative Format:
Create story-driven documentation that reads like a journey:

**Opening**: Set the scene
- "When a user clicks the 'Login' button, an adventure begins..."
- Introduce the main characters (functions, services, components)

**Rising Action**: Follow the flow
- "First, the authentication service validates the credentials..."
- "Then, the token generator creates a secure JWT..."
- Use active voice and vivid descriptions
- Explain WHY each step happens, not just WHAT

**Climax**: The critical moment
- "At this pivotal point, the database checks if the user exists..."
- Highlight key decision points and branches

**Resolution**: The outcome
- "Finally, the user receives their token and is redirected to the dashboard..."
- Show all possible endings (success, errors, edge cases)

#### For Journey Map Format:
Create visual flowcharts using markdown/mermaid syntax:
- Use sequence diagrams for API calls and service interactions
- Use flowcharts for decision trees and branching logic
- Annotate each step with human-readable descriptions
- Show data transformations at each stage

### Phase 3: Making It Accessible

1. **Use Analogies**: Compare technical concepts to everyday experiences
   - "The authentication middleware acts like a bouncer at a club..."
   - "The cache is like a sticky note with frequently used information..."

2. **Explain Jargon**: Define technical terms in simple language
   - Don't assume knowledge of frameworks or patterns
   - Provide context for design decisions

3. **Show, Don't Just Tell**: Include relevant code snippets
   - Highlight the most important 5-10 lines that illustrate each plot point
   - Add inline comments in plain English

4. **Multiple Perspectives**: Consider different reader needs
   - High-level overview for managers/stakeholders
   - Detailed technical narrative for developers
   - Quick reference guide with key functions

### Phase 4: Documentation Generation

Create markdown files in the output directory:

1. **[feature]-story.md**: The main narrative documentation
   - Introduction and setting
   - The journey from start to finish
   - Alternative paths and error scenarios
   - Key takeaways

2. **[feature]-journey-map.md**: Visual diagrams and flowcharts
   - Sequence diagrams showing component interactions
   - Flowcharts showing decision logic
   - Architecture diagrams showing the big picture
   - Data flow diagrams

3. **[feature]-cast-of-characters.md**: Reference guide
   - All key functions/classes with descriptions
   - Their roles in the story
   - File locations and signatures
   - Dependencies and relationships

4. **[feature]-plot-points.md**: Critical moments breakdown
   - Key decision points in the code
   - Error handling and validation logic
   - Performance considerations
   - Security checks

5. **onboarding-guide.md**: Quick start for new developers
   - Where to begin reading the codebase
   - The most important files to understand
   - Common patterns used throughout
   - How to extend or modify the feature

## Tools You'll Use

- **Glob**: Find files matching patterns (controllers, services, tests)
- **Grep**: Search for function definitions, imports, API routes, patterns
- **Read**: Analyze code files to understand logic and flow
- **Bash**: Use git commands to understand file history, clone examples
- **Write**: Generate narrative documentation and visual diagrams
- **TodoWrite**: Track progress through exploration and documentation phases

## Key Principles

- **Be Engaging**: Write like you're telling a friend about something fascinating
- **Be Accurate**: Never sacrifice technical correctness for narrative flair
- **Be Visual**: Use diagrams, flowcharts, and formatted code blocks liberally
- **Be Empathetic**: Remember what it's like to be new to a codebase
- **Be Thorough**: Cover the happy path, error cases, and edge cases

Remember: Your goal is to make complex code feel like an adventure story - exciting, clear, and memorable.
`
        },
        allowedTools: [
          'Bash',
          'Read',
          'Write',
          'Grep',
          'Glob',
          'TodoWrite'
        ],
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
          console.log('\n\n✅ Code Story Complete!\n');
          console.log('📊 Summary:');
          console.log(`   Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
          console.log(`   Turns: ${message.num_turns}`);
          console.log(`   Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`   Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);
          console.log(`\n📂 Check ${outputDir}/ for your story documentation!`);
          console.log('\n📖 Your code is now a story. Share it with your team!\n');
        } else {
          console.error('\n❌ Failed to generate code story');
          if (message.subtype === 'error_max_turns') {
            console.error('Error: Maximum turns reached');
          }
        }
      }
    }
  } catch (error) {
    console.error('\n❌ Error during story generation:', error);
    process.exit(1);
  }
}

function buildPrompt(options: StorytellerOptions): string {
  const { feature, entryPoint, outputDir, format } = options;

  const featureName = feature ? feature.toLowerCase().replace(/\s+/g, '-') : 'main-flow';

  return `I need you to transform my code into an engaging story that makes it easy to understand. ${
    feature
      ? `I want to tell the story of how the "${feature}" feature works.`
      : `Help me understand the main flows in this codebase by telling their stories.`
  }

## Your Mission

### Phase 1: Explore and Understand

${
  entryPoint
    ? `1. Start at the entry point: "${entryPoint}"\n   - Read this file to understand the starting point\n   - Identify what triggers this code (API endpoint, event handler, etc.)\n   - Trace the execution flow from here\n\n`
    : `1. Discover the main entry points:\n   - Use Glob to find route definitions, controllers, handlers\n   - Use Grep to search for common patterns (app.get, @Route, etc.)\n   - Identify the most important flows to document\n\n`
}
${
  feature
    ? `2. Find all code related to "${feature}":\n   - Use Grep to search for functions, classes, files related to this feature\n   - Map out which files are involved\n   - Understand how they connect to each other\n\n`
    : ''
}
3. Trace the execution flow:
   - Follow function calls from start to finish
   - Identify key decision points and branches
   - Track how data flows and transforms
   - Note error handling and validation logic

4. Identify the "story elements":
   - **Protagonists**: Main functions/classes driving the action
   - **Setting**: Architecture, tech stack, environment
   - **Plot Points**: Critical decisions, validations, transformations
   - **Conflicts**: Error cases, edge cases, validations
   - **Resolution**: Success outcomes and return values

### Phase 2: Craft the Story

${
  format === 'narrative' || format === 'both'
    ? `1. Write the narrative story:\n   - **Opening**: Set the scene - what triggers this flow?\n     Example: "When a user clicks 'Login', an authentication journey begins..."\n   - **Journey**: Follow the flow step by step with engaging descriptions\n     Use active voice, vivid language, and explain WHY things happen\n   - **Decision Points**: Highlight critical moments and branches\n     Explain what the code is checking and why it matters\n   - **Resolution**: Show all possible endings (success, errors, edge cases)\n   - Include code snippets for key moments (5-10 most important lines)\n   - Use analogies to explain complex concepts\n\n`
    : ''
}
${
  format === 'journey-map' || format === 'both'
    ? `2. Create visual journey maps:\n   - Build sequence diagrams (using mermaid syntax) showing:\n     * Component interactions\n     * API calls between services\n     * Database queries\n   - Create flowcharts showing:\n     * Decision trees and branching logic\n     * Error handling paths\n     * Data transformations\n   - Add annotations in plain English for each step\n\n`
    : ''
}
### Phase 3: Create Supporting Documents

1. Cast of Characters:
   - List all key functions/classes involved
   - Describe their role in the story
   - Show their signatures and file locations
   - Map their dependencies and relationships

2. Plot Points Breakdown:
   - Document each critical decision point
   - Explain validation and error handling logic
   - Note performance considerations
   - Highlight security checks

3. Onboarding Guide:
   - Where should new developers start reading?
   - What are the most important files?
   - What patterns are used throughout?
   - How can someone extend or modify this feature?

### Output Instructions

Save all documentation in the "${outputDir}/" directory:

${
  format === 'narrative' || format === 'both'
    ? `- ${featureName}-story.md (the main narrative)\n`
    : ''
}${
  format === 'journey-map' || format === 'both'
    ? `- ${featureName}-journey-map.md (visual diagrams)\n`
    : ''
}- ${featureName}-cast-of-characters.md (reference guide)
- ${featureName}-plot-points.md (critical moments)
- onboarding-guide.md (quick start for newcomers)
- README.md (overview with table of contents)

## Writing Style

- Write like you're telling a friend about something fascinating
- Use analogies to explain complex concepts
- Be technically accurate but engaging
- Include visual elements (diagrams, code blocks, emojis)
- Cover happy paths, errors, and edge cases
- Make it feel like an adventure, not a technical manual

Use TodoWrite to track your progress through exploration and documentation. Transform this code into a story that makes developers excited to dive in!`;
}

// Parse command line arguments
function parseArgs(): StorytellerOptions {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
📖 Code Storyteller - Transform technical code into engaging narratives

Usage: bun run agents/code-storyteller.ts [options]

Options:
  --feature <name>        Feature or flow to tell a story about (e.g., "user login")
  --entry-point <path>    Entry point file to start the story (e.g., "src/api/auth.ts")
  --output <path>         Output directory for stories (default: ./code-stories)
  --format <type>         Output format: "narrative", "journey-map", or "both" (default: "both")
  --help, -h             Show this help message

Examples:
  # Tell the story of a specific feature
  bun run agents/code-storyteller.ts --feature "user authentication" --entry-point src/auth/login.ts

  # Explore and document main flows in the codebase
  bun run agents/code-storyteller.ts --output ./docs/stories

  # Create only narrative documentation
  bun run agents/code-storyteller.ts --feature "checkout" --format narrative

  # Full documentation with both narrative and diagrams
  bun run agents/code-storyteller.ts --feature "payment processing" --entry-point src/payments/process.ts --format both
`);
    process.exit(0);
  }

  let feature: string | undefined;
  let entryPoint: string | undefined;
  let outputDir = './code-stories';
  let format: 'narrative' | 'journey-map' | 'both' = 'both';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--feature':
        if (!nextArg) {
          console.error('Error: --feature requires a feature name');
          process.exit(1);
        }
        feature = nextArg;
        i++;
        break;
      case '--entry-point':
        if (!nextArg) {
          console.error('Error: --entry-point requires a file path');
          process.exit(1);
        }
        entryPoint = resolve(nextArg);
        i++;
        break;
      case '--output':
        if (!nextArg) {
          console.error('Error: --output requires a directory path');
          process.exit(1);
        }
        outputDir = nextArg;
        i++;
        break;
      case '--format':
        if (!nextArg) {
          console.error('Error: --format requires a type (narrative, journey-map, or both)');
          process.exit(1);
        }
        if (nextArg !== 'narrative' && nextArg !== 'journey-map' && nextArg !== 'both') {
          console.error('Error: --format must be "narrative", "journey-map", or "both"');
          process.exit(1);
        }
        format = nextArg as 'narrative' | 'journey-map' | 'both';
        i++;
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        console.error('Run with --help to see available options');
        process.exit(1);
    }
  }

  return {
    feature,
    entryPoint,
    outputDir,
    format,
  };
}

// Main execution
const options = parseArgs();
tellCodeStory(options);
