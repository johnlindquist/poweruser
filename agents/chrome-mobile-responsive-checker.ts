#!/usr/bin/env bun

/**
 * Chrome Mobile Responsive Checker Agent
 *
 * Uses Chrome DevTools MCP to test responsive design:
 * - Tests at multiple breakpoints and device sizes
 * - Identifies layout breaks and overflow issues
 * - Checks touch target sizes (minimum 44x44px)
 * - Tests text readability without zooming
 * - Identifies horizontal scrolling issues
 * - Verifies viewport meta tag
 * - Takes screenshots at each breakpoint
 *
 * Usage:
 *   bun run agents/chrome-mobile-responsive-checker.ts <url> [options]
 *
 * Examples:
 *   bun run agents/chrome-mobile-responsive-checker.ts https://example.com
 *   bun run agents/chrome-mobile-responsive-checker.ts https://example.com --devices
 *   bun run agents/chrome-mobile-responsive-checker.ts https://example.com --breakpoints 320,768,1024
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface ResponsiveOptions {
  url: string;
  breakpoints?: number[];
  reportFile?: string;
  testDevices?: boolean;
}

async function checkResponsive(options: ResponsiveOptions) {
  const {
    url,
    breakpoints = [320, 375, 414, 768, 1024, 1280, 1920],
    reportFile = 'responsive-check-report.md',
    testDevices = false,
  } = options;

  console.log('📱 Chrome Mobile Responsive Checker\n');
  console.log(`URL: ${url}`);
  console.log(`Breakpoints: ${breakpoints.join(', ')}px`);
  console.log('');

  const deviceConfigs = testDevices
    ? [
        { name: 'iPhone SE', width: 375, height: 667 },
        { name: 'iPhone 12 Pro', width: 390, height: 844 },
        { name: 'iPad', width: 768, height: 1024 },
        { name: 'iPad Pro', width: 1024, height: 1366 },
      ]
    : [];

  const prompt = `
You are a responsive design expert using Chrome DevTools MCP to test mobile responsiveness.

Target URL: ${url}
Breakpoints: ${breakpoints.join(', ')} pixels
${testDevices ? `Test Devices: ${deviceConfigs.map((d) => d.name).join(', ')}` : ''}

Your tasks:

For each breakpoint (${breakpoints.join(', ')}px):

1. Open the URL in Chrome
2. Resize the page to [width]x800 viewport
3. Wait for page to settle
4. Take a snapshot
5. Take a screenshot (save as responsive-[width]px.png)

6. Run JavaScript tests to check for responsive issues:
   \`\`\`javascript
   () => {
     const issues = [];

     // Check viewport meta tag
     const viewport = document.querySelector('meta[name="viewport"]');
     if (!viewport) {
       issues.push({
         type: 'missing_viewport',
         severity: 'critical',
         message: 'Missing viewport meta tag'
       });
     } else {
       const content = viewport.getAttribute('content');
       if (!content?.includes('width=device-width')) {
         issues.push({
           type: 'incorrect_viewport',
           severity: 'high',
           message: 'Viewport not set to device-width'
         });
       }
     }

     // Check for horizontal overflow
     const bodyWidth = document.body.scrollWidth;
     const windowWidth = window.innerWidth;
     if (bodyWidth > windowWidth) {
       issues.push({
         type: 'horizontal_overflow',
         severity: 'high',
         message: \`Content overflows horizontally: \${bodyWidth}px > \${windowWidth}px\`,
         overflow: bodyWidth - windowWidth
       });
     }

     // Check touch target sizes
     const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
     const smallTargets = [];

     interactiveElements.forEach((el, index) => {
       const rect = el.getBoundingClientRect();
       const width = rect.width;
       const height = rect.height;

       if (width > 0 && height > 0 && (width < 44 || height < 44)) {
         smallTargets.push({
           element: el.tagName.toLowerCase(),
           text: el.textContent?.trim().substring(0, 30) || el.getAttribute('aria-label') || '(no text)',
           width,
           height,
           ref: 'target_' + index
         });
       }
     });

     if (smallTargets.length > 0) {
       issues.push({
         type: 'small_touch_targets',
         severity: 'medium',
         message: \`Found \${smallTargets.length} touch targets smaller than 44x44px\`,
         targets: smallTargets.slice(0, 10) // Limit to first 10
       });
     }

     // Check text readability (font size)
     const textElements = document.querySelectorAll('p, span, div, li, td, th');
     const smallText = [];

     textElements.forEach((el) => {
       if (el.textContent?.trim()) {
         const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
         if (fontSize < 16) {
           const text = el.textContent.trim().substring(0, 50);
           smallText.push({ fontSize, text });
         }
       }
     });

     if (smallText.length > 0) {
       issues.push({
         type: 'small_text',
         severity: 'low',
         message: \`Found \${smallText.length} elements with text smaller than 16px\`,
         samples: smallText.slice(0, 5)
       });
     }

     // Check for fixed-width elements that might not scale
     const allElements = document.querySelectorAll('*');
     const fixedWidthElements = [];

     allElements.forEach((el) => {
       const style = window.getComputedStyle(el);
       const width = style.width;

       // Check for pixel-based widths that are larger than viewport
       if (width && width.endsWith('px')) {
         const pixelWidth = parseFloat(width);
         if (pixelWidth > window.innerWidth) {
           fixedWidthElements.push({
             tag: el.tagName.toLowerCase(),
             width: pixelWidth,
             class: el.className
           });
         }
       }
     });

     if (fixedWidthElements.length > 0) {
       issues.push({
         type: 'fixed_width_overflow',
         severity: 'medium',
         message: \`Found \${fixedWidthElements.length} elements with fixed widths larger than viewport\`,
         elements: fixedWidthElements.slice(0, 5)
       });
     }

     // Check image responsiveness
     const images = document.querySelectorAll('img');
     const nonResponsiveImages = [];

     images.forEach((img) => {
       const naturalWidth = img.naturalWidth;
       const displayWidth = img.getBoundingClientRect().width;

       if (naturalWidth > window.innerWidth * 2) {
         nonResponsiveImages.push({
           src: img.src.substring(0, 80),
           naturalWidth,
           displayWidth
         });
       }
     });

     if (nonResponsiveImages.length > 0) {
       issues.push({
         type: 'oversized_images',
         severity: 'low',
         message: \`Found \${nonResponsiveImages.length} images larger than necessary for viewport\`,
         images: nonResponsiveImages.slice(0, 5)
       });
     }

     return {
       breakpoint: window.innerWidth,
       viewportHeight: window.innerHeight,
       issues,
       summary: {
         critical: issues.filter(i => i.severity === 'critical').length,
         high: issues.filter(i => i.severity === 'high').length,
         medium: issues.filter(i => i.severity === 'medium').length,
         low: issues.filter(i => i.severity === 'low').length
       }
     };
   }
   \`\`\`

7. Analyze the results across all breakpoints:
   - Identify breakpoints with issues
   - Find patterns (issues at all mobile sizes, tablet only, etc.)
   - Determine most critical fixes

${
  testDevices
    ? `
8. Test on specific device configurations:
   For each device (${deviceConfigs.map((d) => d.name).join(', ')}):
   - Resize to exact device dimensions
   - Test same responsive issues
   - Note device-specific problems
`
    : ''
}

Generate comprehensive responsive design report and save to "${reportFile}":

## Mobile Responsive Check Report
**URL**: ${url}
**Breakpoints Tested**: ${breakpoints.length}
**Date**: [timestamp]

### Overall Score: [0-100]

### Summary
- ✅ Fully Responsive: [count] breakpoints
- ⚠️  Minor Issues: [count] breakpoints
- ❌ Major Issues: [count] breakpoints

### Issues by Severity
- 🚨 Critical: [count]
- ⚠️  High: [count]
- 💡 Medium: [count]
- 📝 Low: [count]

### Critical Issues (Fix Immediately)

${breakpoints.some((bp) => bp < 768) ? `
#### Missing/Incorrect Viewport Meta Tag
- **Impact**: Page not mobile-optimized
- **Breakpoints Affected**: All
- **Fix**: Add to <head>:
  \`\`\`html
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  \`\`\`
` : ''}

### Breakpoint Analysis

${breakpoints.map((bp) => `
#### ${bp < 768 ? '📱' : bp < 1024 ? '💻' : '🖥️'} ${bp}px
- **Status**: ✅/⚠️/❌
- **Issues Found**: [count]
- **Critical Problems**:
  ${bp < 768 ? '- Horizontal overflow: [X]px\n  - Touch targets too small: [count]\n  - Text too small to read' : '- [Issues if any]'}
- **Screenshot**: responsive-${bp}px.png
`).join('\n')}

### Detailed Issues

#### Horizontal Overflow 🔄
${breakpoints.filter((bp) => bp < 768).map((bp) => `
- **At ${bp}px**: Content width [X]px exceeds viewport
  - Overflow: [X]px
  - Likely causes:
    - Fixed-width elements
    - Images without max-width
    - Tables without scrolling
    - Long unbreakable text/URLs
  - Fix: Add responsive CSS:
    \`\`\`css
    * { max-width: 100%; }
    img { max-width: 100%; height: auto; }
    \`\`\`
`).join('\n')}

#### Small Touch Targets 👆
- **Count**: [X] interactive elements
- **Examples**:
  1. [Button/Link] - [W]x[H]px (needs 44x44px minimum)
  2. [Next element]
- **Fix**: Increase padding/size:
  \`\`\`css
  button, a {
    min-height: 44px;
    min-width: 44px;
    padding: 12px;
  }
  \`\`\`

#### Small Text 🔤
- **Count**: [X] elements < 16px
- **Examples**: [sample text with sizes]
- **Fix**: Increase base font size:
  \`\`\`css
  body {
    font-size: 16px;
    line-height: 1.5;
  }
  \`\`\`

#### Fixed-Width Elements 📏
- **Count**: [X] elements
- **Examples**:
  1. [div.container] - 1200px fixed width
  2. [Next element]
- **Fix**: Use flexible widths:
  \`\`\`css
  .container {
    max-width: 1200px;
    width: 100%;
  }
  \`\`\`

#### Oversized Images 🖼️
- **Count**: [X] images
- **Fix**: Optimize and make responsive:
  \`\`\`css
  img {
    max-width: 100%;
    height: auto;
  }
  \`\`\`

${testDevices ? `
### Device-Specific Issues

${deviceConfigs.map((device) => `
#### ${device.name} (${device.width}x${device.height})
- Status: ✅/⚠️/❌
- Issues: [list device-specific problems]
`).join('\n')}
` : ''}

### Responsive Design Best Practices
- [ ] Use mobile-first approach
- [ ] Test on real devices, not just DevTools
- [ ] Use responsive images (srcset, picture)
- [ ] Implement responsive typography (clamp, vw units)
- [ ] Test touch interactions
- [ ] Verify form usability on mobile
- [ ] Check navigation works on small screens

### Recommendations (Priority Order)

1. **Fix Horizontal Overflow** - Critical (${breakpoints.filter((bp) => bp < 768).length} mobile breakpoints affected)
2. **Increase Touch Target Sizes** - High ([X] elements)
3. **Optimize Images** - Medium ([X] oversized)
4. **Improve Text Readability** - Low ([X] too small)

### Action Items
- [ ] Add/fix viewport meta tag
- [ ] Remove fixed-width elements
- [ ] Make images responsive
- [ ] Increase touch target sizes
- [ ] Test on physical devices
- [ ] Add responsive design tests to CI/CD

### Testing Checklist
- [ ] Works on iPhone SE (smallest modern phone)
- [ ] Works on iPhone 12/13/14 (common size)
- [ ] Works on iPad (tablet)
- [ ] Works on desktop (1280px+)
- [ ] No horizontal scrolling at any breakpoint
- [ ] All buttons/links easily tappable
- [ ] Text readable without zooming
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
        'mcp__chrome-devtools__take_screenshot',
        'mcp__chrome-devtools__take_snapshot',
        'mcp__chrome-devtools__resize_page',
        'mcp__chrome-devtools__evaluate_script',
        'mcp__chrome-devtools__wait_for',
        'Write',
        'TodoWrite',
      ],
      permissionMode: 'acceptEdits',
      maxTurns: 50,
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
        console.log('📊 Responsive Check Complete');
        console.log('='.repeat(60));
        console.log(`\nDuration: ${(message.duration_ms / 1000).toFixed(2)}s`);
        console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`\n📄 Report: ${reportFile}`);

        if (message.result) {
          console.log('\n' + message.result);
        }
      }
    }
  }
}

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
📱 Chrome Mobile Responsive Checker

Usage:
  bun run agents/chrome-mobile-responsive-checker.ts <url> [options]

Arguments:
  url                     Website URL to test

Options:
  --breakpoints <list>    Comma-separated widths (default: 320,375,414,768,1024,1280,1920)
  --devices               Test specific device configurations
  --report <file>         Output file (default: responsive-check-report.md)
  --help                  Show this help

Examples:
  bun run agents/chrome-mobile-responsive-checker.ts https://example.com
  bun run agents/chrome-mobile-responsive-checker.ts https://example.com --devices
  bun run agents/chrome-mobile-responsive-checker.ts https://example.com --breakpoints 320,768,1920
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
  console.error('❌ Error: Invalid URL');
  process.exit(1);
}

const options: ResponsiveOptions = {
  url,
  testDevices: args.includes('--devices'),
};

for (let i = 1; i < args.length; i++) {
  switch (args[i]) {
    case '--breakpoints':
      const bpArg = args[++i];
      if (bpArg) options.breakpoints = bpArg.split(',').map(Number);
      break;
    case '--report':
      options.reportFile = args[++i];
      break;
  }
}

checkResponsive(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
