#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';

interface GalleryOptions { urls: string[]; outputDir?: string; }

async function generateGallery(options: GalleryOptions) {
  const { urls, outputDir = './screenshots' } = options;
  console.log('📸 Chrome Screenshot Gallery Generator\n');
  console.log(`Pages: ${urls.length}`);
  console.log(`Output: ${outputDir}\n`);

  const prompt = `Generate screenshot gallery for these URLs: ${urls.join(', ')}. For each URL: open page, wait for load, take full-page screenshot saved to ${outputDir}/[sanitized-url].png. After all screenshots: generate ${outputDir}/index.html gallery page showing all screenshots in a grid with URL labels and links. Make gallery responsive and visually appealing with CSS.`;

  const result = query({
    prompt,
    options: {
      cwd: process.cwd(),
      mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args: ['chrome-devtools-mcp@latest', '--isolated'] }},
      allowedTools: ['mcp__chrome-devtools__navigate_page', 'mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__take_screenshot', 'mcp__chrome-devtools__wait_for', 'Write', 'Bash', 'TodoWrite'],
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
                    console.log(`🌐 Opening: ${url}`);
                  } else if (toolName === 'mcp__chrome-devtools__take_screenshot') {
                    console.log('📸 Capturing screenshot...');
                  } else if (toolName === 'Write' && (input.tool_input as any).file_path?.endsWith('.html')) {
                    console.log('🎨 Generating gallery HTML...');
                  } else if (toolName === 'Bash') {
                    console.log('📁 Creating output directory...');
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
                    console.log('✅ Screenshot saved');
                  } else if (toolName === 'Write' && (input.tool_input as any).file_path?.endsWith('.html')) {
                    console.log('✅ Gallery page created');
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
                console.log(`\n✨ Gallery generation complete!`);
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
    if (message.type === 'result' && message.subtype === 'success') {
      console.log(`\n✅ Gallery generated: ${outputDir}/index.html`);
    }
  }
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log('\n📸 Chrome Screenshot Gallery Generator\n\nUsage:\n  bun run agents/chrome-screenshot-gallery-generator.ts <url1> <url2> [...] [--output <dir>]\n\nOptions:\n  --output <dir>    Output directory (default: ./screenshots)\n');
  process.exit(0);
}

const urls = args.filter(arg => !arg.startsWith('--'));
const options: GalleryOptions = { urls };
const outputIndex = args.indexOf('--output');
if (outputIndex !== -1 && args[outputIndex + 1]) options.outputDir = args[outputIndex + 1];

generateGallery(options).catch((err) => { console.error('❌ Fatal error:', err); process.exit(1); });
