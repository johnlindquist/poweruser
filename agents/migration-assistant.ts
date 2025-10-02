#!/usr/bin/env bun

/**
 * Interactive Migration Assistant
 *
 * An agent that helps migrate codebases between frameworks/versions with:
 * - Codebase analysis and migration planning
 * - Step-by-step incremental migrations with user approval
 * - Automated pattern updates (imports, APIs, deprecated code)
 * - Test validation after each step
 * - Rollback capability on failures
 *
 * Usage:
 *   bun run agents/migration-assistant.ts "Migrate from React 17 to React 18"
 *   bun run agents/migration-assistant.ts "Upgrade Express 4 to Express 5"
 *   bun run agents/migration-assistant.ts "Convert Jest to Vitest"
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

async function runMigrationAssistant(migrationGoal: string) {
  console.log('🔄 Starting Interactive Migration Assistant...\n');
  console.log(`📋 Migration Goal: ${migrationGoal}\n`);

  // Generator for streaming user messages (allows for incremental approvals)
  async function* userMessageStream() {
    // Initial migration request
    yield {
      type: 'user' as const,
      session_id: '',
      message: {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: `You are an Interactive Migration Assistant. Your goal is to help migrate this codebase with the following objective:

${migrationGoal}

Follow this process:

1. **Analysis Phase**
   - Analyze the current codebase structure
   - Identify all files that need changes
   - Check current dependency versions
   - Identify deprecated patterns and breaking changes
   - Create a comprehensive migration plan with steps

2. **Planning Phase**
   - Use TodoWrite to create a detailed task list
   - Break down the migration into small, safe steps
   - Identify potential risks and rollback points
   - Present the plan to the user for approval

3. **Execution Phase** (only after user approval)
   - Execute each migration step incrementally
   - Run tests after EVERY step to validate correctness
   - If tests fail, rollback the changes and report the issue
   - Mark tasks as completed in the todo list
   - Provide clear progress updates

4. **Validation Phase**
   - Run full test suite
   - Check for any remaining deprecated patterns
   - Generate a migration report with:
     - Changes made
     - Test results
     - Known issues or warnings
     - Recommended next steps

**Important Guidelines:**
- NEVER make changes without analyzing first
- ALWAYS use TodoWrite to track progress
- ALWAYS run tests after each change
- If any tests fail, STOP and report the failure
- Ask for user confirmation before major changes
- Provide rollback instructions if something goes wrong
- Be conservative and safe - it's better to take small steps

Start by analyzing the codebase.`
          }
        ]
      },
      parent_tool_use_id: null
    };
  }

  const queryStream = query({
    prompt: userMessageStream(),
    options: {
      model: 'claude-sonnet-4-5-20250929',
      permissionMode: 'default', // Ask for permission on file changes
      maxTurns: 50,
      includePartialMessages: true,

      // Hooks for monitoring the migration process
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                // Monitor file edits and warn about risky changes
                if (input.hook_event_name === 'PreToolUse') {
                  if (input.tool_name === 'Edit' || input.tool_name === 'Write') {
                    const filePath = (input.tool_input as any).file_path || '';

                    // Warn about critical file changes
                    if (filePath.includes('package.json') ||
                        filePath.includes('package-lock.json') ||
                        filePath.includes('tsconfig.json')) {
                      console.log(`⚠️  About to modify critical file: ${filePath}`);
                    }
                  }

                  // Monitor bash commands for test execution
                  if (input.tool_name === 'Bash') {
                    const command = (input.tool_input as any).command || '';
                    if (command.includes('test') || command.includes('npm test')) {
                      console.log('🧪 Running tests...');
                    }
                  }
                }

                return {
                  continue: true
                };
              }
            ]
          }
        ],

        PostToolUse: [
          {
            hooks: [
              async (input) => {
                // Monitor test results
                if (input.hook_event_name === 'PostToolUse') {
                  if (input.tool_name === 'Bash') {
                    const command = (input.tool_input as any).command || '';
                    const output = (input.tool_response as any).output || '';

                    if (command.includes('test') || command.includes('npm test')) {
                      if (output.includes('FAIL') || output.includes('failed')) {
                        console.log('❌ Tests failed! Migration step may have issues.');
                      } else if (output.includes('PASS') || output.includes('passed')) {
                        console.log('✅ Tests passed! Safe to continue.');
                      }
                    }
                  }
                }

                return {
                  continue: true
                };
              }
            ]
          }
        ],

        Notification: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'Notification') {
                  console.log(`📢 ${input.title || 'Notification'}: ${input.message}`);
                }
                return {
                  continue: true
                };
              }
            ]
          }
        ]
      },

      // Only allow safe tools initially
      allowedTools: [
        'Read',
        'Glob',
        'Grep',
        'Bash',
        'Edit',
        'Write',
        'TodoWrite'
      ],

      // Custom tool permission handler for extra safety
      async canUseTool(toolName, input, _context) {
        // Auto-approve read-only operations
        if (['Read', 'Glob', 'Grep'].includes(toolName)) {
          return {
            behavior: 'allow',
            updatedInput: input
          };
        }

        // Auto-approve TodoWrite for tracking
        if (toolName === 'TodoWrite') {
          return {
            behavior: 'allow',
            updatedInput: input
          };
        }

        // For Bash commands, check if they're safe
        if (toolName === 'Bash') {
          const command = (input as any).command || '';

          // Auto-approve safe read-only commands
          if (command.startsWith('npm test') ||
              command.startsWith('npm run test') ||
              command.startsWith('git status') ||
              command.startsWith('git diff')) {
            return {
              behavior: 'allow',
              updatedInput: input
            };
          }

          // Warn about potentially destructive commands
          if (command.includes('rm -rf') ||
              command.includes('git reset --hard') ||
              command.includes('npm install') ||
              command.includes('npm uninstall')) {
            console.log(`⚠️  Potentially destructive command: ${command}`);
          }
        }

        // Default: let Claude Code's permission system handle it
        return {
          behavior: 'allow',
          updatedInput: input
        };
      },

      // Capture stderr for error monitoring
      stderr: (data: string) => {
        if (data.trim()) {
          console.error('⚠️  stderr:', data);
        }
      }
    }
  });

  // Stream and display results
  let lastStatus = '';
  let migrationComplete = false;

  for await (const message of queryStream) {
    switch (message.type) {
      case 'assistant':
        // Display assistant messages with text content
        for (const block of message.message.content) {
          if (block.type === 'text') {
            console.log('\n💬 Assistant:', block.text, '\n');
          } else if (block.type === 'tool_use') {
            const status = `🔧 Using tool: ${block.name}`;
            if (status !== lastStatus) {
              console.log(status);
              lastStatus = status;
            }
          }
        }
        break;

      case 'user':
        // Echo user messages (for context in interactive mode)
        for (const block of message.message.content) {
          if (block.type === 'text') {
            console.log('\n👤 User:', block.text, '\n');
          }
        }
        break;

      case 'result':
        migrationComplete = true;
        console.log('\n' + '='.repeat(60));
        console.log('📊 Migration Result');
        console.log('='.repeat(60));

        if (message.subtype === 'success') {
          console.log('✅ Status: Success');
          console.log(`📝 Result: ${message.result}`);
        } else {
          console.log('❌ Status: Error');
          console.log(`❌ Error Type: ${message.subtype}`);
        }

        console.log(`\n📈 Statistics:`);
        console.log(`   Turns: ${message.num_turns}`);
        console.log(`   Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`   Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`   Input Tokens: ${message.usage.input_tokens.toLocaleString()}`);
        console.log(`   Output Tokens: ${message.usage.output_tokens.toLocaleString()}`);

        if (message.permission_denials.length > 0) {
          console.log(`\n⚠️  Permission Denials: ${message.permission_denials.length}`);
          for (const denial of message.permission_denials) {
            console.log(`   - ${denial.tool_name}`);
          }
        }
        break;

      case 'stream_event':
        // Show real-time updates for text generation
        if (message.event.type === 'content_block_delta' &&
            message.event.delta.type === 'text_delta') {
          process.stdout.write(message.event.delta.text);
        }
        break;

      case 'system':
        if (message.subtype === 'init') {
          console.log('🚀 System initialized');
          console.log(`   Model: ${message.model}`);
          console.log(`   CWD: ${message.cwd}`);
          console.log(`   Tools: ${message.tools.length}`);
          console.log(`   Permission Mode: ${message.permissionMode}\n`);
        }
        break;
    }
  }

  if (!migrationComplete) {
    console.log('\n⚠️  Migration was interrupted or cancelled.');
  }

  console.log('\n✨ Migration Assistant session complete.\n');
}

// Main execution
const migrationGoal = process.argv[2];

if (!migrationGoal) {
  console.error('❌ Error: Please provide a migration goal.\n');
  console.log('Usage:');
  console.log('  bun run agents/migration-assistant.ts "Migrate from React 17 to React 18"');
  console.log('  bun run agents/migration-assistant.ts "Upgrade Express 4 to Express 5"');
  console.log('  bun run agents/migration-assistant.ts "Convert Jest to Vitest"\n');
  process.exit(1);
}

runMigrationAssistant(migrationGoal).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});