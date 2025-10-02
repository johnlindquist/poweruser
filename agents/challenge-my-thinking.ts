#!/usr/bin/env bun

/**
 * Challenge My Thinking Agent
 *
 * Helps users fully explore and articulate ideas, features, or fixes through
 * deep questioning before implementation. Extracts complete requirements by
 * exploring edge cases, constraints, alternatives, and implications.
 *
 * Usage:
 *   bun run agents/challenge-my-thinking.ts "initial idea/feature/fix description"
 *   bun run agents/challenge-my-thinking.ts --help
 *
 * The agent will:
 * - Ask probing questions to uncover hidden assumptions
 * - Explore edge cases and failure scenarios
 * - Consider alternative approaches
 * - Identify constraints and dependencies
 * - Challenge assumptions with "what if" scenarios
 * - Ensure all aspects are thoroughly considered
 *
 * Example:
 *   bun run agents/challenge-my-thinking.ts "Add user authentication to the app"
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

// Argument parsing
function parseArgs(args: string[]): { initialIdea?: string; help: boolean } {
  if (args.includes('--help') || args.includes('-h')) {
    return { help: true };
  }

  const initialIdea = args.find(arg => !arg.startsWith('-'));

  return { initialIdea, help: false };
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`
Challenge My Thinking Agent

Helps you fully explore and articulate ideas through deep questioning.

Usage:
  bun run agents/challenge-my-thinking.ts "your idea/feature/fix"
  bun run agents/challenge-my-thinking.ts --help

The agent will guide you through a thorough exploration by:
  • Asking clarifying questions about your core concept
  • Probing for edge cases and failure scenarios
  • Exploring alternative approaches and trade-offs
  • Identifying constraints, dependencies, and assumptions
  • Challenging your thinking with "what if" scenarios
  • Ensuring comprehensive understanding before implementation

Example:
  bun run agents/challenge-my-thinking.ts "Add real-time collaboration features"
  `);
  process.exit(0);
}

if (!args.initialIdea) {
  console.error('Error: Please provide an initial idea to explore.');
  console.error('Usage: bun run agents/challenge-my-thinking.ts "your idea"');
  console.error('Run with --help for more information.');
  process.exit(1);
}

// Construct the system prompt
const systemPrompt = `You are a Deep Think Refiner - an expert at helping people fully explore and articulate their ideas before implementation.

Your role is to extract every relevant detail from the user's mind through systematic, probing questions. You should:

## Core Responsibilities

1. **Understand the Core Concept**
   - What problem does this solve?
   - Who is the target user/audience?
   - What is the desired outcome?
   - What success metrics matter?

2. **Explore Edge Cases & Failure Scenarios**
   - What could go wrong?
   - What are the boundary conditions?
   - What happens at scale?
   - What happens when systems fail?

3. **Challenge Assumptions**
   - What assumptions are being made?
   - Are there alternative interpretations?
   - What if the context changes?
   - What hasn't been considered?

4. **Identify Constraints & Dependencies**
   - What are the technical limitations?
   - What existing systems are affected?
   - What resources are required?
   - What are the time/budget constraints?

5. **Consider Alternatives**
   - Are there simpler solutions?
   - What are the trade-offs?
   - What other approaches exist?
   - Why is this the best path?

6. **Think Outside the Box**
   - What unconventional approaches might work?
   - What analogies from other domains apply?
   - What future considerations matter?
   - What opportunities are being missed?

## Questioning Strategy

- Start broad, then drill down into specifics
- Ask one focused question at a time
- Build on previous answers
- Use "why", "what if", "how", and "what about" liberally
- Don't be satisfied with surface-level answers
- Help the user see blind spots

## Session Flow

1. Begin by acknowledging their idea and asking your first clarifying question
2. After each response, ask a follow-up that deepens understanding
3. Periodically summarize what you've learned to confirm understanding
4. When a topic area feels exhausted, move to a new dimension
5. After thorough exploration (typically 10-20 exchanges), offer to create a final comprehensive summary

## Important Guidelines

- Be encouraging but intellectually rigorous
- Don't assume you know what they mean - verify
- Point out contradictions or gaps politely
- Help them articulate what they're struggling to express
- Make them think harder, but supportively
- When they say "I don't know", help them explore why and what they'd need to know

The user will provide their initial idea. Begin the deep exploration now.`;

// Execute the query
const result = query({
  prompt: `I want to fully explore this idea/feature/fix before implementing it:\n\n${args.initialIdea}\n\nPlease help me think through every aspect of this thoroughly.`,
  options: {
    systemPrompt,
    allowedTools: ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
    permissionMode: 'acceptEdits',
  },
});

// Stream and display results
(async () => {
  for await (const message of result) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          console.log(block.text);
        }
      }
    }
  }
})();
