#!/usr/bin/env bun

/**
 * Form Flow Optimizer Agent
 *
 * This agent uses Chrome DevTools MCP to optimize multi-step forms:
 * - Navigates through form flows automatically with test data
 * - Measures time spent on each field and identifies slow interactions
 * - Records UX friction: confusing labels, validation errors
 * - Analyzes drop-off points where users might abandon
 * - Takes snapshots at each step to identify visual clarity issues
 * - Tests form validation behavior and error message clarity
 * - Generates actionable UX recommendations with predicted conversion improvements
 * - Creates A/B test variations with optimized field order and labels
 *
 * Usage:
 *   bun run agents/form-flow-optimizer.ts <url> [options]
 *
 * Examples:
 *   # Analyze a signup form
 *   bun run agents/form-flow-optimizer.ts https://example.com/signup
 *
 *   # Multi-step checkout flow
 *   bun run agents/form-flow-optimizer.ts https://example.com/checkout --steps 3
 *
 *   # Generate optimization report
 *   bun run agents/form-flow-optimizer.ts https://example.com/form --report form-analysis.md
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface FormFlowOptions {
  url: string;
  steps?: number;
  reportFile?: string;
  testData?: boolean;
  mobile?: boolean;
}

async function optimizeFormFlow(options: FormFlowOptions) {
  const {
    url,
    steps = 1,
    reportFile = 'form-flow-optimization.md',
    testData = true,
    mobile = false,
  } = options;

  console.log('📝 Form Flow Optimizer\n');
  console.log(`URL: ${url}`);
  console.log(`Expected Steps: ${steps}`);
  if (mobile) console.log('Device: Mobile simulation');
  console.log('');

  const prompt = `
You are a conversion rate optimization expert using Chrome DevTools MCP to analyze and optimize form flows.

Target URL: ${url}
Expected Form Steps: ${steps}
${mobile ? 'Device: Mobile (375x667)' : 'Device: Desktop'}

Your tasks:
1. Open the URL in Chrome using Chrome DevTools MCP
${mobile ? '2. Resize to mobile viewport (375x667)' : ''}
3. Take a snapshot of the initial form state
4. Identify all form fields on the page using JavaScript:
   \`\`\`javascript
   () => {
     const fields = [];
     const inputs = document.querySelectorAll('input, textarea, select');

     inputs.forEach((input, index) => {
       const label = input.labels?.[0]?.textContent ||
                     input.getAttribute('aria-label') ||
                     input.getAttribute('placeholder') ||
                     'Unlabeled';

       fields.push({
         index,
         type: input.type || input.tagName.toLowerCase(),
         name: input.name,
         id: input.id,
         label: label.trim(),
         required: input.required || input.getAttribute('aria-required') === 'true',
         placeholder: input.placeholder,
         ref: 'input_' + index
       });
     });

     return {
       totalFields: fields.length,
       fields,
       hasSubmitButton: !!document.querySelector('button[type="submit"], input[type="submit"]')
     };
   }
   \`\`\`

5. Fill out the form with realistic test data:
   - For each field, use fill_form tool
   - Text inputs: Use realistic names, emails, addresses
   - Email: test@example.com
   - Phone: (555) 123-4567
   - Password: TestPass123!
   - Credit cards: Use test card 4242 4242 4242 4242
   - Dates: Use valid dates
   - Selects: Choose first non-empty option

6. Measure interaction timings:
   - Time to fill each field
   - Validation response time
   - Error message appearance delay
   - Loading states duration

7. Test validation behavior:
   - Try submitting with empty required fields
   - Enter invalid data (bad email, short password)
   - Check if error messages are clear and helpful
   - Verify field-level vs form-level validation
   - Test real-time validation feedback

8. Analyze UX friction points:
   - Confusing or missing labels
   - Fields requiring multiple attempts
   - Unclear validation error messages
   - Required fields not marked
   - Poor tab order
   - Auto-focus issues
   - Password visibility toggle missing
   - Excessive required fields

9. Take screenshots at key moments:
   - Initial form state
   - After validation errors
   - Success state (if reached)

10. Check network requests for:
    - API call patterns
    - Response times
    - Failed requests
    - Unnecessary calls

11. Evaluate form structure:
    - Logical field grouping
    - Clear progress indication for multi-step
    - Appropriate field types (email vs text)
    - Mobile-friendly input types
    - Input masking where helpful
    - Autocomplete attributes

Generate a comprehensive form optimization report and save to "${reportFile}" with:

## Form Flow Analysis Summary
- Total Fields: [count]
- Required Fields: [count]
- Average Time per Field: [time]
- Total Completion Time: [time]
- Drop-off Risk Score: [0-100]
- Mobile Friendly: [Yes/No]

## Friction Points (High Priority)
1. [Issue name]
   - Impact: High/Medium/Low
   - Location: [Field name]
   - Problem: [Specific issue]
   - Fix: [Recommended solution]
   - Est. Conversion Impact: +[X]%

## Field-by-Field Analysis
1. [Field Name] - [Type]
   - Label Clarity: [Rating]
   - Validation: [Rating]
   - Time to Complete: [time]
   - Error Rate: [count]
   - Recommendation: [specific fix]

## Validation Issues
- Error messages unclear: [list]
- Missing real-time feedback: [list]
- Confusing requirements: [list]

## Optimization Recommendations (Priority Order)
1. **Quick Wins** (Implement Today)
   - [Recommendation] → Est. +[X]% conversion
   - [Recommendation] → Est. +[X]% conversion

2. **High Impact** (Implement This Week)
   - [Recommendation] → Est. +[X]% conversion

3. **Nice to Have** (Future Improvements)
   - [Recommendation]

## A/B Test Variations
### Variation A: Simplified Flow
- Remove [X] unnecessary fields
- Combine [fields] into one
- Expected lift: +[X]% conversion

### Variation B: Enhanced UX
- Add progress indicator
- Improve error messages
- Add field tooltips
- Expected lift: +[X]% conversion

## Mobile Experience Issues
${mobile ? '- [List of mobile-specific issues]' : 'N/A - Desktop only analysis'}

## Next Steps
1. Implement quick wins first
2. Set up A/B testing
3. Monitor conversion rate changes
4. Re-run analysis after changes
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
        'mcp__chrome-devtools__take_screenshot',
        'mcp__chrome-devtools__evaluate_script',
        'mcp__chrome-devtools__fill',
        'mcp__chrome-devtools__fill_form',
        'mcp__chrome-devtools__click',
        'mcp__chrome-devtools__resize_page',
        'mcp__chrome-devtools__list_network_requests',
        'mcp__chrome-devtools__wait_for',
        'Write',
        'TodoWrite',
      ],
      permissionMode: 'default',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  const toolName = input.tool_name;
                  if (toolName === 'mcp__chrome-devtools__fill_form') {
                    console.log('📝 Filling form fields...');
                  } else if (toolName === 'mcp__chrome-devtools__click') {
                    console.log('🖱️  Interacting with form...');
                  } else if (toolName === 'mcp__chrome-devtools__take_screenshot') {
                    console.log('📸 Capturing form state...');
                  } else if (toolName === 'mcp__chrome-devtools__list_network_requests') {
                    console.log('🌐 Analyzing network activity...');
                  } else if (toolName === 'Write') {
                    console.log(`💾 Generating report: ${reportFile}`);
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
                  const toolName = input.tool_name;
                  if (toolName === 'mcp__chrome-devtools__evaluate_script') {
                    console.log('✅ Form analysis complete');
                  } else if (toolName === 'Write') {
                    console.log('✅ Report saved');
                  }
                }
                return { continue: true };
              },
            ],
          },
        ],
        SessionEnd: [
          {
            hooks: [
              async () => {
                console.log('\n✨ Form flow optimization complete!');
                console.log(`\n📄 Full report: ${reportFile}`);
                console.log('\nNext steps:');
                console.log('1. Review friction points');
                console.log('2. Implement quick wins');
                console.log('3. Set up A/B tests');
                console.log('4. Monitor conversion rates');
                return { continue: true };
              },
            ],
          },
        ],
      },
      maxTurns: 40,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  for await (const message of result) {
    if (message.type === 'assistant') {
      const textContent = message.message.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        const text = textContent.text;
        if (!text.includes('tool_use') && text.trim().length > 0) {
          console.log('\n💡', text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('\n' + '='.repeat(60));
        console.log('📊 Analysis Statistics');
        console.log('='.repeat(60));
        console.log(`\nDuration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);

        if (message.result) {
          console.log('\n' + '='.repeat(60));
          console.log('📝 Summary');
          console.log('='.repeat(60));
          console.log('\n' + message.result);
        }
      } else {
        console.error('\n❌ Error:', message.subtype);
      }
    }
  }
}

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
📝 Form Flow Optimizer

Usage:
  bun run agents/form-flow-optimizer.ts <url> [options]

Arguments:
  url                     Form URL to analyze

Options:
  --steps <number>        Expected number of form steps (default: 1)
  --report <file>         Output file (default: form-flow-optimization.md)
  --mobile                Simulate mobile device
  --help                  Show this help

Examples:
  bun run agents/form-flow-optimizer.ts https://example.com/signup
  bun run agents/form-flow-optimizer.ts https://example.com/checkout --steps 3
  bun run agents/form-flow-optimizer.ts https://example.com/form --mobile
  bun run agents/form-flow-optimizer.ts https://example.com/form --report my-analysis.md

Common Issues Detected:
  - Confusing or missing labels
  - Poor validation error messages
  - Excessive required fields
  - Slow validation response
  - Bad tab order
  - Missing password visibility toggle
  - Fields requiring multiple attempts
  `);
  process.exit(0);
}

const url = args[0];
if (!url) {
  console.error('❌ Error: URL is required');
  process.exit(1);
}

try {
  new URL(url);
} catch (error) {
  console.error('❌ Error: Invalid URL format');
  process.exit(1);
}

const options: FormFlowOptions = { url };

for (let i = 1; i < args.length; i++) {
  switch (args[i]) {
    case '--steps':
      options.steps = parseInt(args[++i] || '1', 10);
      break;
    case '--report':
      options.reportFile = args[++i];
      break;
    case '--mobile':
      options.mobile = true;
      break;
  }
}

optimizeFormFlow(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
