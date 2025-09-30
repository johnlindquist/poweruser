#!/usr/bin/env bun

/**
 * Import Optimizer Agent
 *
 * A lightning-fast script that cleans up JavaScript/TypeScript imports:
 * - Removes unused imports by analyzing actual usage in the file
 * - Combines duplicate imports from the same source
 * - Sorts imports by convention (external, internal, relative)
 * - Identifies and suggests missing imports for undefined variables
 * - Handles default, named, and namespace imports correctly
 *
 * Usage: bun run agents/import-optimizer.ts <file-path>
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: bun run agents/import-optimizer.ts <file-path>');
    process.exit(1);
  }

  const filePath = args[0]!; // Non-null assertion since we checked args.length above

  // Validate file path
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.js') && !filePath.endsWith('.jsx')) {
    console.error('Error: File must be a TypeScript or JavaScript file (.ts, .tsx, .js, .jsx)');
    process.exit(1);
  }

  console.log(`\n🔍 Optimizing imports in: ${filePath}\n`);

  const prompt = `Optimize the imports in the file at path: ${filePath}

Your task:
1. Read the file and analyze all imports at the top
2. For each imported item (default, named, or namespace), search the file to see if it's actually used
3. Remove any unused imports
4. Combine duplicate imports from the same source (e.g., multiple lines importing from 'react' should be merged)
5. Sort the imports by convention:
   - External packages first (from node_modules)
   - Internal packages second (starting with @/ or ~/)
   - Relative imports last (starting with ./ or ../)
   - Within each group, sort alphabetically
6. Use the Edit tool to replace the import section with the optimized version

Important rules:
- Preserve the exact formatting style of the imports (single vs double quotes, spacing, etc.)
- Only modify the import statements at the top of the file
- Do NOT change any other code in the file
- If an import is used even once in the file, keep it
- Be careful with side-effect imports (imports with no bindings like 'import "./styles.css"') - always keep these
- Type-only imports should be marked with 'import type' if in TypeScript

Output:
- A brief summary of what was changed (how many imports removed, how many combined, etc.)
- If no changes are needed, just say "No optimization needed - imports are already clean!"`;

  const response = query({
    prompt,
    options: {
      cwd: process.cwd(),
      permissionMode: 'bypassPermissions',
      allowedTools: ['Read', 'Edit', 'Grep'],
      model: 'sonnet',
    },
  });

  let finalResult = '';

  for await (const message of response) {
    if (message.type === 'result') {
      if (message.subtype === 'success') {
        finalResult = message.result;
        console.log('\n✅ Import optimization complete!\n');
        console.log(finalResult);
        console.log('\n');
      } else {
        console.error('\n❌ Error during optimization:');
        console.error(message);
        process.exit(1);
      }
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});