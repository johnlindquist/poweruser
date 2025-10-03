#!/usr/bin/env bun

/**
 * Search Claude Code conversation history
 *
 * Searches through ~/.claude/projects/**\/*.jsonl conversation files
 * and returns the first user message from matching conversations.
 *
 * Usage:
 *   bun run agents/search-conversations.ts "search query" [options]
 *
 * Options:
 *   --max-distance <number>  Maximum cosine distance (default: 0.7, 0.0=exact, 1.0=loose)
 *   --top-k <number>         Number of results to return (default: 5)
 *   --full                   Show full first message instead of summary
 *
 * Note: If no results are found, the script will automatically retry with a relaxed
 * threshold (0.85) unless --max-distance was explicitly set.
 */

import { parseArgs } from 'util';

// Parse command line arguments
const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    'max-distance': { type: 'string', default: '0.7' },
    'top-k': { type: 'string', default: '5' },
    'full': { type: 'boolean', default: false },
  },
  strict: false,
  allowPositionals: true,
});

const query = positionals[0];
const maxDistance = values['max-distance'] as string;
const topK = values['top-k'] as string;
const showFull = values.full as boolean;

if (!query) {
  console.error('Usage: search-conversations.ts "search query" [--max-distance 0.7] [--top-k 5] [--full]');
  process.exit(1);
}

// Find all JSONL files
const findProc = Bun.spawn(['find', `${process.env.HOME}/.claude/projects`, '-name', '*.jsonl', '-type', 'f']);
const findOutput = await new Response(findProc.stdout).text();
const files = findOutput.trim().split('\n').filter(f => f);

if (files.length === 0) {
  console.error('No conversation files found in ~/.claude/projects');
  process.exit(1);
}

console.error(`Searching ${files.length} conversation files...`);

// Use search tool to find relevant conversations
const searchArgs: string[] = [
  query,
  ...files,
  '--max-distance', maxDistance,
  '--top-k', topK,
];

const searchProc = Bun.spawn(['search', ...searchArgs], {
  stdout: 'pipe',
  stderr: 'pipe',
});

const searchOutput = await new Response(searchProc.stdout).text();
const searchErrors = await new Response(searchProc.stderr).text();

if (searchErrors) {
  console.error('Search errors:', searchErrors);
}

// Parse search results and group by file with line numbers
const fileMatches = new Map<string, number[]>();

if (!searchOutput.trim()) {
  // If user specified max-distance explicitly, don't retry
  const userSpecifiedDistance = Bun.argv.slice(2).some(arg => arg.includes('--max-distance'));

  if (userSpecifiedDistance) {
    console.log('No matches found.');
    process.exit(0);
  }

  // Try with a more relaxed threshold
  const relaxedDistance = '0.85';
  console.error(`No matches found with distance ${maxDistance}. Retrying with --max-distance ${relaxedDistance}...`);
  console.error(`Tip: Use --max-distance to control similarity threshold (0.0=exact, 1.0=loose)\n`);

  const retryArgs: string[] = [
    query,
    ...files,
    '--max-distance', relaxedDistance,
    '--top-k', topK,
  ];

  const retryProc = Bun.spawn(['search', ...retryArgs], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const retryOutput = await new Response(retryProc.stdout).text();

  if (!retryOutput.trim()) {
    console.log('No matches found even with relaxed threshold.');
    process.exit(0);
  }

  // Parse retry results
  const retryLines = retryOutput.trim().split('\n');
  for (const line of retryLines) {
    const match = line.match(/^(\/[^:]+\.jsonl):(\d+):/);
    if (match && match[1] && match[2]) {
      const filePath = match[1];
      const lineNumber = parseInt(match[2], 10);

      if (!fileMatches.has(filePath)) {
        fileMatches.set(filePath, []);
      }
      fileMatches.get(filePath)!.push(lineNumber);
    }
  }
} else {
  // Parse initial search results
  const lines = searchOutput.trim().split('\n');
  for (const line of lines) {
    const match = line.match(/^(\/[^:]+\.jsonl):(\d+):/);
    if (match && match[1] && match[2]) {
      const filePath = match[1];
      const lineNumber = parseInt(match[2], 10);

      if (!fileMatches.has(filePath)) {
        fileMatches.set(filePath, []);
      }
      fileMatches.get(filePath)!.push(lineNumber);
    }
  }
}

// For each matched file, extract matching messages grouped by file
console.log('\n=== Search Results ===\n');

for (const [file, lineNumbers] of fileMatches) {
  try {
    const content = await Bun.file(file).text();
    const fileLines = content.trim().split('\n');

    // Get first user message for file metadata
    let sessionId = 'unknown';
    let timestamp = 'unknown';

    for (const line of fileLines) {
      const obj = JSON.parse(line);
      if (obj.type === 'user' && obj.message?.content) {
        sessionId = obj.sessionId || 'unknown';
        timestamp = obj.timestamp ? new Date(obj.timestamp).toLocaleDateString() : 'unknown';
        break;
      }
    }

    // Print file header
    console.log(`File: ${file.split('/').pop()}`);
    console.log(`Session: ${sessionId}`);
    console.log(`Date: ${timestamp}`);
    console.log(`Matches: ${lineNumbers.length}`);
    console.log(`Resume: claude --resume ${sessionId}`);
    console.log();

    // Extract and display matching messages
    const matchingMessages = new Set<number>();

    for (const lineNum of lineNumbers) {
      // Line numbers are 1-indexed, array is 0-indexed
      const jsonLine = fileLines[lineNum - 1];
      if (!jsonLine) continue;

      try {
        const obj = JSON.parse(jsonLine);

        // Find the nearest user or assistant message for context
        let contextMessage = '';
        let contextType = '';

        if (obj.type === 'user' || obj.type === 'assistant') {
          const content = obj.message?.content;

          // Handle both string content and array content
          if (typeof content === 'string') {
            contextMessage = content;
          } else if (Array.isArray(content)) {
            // Extract text from content array
            const textParts = content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('\n');
            contextMessage = textParts;
          }
          contextType = obj.type;
        } else {
          // If not a user/assistant message, look for nearby context
          for (let offset = 0; offset < 5; offset++) {
            const prevIdx = lineNum - 1 - offset;
            if (prevIdx >= 0 && prevIdx < fileLines.length) {
              const prevLine = fileLines[prevIdx];
              if (prevLine) {
                const prevObj = JSON.parse(prevLine);
                if ((prevObj.type === 'user' || prevObj.type === 'assistant') && prevObj.message?.content) {
                  const content = prevObj.message.content;

                  if (typeof content === 'string') {
                    contextMessage = content;
                  } else if (Array.isArray(content)) {
                    const textParts = content
                      .filter((c: any) => c.type === 'text')
                      .map((c: any) => c.text)
                      .join('\n');
                    contextMessage = textParts;
                  }
                  contextType = prevObj.type;
                  break;
                }
              }
            }
          }
        }

        if (contextMessage) {
          contextMessage = contextMessage.trim();

          // Avoid duplicate messages
          const msgHash = lineNum;
          if (matchingMessages.has(msgHash)) continue;
          matchingMessages.add(msgHash);

          console.log(`  [Line ${lineNum}] ${contextType}:`);

          if (showFull) {
            console.log(`  ${contextMessage}\n`);
          } else {
            const summary = contextMessage.length > 200 ? contextMessage.slice(0, 200) + '...' : contextMessage;
            console.log(`  ${summary}\n`);
          }
        }
      } catch (parseErr) {
        // Skip unparseable lines
      }
    }

    console.log('---\n');
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
  }
}
