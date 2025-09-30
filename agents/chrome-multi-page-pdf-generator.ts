#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';

interface PDFGeneratorOptions { urls: string[]; outputFile?: string; }

async function generatePDF(options: PDFGeneratorOptions) {
  const { urls, outputFile = 'combined-pages.pdf' } = options;
  console.log('📄 Chrome Multi-Page PDF Generator\n');
  console.log(`Pages: ${urls.length}`);
  console.log(`Output: ${outputFile}\n`);

  const prompt = `Generate a combined PDF from these URLs: ${urls.join(', ')}. For each URL: open page, wait for page load (wait for network idle and DOM content loaded), take full-page screenshot. After collecting all screenshots, use JavaScript or Bash tools to combine screenshots into single PDF file: ${outputFile}. Each URL should be a separate page in the PDF. Include page numbers and URL labels. Report total pages and file size.`;

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args: ['chrome-devtools-mcp@latest', '--isolated'] }},
      allowedTools: ['mcp__chrome-devtools__navigate_page', 'mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__take_screenshot', 'mcp__chrome-devtools__wait_for', 'mcp__chrome-devtools__close_page', 'Bash', 'TodoWrite'],
      permissionMode: 'acceptEdits',
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  const toolName = input.tool_name;
                  if (toolName === 'mcp__chrome-devtools__navigate_page') {
                    const url = (input.tool_input as any).url;
                    console.log(`🌐 Loading page: ${url}`);
                  } else if (toolName === 'mcp__chrome-devtools__take_screenshot') {
                    console.log('📸 Capturing page screenshot...');
                  } else if (toolName === 'Bash' && (input.tool_input as any).command?.includes('convert')) {
                    console.log('📄 Combining screenshots into PDF...');
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
                  if (toolName === 'mcp__chrome-devtools__take_screenshot') {
                    console.log('✅ Screenshot captured');
                  } else if (toolName === 'Bash' && (input.tool_input as any).command?.includes('convert')) {
                    console.log('✅ PDF generated');
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
                console.log('\n✨ Multi-page PDF generation complete!');
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
      console.log(`\n✅ PDF generated: ${outputFile}`);
      if (message.result) console.log('\n' + message.result);
    }
  }
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log('\n📄 Chrome Multi-Page PDF Generator\n\nUsage:\n  bun run agents/chrome-multi-page-pdf-generator.ts <url1> <url2> [...] [--output <file>]\n\nOptions:\n  --output <file>    Output PDF file (default: combined-pages.pdf)\n');
  process.exit(0);
}

const urls = args.filter(arg => !arg.startsWith('--'));
const options: PDFGeneratorOptions = { urls };
const outputIndex = args.indexOf('--output');
if (outputIndex !== -1 && args[outputIndex + 1]) options.outputFile = args[outputIndex + 1];

generatePDF(options).catch((err) => { console.error('❌ Fatal error:', err); process.exit(1); });
