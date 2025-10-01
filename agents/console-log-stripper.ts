#!/usr/bin/env bun

/**
 * Console Log Stripper Agent
 *
 * A lightning-fast agent that removes debugging console statements from your codebase:
 * - Finds and removes console.log, console.debug, console.info statements
 * - Intelligently preserves console.error, console.warn, and structured logging
 * - Handles multiple patterns: console.log(), logger.debug(), print()
 * - Skips node_modules and other excluded directories
 * - Supports dry-run mode to preview changes
 * - Generates summary report of removed statements
 * - Works across JavaScript, TypeScript, JSX, and TSX files
 * - Completes in seconds for instant gratification
 *
 * Usage:
 *   bun run agents/console-log-stripper.ts [options]
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface ConsoleLogStripperOptions {
  dryRun?: boolean;
  preserveComments?: boolean;
  targetDir?: string;
  excludeDirs?: string[];
  includePatterns?: string[];
  strict?: boolean;
}

async function stripConsoleLogs(options: ConsoleLogStripperOptions) {
  const {
    dryRun = false,
    preserveComments = false,
    targetDir = '.',
    excludeDirs = ['node_modules', 'dist', 'build', '.next', '.nuxt', 'coverage'],
    includePatterns = ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
    strict = false,
  } = options;

  console.log('🧹 Console Log Stripper\n');
  console.log(`Target directory: ${targetDir}`);
  console.log(`Dry run: ${dryRun ? '✅ (no changes will be made)' : '❌'}`);
  console.log(`Preserve comments: ${preserveComments ? '✅' : '❌'}`);
  console.log(`Strict mode: ${strict ? '✅' : '❌'}`);
  console.log(`Exclude directories: ${excludeDirs.join(', ')}`);
  console.log(`File patterns: ${includePatterns.join(', ')}\n`);

  const prompt = `
You are a console log stripper. Your task is to find and remove debugging console statements from the codebase while preserving important logging.

STEPS TO FOLLOW:

1. Search for console log statements to remove:
   - console.log()
   - console.debug()
   - console.info()
   - console.trace() (usually for debugging)

   Search patterns to use with Grep:
   - console\\.log\\(
   - console\\.debug\\(
   - console\\.info\\(
   - console\\.trace\\(

2. DO NOT remove these important logging statements:
   - console.error()
   - console.warn()
   - Any logging that appears to be error handling or important warnings
   - Structured logging libraries (winston, pino, bunyan, etc.)

3. For each file containing console statements:
   - Read the file to see the context
   - Identify which console.log/debug/info/trace calls are debugging clutter
   - Remove the entire statement including:
     * The console call line
     * Any multi-line arguments
     * Empty lines left behind (clean up formatting)
   ${preserveComments ? '- Preserve any comments explaining what was being logged' : '- Remove comments that only explained the console.log'}
   ${dryRun ? '- DO NOT actually edit files, just report what would be removed' : '- Use Edit tool to remove the statements'}

4. Handle edge cases:
   - Multi-line console.log with complex arguments
   - Chained console statements: console.log().log()
   - Console statements inside template literals or strings (leave these alone!)
   - Commented out console.log (can remove these too)
   - console.log in function names or variables (leave these alone!)

5. Generate a comprehensive report:
   - Total files scanned
   - Total console statements found
   - Number of statements to be removed (excluding preserved warnings/errors)
   - List of files modified with count of removals per file
   ${dryRun ? '- Preview of changes (show before/after snippets)' : '- Confirmation of successful removals'}
   - Any statements that were skipped with reasons

IMPORTANT RULES:
- Exclude directories: ${excludeDirs.join(', ')}
- Only process these file types: ${includePatterns.join(', ')}
- Be conservative: if unsure whether a console statement is important, KEEP it
- Focus on obvious debugging logs
${strict ? '- In strict mode, remove ALL console.log/debug/info/trace regardless of context' : '- Preserve logs that appear to be intentional/production logging'}
- Maintain code formatting and structure
- Don't break the code!

OUTPUT FORMAT:
1. Start with a progress update as you scan files
2. For each file, briefly report findings
3. ${dryRun ? 'Show preview of what would be changed' : 'Make the edits'}
4. End with a summary table:
   - Files scanned: X
   - Files with removable logs: X
   - Total statements removed: X
   - Time saved in future debugging: priceless 😊

Begin the console log cleanup now!
`.trim();

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      // Only allow necessary tools
      allowedTools: ['Read', 'Edit', 'Grep', 'Glob', 'TodoWrite'],
      // In dry-run mode, never allow edits
      permissionMode: dryRun ? 'plan' : 'acceptEdits',
      // Use Sonnet for balance of speed and capability
      model: 'claude-sonnet-4-5-20250929',
      // Limit thinking for speed
      maxThinkingTokens: 5000,
      // Should complete quickly
      maxTurns: 20,
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  if (input.tool_name === 'Grep') {
                    const toolInput = input.tool_input as any;
                    console.log(`🔍 Searching for: ${toolInput.pattern}`);
                  } else if (input.tool_name === 'Read') {
                    const toolInput = input.tool_input as any;
                    const fileName = toolInput.file_path.split('/').pop();
                    console.log(`📖 Reading ${fileName}`);
                  } else if (input.tool_name === 'Edit') {
                    const toolInput = input.tool_input as any;
                    const fileName = toolInput.file_path.split('/').pop();
                    console.log(`✂️  Removing console statement from ${fileName}`);
                  }
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
                if (input.hook_event_name === 'PostToolUse') {
                  if (input.tool_name === 'Edit') {
                    console.log(`   ✅ Removed successfully`);
                  } else if (input.tool_name === 'Grep') {
                    const toolResponse = input.tool_response as any;
                    if (toolResponse.files && toolResponse.files.length > 0) {
                      console.log(`   Found ${toolResponse.files.length} files with console statements`);
                    }
                  }
                }
                return { continue: true };
              },
            ],
          },
        ],
      },
    },
  });

  const startTime = Date.now();

  // Stream results
  for await (const message of result) {
    if (message.type === 'assistant') {
      const textContent = message.message.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        const text = textContent.text;
        // Show progress for key activities
        if (
          text.includes('Scanning') ||
          text.includes('Found') ||
          text.includes('Removing') ||
          text.includes('files')
        ) {
          console.log(`💭 ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`);
        }
      }
    } else if (message.type === 'result') {
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

      if (message.subtype === 'success') {
        console.log('\n' + '='.repeat(60));
        console.log(`📊 Console Log Stripper Report ${dryRun ? '(DRY RUN)' : ''}`);
        console.log('='.repeat(60));
        console.log('\n' + message.result);
        console.log('\n' + '='.repeat(60));
        console.log(`⚡ Completed in ${elapsedTime}s`);
        console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(
          `📊 Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`
        );

        if (message.usage.cache_read_input_tokens) {
          console.log(`🚀 Cache hits: ${message.usage.cache_read_input_tokens} tokens`);
        }

        if (!dryRun) {
          console.log('\n✨ Your codebase is now cleaner! Run your tests to verify everything works.');
        } else {
          console.log(
            '\n💡 This was a dry run. Remove --dry-run flag to apply changes.'
          );
        }
      } else {
        console.error('\n❌ Error:', message.subtype);
        process.exit(1);
      }
    }
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🧹 Console Log Stripper

Removes debugging console statements from your codebase.

Usage:
  bun run agents/console-log-stripper.ts [options]

Options:
  --dry-run              Preview changes without modifying files
  --preserve-comments    Keep comments explaining what was logged
  --target <dir>         Target directory to scan (default: .)
  --exclude <dir>        Additional directory to exclude (can be used multiple times)
  --include <pattern>    File pattern to include (default: **/*.{js,ts,jsx,tsx})
  --strict               Remove ALL console.log/debug/info regardless of context
  --help, -h             Show this help message

Examples:
  # Dry run to see what would be removed
  bun run agents/console-log-stripper.ts --dry-run

  # Clean up the src directory
  bun run agents/console-log-stripper.ts --target src

  # Strict mode removes everything
  bun run agents/console-log-stripper.ts --strict

  # Exclude additional directories
  bun run agents/console-log-stripper.ts --exclude tests --exclude scripts
  `);
  process.exit(0);
}

// Parse options
const options: ConsoleLogStripperOptions = {
  dryRun: false,
  preserveComments: false,
  targetDir: '.',
  excludeDirs: ['node_modules', 'dist', 'build', '.next', '.nuxt', 'coverage'],
  includePatterns: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
  strict: false,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--dry-run':
      options.dryRun = true;
      break;
    case '--preserve-comments':
      options.preserveComments = true;
      break;
    case '--target':
      i++;
      if (i < args.length) options.targetDir = args[i];
      break;
    case '--exclude':
      i++;
      if (i < args.length && args[i]) options.excludeDirs!.push(args[i]!);
      break;
    case '--include':
      i++;
      if (i < args.length && args[i]) options.includePatterns!.push(args[i]!);
      break;
    case '--strict':
      options.strict = true;
      break;
  }
}

// Run the stripper
stripConsoleLogs(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});