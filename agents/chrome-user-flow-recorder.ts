#!/usr/bin/env bun

/**
 * Chrome User Flow Recorder Agent
 *
 * Uses Chrome DevTools MCP to record user interactions and generate test code:
 * - Records clicks, typing, navigation
 * - Captures element selectors
 * - Generates Playwright/Cypress test code
 * - Includes assertions for critical flows
 * - Can record checkout, signup, login flows
 *
 * Usage:
 *   bun run agents/chrome-user-flow-recorder.ts <url> [options]
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface UserFlowOptions {
  url: string;
  flow: string;
  outputFile?: string;
  framework?: 'playwright' | 'cypress';
}

async function recordUserFlow(options: UserFlowOptions) {
  const { url, flow, outputFile, framework = 'playwright' } = options;

  console.log('🎬 Chrome User Flow Recorder\n');
  console.log(`URL: ${url}`);
  console.log(`Flow: ${flow}`);
  console.log(`Framework: ${framework}\n`);

  const prompt = `
You are a test automation expert recording a user flow to generate test code.

Target URL: ${url}
Flow to Record: ${flow}
Target Framework: ${framework}

Tasks:
1. Open URL in Chrome
2. Take snapshot to identify interactive elements
3. Follow this flow description: "${flow}"
4. For each step:
   - Identify the element (button, input, link)
   - Record the action (click, type, navigate)
   - Capture selector (prefer data-testid, then ID, then stable selectors)
   - Note assertions (page navigation, element appears, etc.)

5. Generate ${framework} test code

Example flow for "signup":
- Navigate to ${url}
- Click signup button
- Fill email field
- Fill password field
- Click submit
- Assert success message appears

Generate ${framework} test file and save to "${outputFile || `${flow}-test.spec.ts`}":

${
  framework === 'playwright'
    ? `
\`\`\`typescript
import { test, expect } from '@playwright/test';

test('${flow}', async ({ page }) => {
  // Navigate
  await page.goto('${url}');

  // [Record each interaction]
  await page.click('[data-testid="signup-button"]');
  await page.fill('[data-testid="email-input"]', 'test@example.com');
  await page.fill('[data-testid="password-input"]', 'Password123!');
  await page.click('[data-testid="submit-button"]');

  // Assertions
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
});
\`\`\`
`
    : `
\`\`\`typescript
describe('${flow}', () => {
  it('completes ${flow} flow', () => {
    // Navigate
    cy.visit('${url}');

    // [Record each interaction]
    cy.get('[data-testid="signup-button"]').click();
    cy.get('[data-testid="email-input"]').type('test@example.com');
    cy.get('[data-testid="password-input"]').type('Password123!');
    cy.get('[data-testid="submit-button"]').click();

    // Assertions
    cy.get('[data-testid="success-message"]').should('be.visible');
  });
});
\`\`\`
`
}

Also generate a markdown guide explaining the test and how to run it.
`.trim();

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: {
        'chrome-devtools': {
          type: 'stdio',
          command: 'npx',
          args: ['chrome-devtools-mcp@latest', '--isolated'],
        },
      },
      allowedTools: [
        'mcp__chrome-devtools__navigate_page',
        'mcp__chrome-devtools__new_page',
        'mcp__chrome-devtools__take_snapshot',
        'mcp__chrome-devtools__click',
        'mcp__chrome-devtools__fill',
        'mcp__chrome-devtools__fill_form',
        'mcp__chrome-devtools__evaluate_script',
        'Write',
        'TodoWrite',
      ],
      permissionMode: 'acceptEdits',
      maxTurns: 30,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  for await (const message of result) {
    if (message.type === 'result' && message.subtype === 'success') {
      console.log(`\n✅ Test generated: ${outputFile || `${flow}-test.spec.ts`}`);
    }
  }
}

const args = process.argv.slice(2);
if (args.length < 2 || args.includes('--help')) {
  console.log(`
🎬 Chrome User Flow Recorder

Usage:
  bun run agents/chrome-user-flow-recorder.ts <url> <flow-description> [options]

Arguments:
  url                     Website URL
  flow-description        Description of flow (e.g., "signup", "checkout", "login")

Options:
  --output <file>         Output test file
  --framework <name>      playwright or cypress (default: playwright)
  --help                  Show this help

Examples:
  bun run agents/chrome-user-flow-recorder.ts https://example.com "signup flow"
  bun run agents/chrome-user-flow-recorder.ts https://example.com "checkout" --framework cypress
  `);
  process.exit(0);
}

const url = args[0] || '';
const flow = args[1] || '';

const options: UserFlowOptions = { url, flow };
const outputIndex = args.indexOf('--output');
if (outputIndex !== -1) options.outputFile = args[outputIndex + 1];
const frameworkIndex = args.indexOf('--framework');
if (frameworkIndex !== -1) options.framework = args[frameworkIndex + 1] as any;

recordUserFlow(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
