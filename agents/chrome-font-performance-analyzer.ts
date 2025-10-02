#!/usr/bin/env -S bun run

/**
 * Chrome Font Performance Analyzer Agent
 *
 * Analyzes web font loading strategy and performance:
 * - Identifies all fonts used on the page
 * - Measures font loading times and render-blocking behavior
 * - Calculates FOIT and FOUT
 * - Checks font-display values
 * - Identifies unused font weights/styles
 * - Suggests optimizations (font-display, preload, subsetting)
 *
 * Usage:
 *   bun run agents/chrome-font-performance-analyzer.ts <url> [options]
 */

import { claude, getPositionals, parsedArgs } from './lib';
import type { ClaudeFlags, Settings } from './lib';

interface FontAnalyzerOptions {
  url: string;
  reportFile: string;
}

const DEFAULT_REPORT_FILE = 'font-performance-report.md';

function printHelp(): void {
  console.log(`
🔤 Chrome Font Performance Analyzer

Usage:
  bun run agents/chrome-font-performance-analyzer.ts <url> [options]

Options:
  --report <file>         Output file (default: ${DEFAULT_REPORT_FILE})
  --help, -h              Show this help message
`);
}

const argv = process.argv.slice(2);
const positionals = getPositionals();
const values = parsedArgs.values as Record<string, unknown>;

const help = values.help === true || values.h === true;
if (help) {
  printHelp();
  process.exit(0);
}

if (positionals.length === 0) {
  console.error('❌ Error: URL required');
  printHelp();
  process.exit(1);
}

const urlCandidate = positionals[0]!;

try {
  new URL(urlCandidate);
} catch {
  console.error('❌ Error: Invalid URL format');
  process.exit(1);
}

function readStringFlag(name: string): string | undefined {
  const raw = values[name];
  if (typeof raw === 'string' && raw.length > 0) {
    return raw;
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg === `--${name}`) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        return next;
      }
    }
    if (arg.startsWith(`--${name}=`)) {
      const [, value] = arg.split('=', 2);
      if (value && value.length > 0) {
        return value;
      }
    }
  }

  return undefined;
}

const options: FontAnalyzerOptions = {
  url: urlCandidate,
  reportFile: readStringFlag('report') ?? DEFAULT_REPORT_FILE,
};

console.log('🔤 Chrome Font Performance Analyzer\n');
console.log(`URL: ${options.url}\n`);

function buildPrompt(opts: FontAnalyzerOptions): string {
  const { url, reportFile } = opts;

  return `
You are a web font performance expert using Chrome DevTools MCP.

Target URL: ${url}

Tasks:
1. Open URL in Chrome
2. Run performance trace with reload
3. List network requests filtered by font types
4. Use JavaScript to analyze fonts:
   \`\`\`javascript
   () => {
     const fonts = [];
     const fontFaces = Array.from(document.fonts);

     fontFaces.forEach(font => {
       fonts.push({
         family: font.family,
         style: font.style,
         weight: font.weight,
         status: font.status,
         loaded: font.status === 'loaded'
       });
     });

     const styles = Array.from(document.styleSheets);
     const fontDisplayRules = [];

     styles.forEach(sheet => {
       try {
         const rules = Array.from(sheet.cssRules || []);
         rules.forEach(rule => {
           if (rule.cssText?.includes('@font-face')) {
             fontDisplayRules.push(rule.cssText);
           }
         });
       } catch (e) {
         // CORS blocked
       }
     });

     return {
       totalFonts: fonts.length,
       loadedFonts: fonts.filter(f => f.loaded).length,
       fonts,
       fontDisplayRules
     };
   }
   \`\`\`

5. Analyze font loading performance:
   - Time to first font load
   - Render-blocking fonts
   - Font file sizes
   - Number of font weights/styles
   - Missing font-display declarations

Generate report "${reportFile}":

## Font Performance Analysis
**URL**: ${url}
**Performance Score**: [0-100]/100

### Summary
- Total Fonts: [count]
- Total Size: [X] KB
- Render-Blocking: [count]
- Load Time: [X]ms
- FOIT Duration: [X]ms

### Font Inventory

| Family | Weight | Style | Size | Display | Load Time | Status |
|--------|--------|-------|------|---------|-----------|--------|
| [font] | [400] | normal | [X]KB | [value] | [X]ms | ✅/⚠️ |

### Performance Issues

#### 🔴 Render-Blocking Fonts ([count])
- [Font name] - [X]ms blocking
  - Fix: Add 'font-display: swap'

#### ⚠️  Missing font-display ([count] fonts)
- Causes FOIT (Flash of Invisible Text)
- Fix: Add to @font-face rules:
  \`\`\`css
  @font-face {
    font-family: 'MyFont';
    src: url('font.woff2');
    font-display: swap; /* or optional */
  }
  \`\`\`

#### 💡 Unused Font Weights
- [Font family] loads [X] weights but only uses [Y]
- Savings: [Z]KB

### Optimization Recommendations

1. **Preload Critical Fonts**
   \`\`\`html
   <link rel="preload" href="font.woff2" as="font" type="font/woff2" crossorigin>
   \`\`\`

2. **Add font-display: swap**
   \`\`\`css
   font-display: swap;
   \`\`\`

3. **Use Variable Fonts**
   - Replace [X] separate font files with 1 variable font
   - Savings: [Y]KB

4. **Enable Font Subsetting**
   - Only include characters you need
   - Potential savings: [X]%

5. **Use Modern Formats**
   - WOFF2 preferred (best compression)
   - Fallback to WOFF for older browsers

### Implementation Priority
1. Add font-display: swap (5 min) → +[X]ms faster
2. Preload critical fonts (10 min) → +[Y]ms faster
3. Remove unused weights (30 min) → -[Z]KB
4. Implement subsetting (2 hours) → -[X]KB

### Best Practices Checklist
- [ ] All fonts use font-display
- [ ] Critical fonts are preloaded
- [ ] Using WOFF2 format
- [ ] Only loading needed weights
- [ ] Fonts are subset
- [ ] Using system fonts as fallback
`.trim();
}

const prompt = buildPrompt(options);

const claudeSettings: Settings = {};

const allowedTools = [
  'mcp__chrome-devtools__navigate_page',
  'mcp__chrome-devtools__new_page',
  'mcp__chrome-devtools__performance_start_trace',
  'mcp__chrome-devtools__performance_stop_trace',
  'mcp__chrome-devtools__list_network_requests',
  'mcp__chrome-devtools__evaluate_script',
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
  'permission-mode': 'bypassPermissions',
  'mcp-config': JSON.stringify(mcpConfig),
  'strict-mcp-config': true,
};

claude(prompt, defaultFlags)
  .then((exitCode) => {
    if (exitCode === 0) {
      console.log(`\n📄 Report: ${options.reportFile}`);
    }
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
