#!/usr/bin/env bun

/**
 * Quick JSDoc Generator Agent
 *
 * A lightning-fast micro-agent that generates documentation comments in seconds:
 * - Takes a single function or class as input
 * - Generates proper JSDoc/TSDoc comments
 * - Automatically infers parameter types and return types from TypeScript
 * - Adds @param, @returns, @throws tags with sensible defaults
 * - Respects existing project documentation style
 * - Completes in under 5 seconds for instant productivity boost
 *
 * Usage:
 *   bun run agents/quick-jsdoc-generator.ts <file-path> [function-name]
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface JSDocOptions {
  filePath: string;
  targetName?: string;
  style?: 'jsdoc' | 'tsdoc';
  includeExamples?: boolean;
}

async function generateJSDoc(options: JSDocOptions) {
  const { filePath, targetName, style = 'tsdoc', includeExamples = false } = options;

  console.log('📝 Quick JSDoc Generator\n');
  console.log(`File: ${filePath}`);
  if (targetName) {
    console.log(`Target: ${targetName}`);
  }
  console.log(`Style: ${style}\n`);

  const prompt = targetName
    ? `
Generate ${style.toUpperCase()} documentation comments for the function or class named "${targetName}" in the file "${filePath}".

Your task:
1. Read the file and locate the target function/class
2. Analyze its signature, parameters, return type, and implementation
3. Generate a concise but complete documentation comment with:
   - Clear description of what it does
   - @param tags for each parameter with type and description
   - @returns tag with return type and description
   - @throws tag if the function can throw errors
   ${includeExamples ? '- @example tag with a usage example' : ''}
4. Use the Edit tool to insert the documentation comment right before the function/class declaration
5. Preserve existing indentation and code style

Requirements:
- Use ${style === 'tsdoc' ? 'TSDoc' : 'JSDoc'} format
- Keep descriptions concise but informative
- Infer types from TypeScript annotations when available
- If the function already has documentation, enhance it rather than replace it
- Complete this task in ONE edit operation

Do not modify the function/class code itself, only add/update the documentation comment.
`.trim()
    : `
Generate ${style.toUpperCase()} documentation comments for ALL exported functions and classes in the file "${filePath}".

Your task:
1. Read the file and identify all exported functions, methods, and classes
2. For each one, analyze its signature and implementation
3. Generate documentation comments with:
   - Clear description
   - @param tags for parameters
   - @returns tag for return values
   - @throws tag if applicable
   ${includeExamples ? '- @example tag with usage example' : ''}
4. Use the Edit tool to add documentation to each function/class
5. Preserve existing indentation and code style

Requirements:
- Use ${style === 'tsdoc' ? 'TSDoc' : 'JSDoc'} format
- Process functions in order from top to bottom
- Skip functions that already have complete documentation
- Make minimal edits - only add documentation comments

Do not modify any function/class code, only add documentation comments.
`.trim();

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      // Only allow necessary tools for speed
      allowedTools: ['Read', 'Edit', 'TodoWrite'],
      // Auto-accept edits to speed things up
      permissionMode: 'acceptEdits',
      // Use Haiku for maximum speed
      model: 'claude-haiku-4-5-20250903',
      // Limit thinking tokens for speed
      maxThinkingTokens: 4000,
      // Limit turns for quick completion
      maxTurns: 5,
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse' && input.tool_name === 'Edit') {
                  const toolInput = input.tool_input as any;
                  console.log(`✍️  Adding documentation to ${toolInput.file_path}`);
                }
                return { continue: true };
              },
            ],
          },
        ],
        PostToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PostToolUse' && input.tool_name === 'Edit') {
                  console.log(`✅ Documentation added successfully`);
                }
                return { continue: true };
              },
            ],
          },
        ],
      },
    },
  });

  let startTime = Date.now();

  // Stream results
  for await (const message of result) {
    if (message.type === 'assistant') {
      const textContent = message.message.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        // Show brief progress updates
        const text = textContent.text;
        if (text.includes('Reading') || text.includes('Analyzing') || text.includes('Generating')) {
          console.log(`💭 ${text.substring(0, 80)}...`);
        }
      }
    } else if (message.type === 'result') {
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

      if (message.subtype === 'success') {
        console.log('\n' + '='.repeat(50));
        console.log('✨ Documentation Generated!');
        console.log('='.repeat(50));
        console.log(`⚡ Completed in ${elapsedTime}s`);
        console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(
          `📊 Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`
        );

        if (message.usage.cache_read_input_tokens) {
          console.log(`🚀 Cache hits: ${message.usage.cache_read_input_tokens} tokens`);
        }
      } else {
        console.error('\n❌ Error:', message.subtype);
      }
    }
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
📝 Quick JSDoc Generator

Generates documentation comments in seconds!

Usage:
  bun run agents/quick-jsdoc-generator.ts <file-path> [function-name] [options]

Arguments:
  file-path              Path to the source file
  function-name          Optional: specific function or class to document

Options:
  --style <type>         Documentation style (jsdoc|tsdoc, default: tsdoc)
  --examples             Include @example tags
  --help                 Show this help message

Examples:
  # Document a specific function
  bun run agents/quick-jsdoc-generator.ts src/utils.ts calculateSum

  # Document all exports in a file
  bun run agents/quick-jsdoc-generator.ts src/api.ts

  # Use JSDoc style with examples
  bun run agents/quick-jsdoc-generator.ts src/helpers.ts --style jsdoc --examples
  `);
  process.exit(0);
}

const filePath = args[0];

if (!filePath) {
  console.error('❌ Error: File path is required');
  process.exit(1);
}

// Parse options
const options: JSDocOptions = {
  filePath,
  style: 'tsdoc',
  includeExamples: false,
};

let i = 1;
// Check if second arg is a target name (not a flag)
const possibleTarget = args[i];
if (possibleTarget && !possibleTarget.startsWith('--')) {
  options.targetName = possibleTarget;
  i++;
}

// Parse remaining flags
for (; i < args.length; i++) {
  switch (args[i]) {
    case '--style':
      const styleValue = args[++i];
      if (styleValue) {
        options.style = styleValue as 'jsdoc' | 'tsdoc';
      }
      break;
    case '--examples':
      options.includeExamples = true;
      break;
  }
}

// Run the generator
generateJSDoc(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});