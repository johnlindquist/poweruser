#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';

interface TranslatorOptions { url: string; targetLang: string; outputFile?: string; compareLayouts?: boolean; }

async function translatePage(options: TranslatorOptions) {
  const { url, targetLang, outputFile = 'translation-report.md', compareLayouts = false } = options;
  console.log('🌐 Chrome Auto Translator\n');
  console.log(`URL: ${url}`);
  console.log(`Target language: ${targetLang}`);
  console.log(`Compare layouts: ${compareLayouts}\n`);

  const prompt = `Translate page content at ${url} to ${targetLang}. Open page, extract all text content using evaluate_script (headings, paragraphs, buttons, labels, alt text). Translate text to ${targetLang} using your knowledge. ${compareLayouts ? 'Take screenshot of original page. Apply translations by injecting JavaScript to replace text content. Take screenshot of translated page. Compare layouts for issues: text overflow, broken layouts, truncation.' : 'Generate translated text only.'} Save to ${outputFile} with: original text, translated text, ${compareLayouts ? 'layout comparison analysis with screenshots, recommendations for text length adjustments' : 'translation summary'}. Report translation coverage (% of text translated).`;

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args: ['chrome-devtools-mcp@latest', '--isolated'] }},
      allowedTools: ['mcp__chrome-devtools__navigate_page', 'mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__evaluate_script', 'mcp__chrome-devtools__take_screenshot', 'mcp__chrome-devtools__wait_for', 'Write', 'TodoWrite'],
      permissionMode: 'acceptEdits',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  const toolName = input.tool_name;
                  if (toolName === 'mcp__chrome-devtools__navigate_page') {
                    console.log('🌐 Loading page...');
                  } else if (toolName === 'mcp__chrome-devtools__evaluate_script' && !compareLayouts) {
                    console.log(`🌍 Extracting text for translation to ${targetLang}...`);
                  } else if (toolName === 'mcp__chrome-devtools__evaluate_script' && compareLayouts) {
                    console.log(`🔄 Applying ${targetLang} translations to page...`);
                  } else if (toolName === 'mcp__chrome-devtools__take_screenshot') {
                    console.log('📸 Capturing layout screenshot...');
                  } else if (toolName === 'Write') {
                    console.log('💾 Saving translation report...');
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
                  if (toolName === 'mcp__chrome-devtools__evaluate_script' && compareLayouts) {
                    console.log('✅ Translations applied');
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
                console.log('\n✨ Auto-translation complete!');
                return { continue: true };
              },
            ],
          },
        ],
      },
      maxTurns: 35,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  for await (const message of result) {
    if (message.type === 'result' && message.subtype === 'success') {
      console.log(`\n✅ Translation complete: ${outputFile}`);
      if (message.result) console.log('\n' + message.result);
    }
  }
}

const args = process.argv.slice(2);
if (args.length < 2 || args.includes('--help')) {
  console.log('\n🌐 Chrome Auto Translator\n\nUsage:\n  bun run agents/chrome-auto-translator.ts <url> <target-lang> [--output <file>] [--compare-layouts]\n\nOptions:\n  --output <file>        Output report file (default: translation-report.md)\n  --compare-layouts      Compare original and translated layouts\n\nExamples:\n  bun run agents/chrome-auto-translator.ts https://example.com es\n  bun run agents/chrome-auto-translator.ts https://example.com fr --compare-layouts\n');
  process.exit(0);
}

const options: TranslatorOptions = { url: args[0]!, targetLang: args[1]!, compareLayouts: args.includes('--compare-layouts') };
const outputIndex = args.indexOf('--output');
if (outputIndex !== -1 && args[outputIndex + 1]) options.outputFile = args[outputIndex + 1];

translatePage(options).catch((err) => { console.error('❌ Fatal error:', err); process.exit(1); });
