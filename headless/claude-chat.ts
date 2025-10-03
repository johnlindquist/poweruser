#!/usr/bin/env bun

import { spawn } from 'child_process';
import { parseArgs } from 'util';
import * as readline from 'readline';

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
Usage: bun run headless/claude-chat.ts [options] [initial-message]

A CLI tool that spawns a Claude Code instance and sends messages using --input-format stream-json.

Options:
  -h, --help      Show this help message
  -v, --verbose   Enable verbose output

Modes:
  - With initial message: Starts interactive mode with that message
  - Without arguments: Reads JSON messages from stdin (non-interactive)

Examples:
  # Interactive mode with initial message
  bun run headless/claude-chat.ts "Hello, what files are in the headless directory?"

  # With verbose output
  bun run headless/claude-chat.ts -v "List all TypeScript files"

  # Stdin mode (JSONL format)
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
  // Note: --verbose is required when using --output-format=stream-json with -p
  const claude = spawn('claude', [
    '-p',
    '--output-format=stream-json',
    '--input-format=stream-json',
    '--verbose',
  ]);

  // Loading indicator state
  let loadingInterval: Timer | null = null;
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let spinnerIndex = 0;

  const startLoading = () => {
    if (loadingInterval) return;
    process.stdout.write('\r'); // Move to beginning of line
    loadingInterval = setInterval(() => {
      process.stdout.write(`\r${spinnerFrames[spinnerIndex]} Thinking...`);
      spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
    }, 80);
  };

  const stopLoading = () => {
    if (loadingInterval) {
      clearInterval(loadingInterval);
      loadingInterval = null;
      process.stdout.write('\r\x1b[K'); // Clear the line
    }
  };

  // Handle stdout - stream JSON responses
  claude.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter((line: string) => line.trim());

    for (const line of lines) {
      try {
        const msg = JSON.parse(line);

        if (msg.type === 'assistant') {
          stopLoading();
          // Extract text content from assistant messages
          const textContent = msg.message?.content
            ?.filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('');

          if (textContent) {
            console.log('Assistant:', textContent);
          }
        } else if (msg.type === 'result') {
          stopLoading();
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

  // Function to send a message
  const sendMessage = (text: string) => {
    const message = createUserMessage(text);
    if (values.verbose) {
      console.log('Sending:', message);
    }
    claude.stdin.write(message + '\n');
    startLoading();
  };

  // Send initial message if provided as argument
  if (initialMessage) {
    sendMessage(initialMessage);
  }

  // If we have an initial message, use interactive mode
  if (initialMessage) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '\nYou: ',
    });

    // Wait for initial response before prompting
    let isFirstMessage = true;

    // Show prompt after first response completes
    claude.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());

      for (const line of lines) {
        try {
          const msg = JSON.parse(line);

          if (msg.type === 'result' && isFirstMessage) {
            isFirstMessage = false;
            rl.prompt();
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    rl.on('line', (input) => {
      const trimmed = input.trim();
      if (trimmed === 'exit' || trimmed === 'quit') {
        rl.close();
        claude.stdin.end();
        return;
      }
      if (trimmed) {
        sendMessage(trimmed);
      }
    });

    rl.on('close', () => {
      claude.stdin.end();
    });
  } else {
    // No initial message - read JSONL from stdin
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
