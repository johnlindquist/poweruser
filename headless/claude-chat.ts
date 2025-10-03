#!/usr/bin/env bun

import { spawn } from 'child_process';
import { parseArgs } from 'util';

// Parse command line arguments
const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: 'boolean', short: 'h' },
    verbose: { type: 'boolean', short: 'v' },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log(`
Usage: bun run headless/claude-chat.ts [options] <initial-message>

A CLI tool that spawns a Claude Code instance and sends messages using --input-format stream-json.

Options:
  -h, --help      Show this help message
  -v, --verbose   Enable verbose output

Examples:
  # Single message
  bun run headless/claude-chat.ts "Explain the code in agents/test-generator.ts"

  # With verbose output
  bun run headless/claude-chat.ts -v "List all TypeScript files"

  # Interactive mode (send multiple messages via stdin)
  echo '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Hello"}]}}' | bun run headless/claude-chat.ts
`);
  process.exit(0);
}

// Construct user message in streaming JSON format
function createUserMessage(text: string) {
  return JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [
        {
          type: 'text',
          text: text,
        },
      ],
    },
  });
}

// Main function
async function main() {
  const initialMessage = positionals.join(' ');

  // Spawn claude process with streaming JSON I/O
  const claude = spawn('claude', [
    '-p',
    '--output-format=stream-json',
    '--input-format=stream-json',
  ]);

  // Handle stdout - stream JSON responses
  claude.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter((line: string) => line.trim());

    for (const line of lines) {
      try {
        const msg = JSON.parse(line);

        if (msg.type === 'assistant') {
          // Extract text content from assistant messages
          const textContent = msg.message?.content
            ?.filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('');

          if (textContent) {
            console.log('Assistant:', textContent);
          }
        } else if (msg.type === 'result') {
          // Final result message with metadata
          if (values.verbose) {
            console.log('\n--- Session Complete ---');
            console.log('Session ID:', msg.session_id);
            console.log('Duration:', msg.duration_ms, 'ms');
            console.log('Cost:', msg.total_cost_usd, 'USD');
            console.log('Turns:', msg.num_turns);
          }
        } else if (values.verbose) {
          console.log('Message:', msg.type, msg.subtype || '');
        }
      } catch (e) {
        if (values.verbose) {
          console.error('Failed to parse JSON:', line);
        }
      }
    }
  });

  // Handle stderr
  claude.stderr.on('data', (data) => {
    if (values.verbose) {
      console.error('Error:', data.toString());
    }
  });

  // Handle process exit
  claude.on('close', (code) => {
    if (values.verbose) {
      console.log(`\nClaude process exited with code ${code}`);
    }
    process.exit(code || 0);
  });

  // Send initial message if provided as argument
  if (initialMessage) {
    const message = createUserMessage(initialMessage);
    if (values.verbose) {
      console.log('Sending:', message);
    }
    claude.stdin.write(message + '\n');
    claude.stdin.end();
  } else {
    // Read from stdin and forward to claude
    process.stdin.on('data', (data) => {
      claude.stdin.write(data);
    });

    process.stdin.on('end', () => {
      claude.stdin.end();
    });
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
