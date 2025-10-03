#!/usr/bin/env -S bun run

import { claude, getPositionals, parsedArgs, readStringFlag, readBooleanFlag } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface TranslatorOptions {
  url: string;
  targetLang: string;
  outputFile: string;
  compareLayouts: boolean;
}

function printHelp(): void {
  console.log(`\n🌐 Chrome Auto Translator\n\nUsage:\n  bun run agents/chrome-auto-translator.ts <url> <target-lang> [--output <file>] [--compare-layouts]\n\nOptions:\n  --output <file>        Output report file (default: translation-report.md)\n  --compare-layouts      Compare original and translated layouts\n  --help, -h             Show this help message\n\nExamples:\n  bun run agents/chrome-auto-translator.ts https://example.com es\n  bun run agents/chrome-auto-translator.ts https://example.com fr --compare-layouts\n`);
}

const positionals = getPositionals();
const values = parsedArgs.values as Record<string, unknown>;

const help = values.help === true || values.h === true;

if (help) {
  printHelp();
  process.exit(0);
}

if (positionals.length < 2) {
  console.log(positionals)
  console.error("❌ Error: URL and target language are required");
  printHelp();
  process.exit(1);
}

const outputFile = readStringFlag("output") ?? "translation-report.md";
const compareLayouts = readBooleanFlag("compare-layouts", false);

const translatorOptions: TranslatorOptions = {
  url: positionals[0]!,
  targetLang: positionals[1]!,
  outputFile,
  compareLayouts,
};

function buildPrompt(options: TranslatorOptions): string {
  const { url, targetLang, outputFile: reportPath, compareLayouts: shouldCompare } = options;

  return `Translate page content at ${url} to ${targetLang}. Open page, extract all text content using evaluate_script (headings, paragraphs, buttons, labels, alt text). Translate text to ${targetLang} using your knowledge. ${shouldCompare ? 'Take screenshot of original page. Apply translations by injecting JavaScript to replace text content. Take screenshot of translated page. Compare layouts for issues: text overflow, broken layouts, truncation.' : 'Generate translated text only.'} Save to ${reportPath} with: original text, translated text, ${shouldCompare ? 'layout comparison analysis with screenshots, recommendations for text length adjustments' : 'translation summary'}. Report translation coverage (% of text translated).`;
}

console.log('🌐 Chrome Auto Translator\n');
console.log(`URL: ${translatorOptions.url}`);
console.log(`Target language: ${translatorOptions.targetLang}`);
console.log(`Compare layouts: ${translatorOptions.compareLayouts ? 'enabled' : 'disabled'}\n`);

const prompt = buildPrompt(translatorOptions);
const claudeSettings: Settings = {};

const allowedTools = [
  'mcp__chrome-devtools__list_pages',
  'mcp__chrome-devtools__navigate_page',
  'mcp__chrome-devtools__new_page',
  'mcp__chrome-devtools__evaluate_script',
  'mcp__chrome-devtools__take_screenshot',
  'mcp__chrome-devtools__wait_for',
  'Write',
  'TodoWrite',
];

const mcpConfig = {
  mcpServers: {
    'chrome-devtools': {
      command: 'npx',
      args: ['chrome-devtools-mcp@latest', '--isolated'],
    },
  },
};

const defaultFlags: ClaudeFlags = {
  model: 'claude-sonnet-4-5-20250929',
  settings: JSON.stringify(claudeSettings),
  allowedTools: allowedTools.join(' '),
  'permission-mode': 'acceptEdits',
  'mcp-config': JSON.stringify(mcpConfig),
  'strict-mcp-config': true,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
  console.log(`\n✅ Translation complete: ${translatorOptions.outputFile}`);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
