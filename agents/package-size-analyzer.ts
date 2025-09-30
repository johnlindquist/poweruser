#!/usr/bin/env bun

/**
 * Package Size Analyzer Agent
 *
 * A tiny quick agent that identifies bundle bloat and suggests optimizations:
 * - Blazingly fast analysis of your package.json and bundle size
 * - Identifies heaviest dependencies and their impact on final bundle size
 * - Suggests lighter alternative packages with similar functionality
 * - Detects duplicate dependencies and version conflicts
 * - Analyzes tree-shaking effectiveness and suggests optimizations
 * - Flags packages that are imported but barely used
 * - Generates before/after comparison if you made suggested changes
 * - Perfect for keeping your web app fast and users happy
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const PROJECT_PATH = process.argv[2] || process.cwd();
const OUTPUT_FILE = 'BUNDLE_ANALYSIS.md';

async function main() {
  console.log('=æ Package Size Analyzer');
  console.log(`=Á Project: ${PROJECT_PATH}`);
  console.log();

  const systemPrompt = `You are a Package Size Analyzer agent that helps developers identify and eliminate bundle bloat.

Your task is to:
1. Analyze the project's dependencies:
   - Read package.json to get all dependencies and devDependencies
   - Check for package-lock.json, yarn.lock, or pnpm-lock.yaml
   - Identify the package manager being used
   - Look for duplicate or conflicting versions

2. Analyze bundle size and usage:
   - Look for build configuration files (webpack.config.js, vite.config.ts, rollup.config.js, etc.)
   - Check if bundle analysis tools are already configured
   - Use Grep to search for import statements to understand which packages are actually used
   - Identify packages that are imported but might be barely used
   - Look for opportunities to use tree-shaking

3. Find the heaviest dependencies:
   - Use WebSearch to look up package sizes on bundlephobia.com or similar services
   - Search for: "bundlephobia [package-name]"
   - Identify the top 10 largest dependencies by bundle size
   - Calculate total dependency weight

4. Suggest optimizations:
   - For each heavy package, use WebSearch to find lighter alternatives
   - Search for: "[package-name] alternatives lightweight"
   - Identify packages that could be replaced with native browser APIs
   - Suggest code-splitting opportunities
   - Recommend lazy loading for large dependencies
   - Identify packages that should be moved to devDependencies

5. Detect issues:
   - Flag duplicate dependencies (same package, different versions)
   - Identify packages with known large bundle sizes (moment.js, lodash without tree-shaking, etc.)
   - Find packages that import entire libraries instead of specific modules
   - Check for outdated packages that might have newer, smaller versions

6. Generate optimization report:
   - Create a comprehensive markdown report with all findings
   - Include before/after size comparisons
   - Provide step-by-step migration guides for suggested alternatives
   - Estimate total bundle size reduction

Use Read to analyze package files, Grep to find import patterns, WebSearch to research package sizes and alternatives, and Write to generate the report.

IMPORTANT:
- Be specific with package size numbers (get them from bundlephobia)
- Provide concrete alternatives, not just generic suggestions
- Consider the trade-offs of switching packages (features, maintenance, community support)
- Include migration difficulty estimates (easy/medium/hard)`;

  const prompt = `Analyze the bundle size and dependencies for this project and suggest optimizations.

Follow these steps:

1. Understand the project setup:
   - Read package.json to get all dependencies
   - Check which package manager is used (npm, yarn, pnpm, bun)
   - Read lock file if present to understand the full dependency tree
   - Look for build tool configuration (webpack, vite, rollup, etc.)

2. Analyze current dependencies:
   - List all production dependencies
   - Use Grep to find import statements across the codebase
   - Identify which packages are actually imported
   - Look for patterns like: import { X } from 'large-package'

3. Research package sizes:
   - For each dependency, WebSearch for: "bundlephobia [package-name]"
   - Get the minified + gzipped size
   - Identify the top 10 heaviest packages
   - Calculate total bundle weight

4. Find optimization opportunities:
   - For heavy packages, WebSearch for alternatives: "[package-name] lightweight alternatives"
   - Identify packages that can be replaced with native APIs
   - Look for opportunities to import specific modules instead of entire packages
   - Check if tree-shaking is properly configured

5. Check for common issues:
   - Flag if moment.js is used (suggest date-fns or dayjs)
   - Flag if full lodash is imported (suggest lodash-es or specific imports)
   - Check for duplicate dependencies in the lock file
   - Identify packages that should be in devDependencies

6. Generate a markdown report saved as '${OUTPUT_FILE}' with this structure:

   # =æ Bundle Size Analysis Report

   > Analysis performed on [date]

   ## =Ê Current State

   ### Package Manager
   [npm/yarn/pnpm/bun]

   ### Total Dependencies
   - **Production:** X packages
   - **Development:** Y packages
   - **Total installed size:** [from lock file if available]

   ### Top 10 Heaviest Packages

   | Package | Version | Size (min+gzip) | Usage Frequency |
   |---------|---------|-----------------|-----------------|
   | [name]  | [ver]   | XXX KB          | [high/med/low]  |
   | ...     | ...     | ...             | ...             |

   **Total weight of top 10:** XXX KB

   ## =¨ Issues Found

   ### Critical (High Impact)
   1. **[Issue Name]**
      - **Problem:** [Description]
      - **Impact:** +XX KB to bundle
      - **Fix difficulty:** [Easy/Medium/Hard]

   [Repeat for 2-5 critical issues]

   ### Moderate (Medium Impact)
   [List 2-3 moderate issues]

   ### Minor (Low Impact)
   [List 1-2 minor issues]

   ## ( Optimization Recommendations

   ### Priority 1: Quick Wins (Easy, High Impact)

   #### Replace [Package A] with [Package B]
   - **Current size:** XXX KB (min+gzip)
   - **New size:** YYY KB (min+gzip)
   - **Savings:** ZZZ KB (XX% reduction)
   - **Migration difficulty:** Easy
   - **Why [Package B] is better:** [Explanation]

   **Migration steps:**
   1. Install replacement: \`npm install [package-b]\`
   2. Update imports: [example]
   3. [Additional steps]

   **Code changes example:**
   \`\`\`typescript
   // Before
   import { feature } from '[package-a]';

   // After
   import { feature } from '[package-b]';
   \`\`\`

   [Repeat for 2-3 quick wins]

   ### Priority 2: Significant Optimizations (Medium effort, High Impact)

   [Similar structure for 2-3 medium-effort optimizations]

   ### Priority 3: Long-term Improvements (High effort, Medium Impact)

   [Similar structure for 1-2 long-term improvements]

   ## =É Projected Savings

   | Optimization | Difficulty | Size Saved | Implementation Time |
   |--------------|------------|------------|---------------------|
   | [Name]       | Easy       | XX KB      | ~30 minutes         |
   | [Name]       | Medium     | YY KB      | ~2 hours            |
   | [Name]       | Hard       | ZZ KB      | ~1 day              |

   **Total potential savings:** XXX KB (XX% reduction)

   ## =' Configuration Improvements

   ### Enable Tree-Shaking
   [If not already enabled, show how to configure it]

   ### Code Splitting Opportunities
   - [Route 1]: Split heavy library X
   - [Route 2]: Lazy load feature Y
   - [Component]: Dynamic import for Z

   ### Import Optimization
   \`\`\`typescript
   // L Bad: Imports entire library
   import _ from 'lodash';

   //  Good: Import only what you need
   import debounce from 'lodash/debounce';
   // or
   import { debounce } from 'lodash-es';
   \`\`\`

   ## =æ Duplicate Dependencies

   [If found, list duplicates and suggest resolution]

   ## <¯ Action Plan

   ### This Week (High Priority)
   - [ ] [Action 1 - Easy win with specific steps]
   - [ ] [Action 2 - Easy win with specific steps]
   - [ ] [Action 3 - Quick configuration change]

   ### This Month (Medium Priority)
   - [ ] [Action 1 - Requires testing]
   - [ ] [Action 2 - Moderate refactoring]

   ### Future (Low Priority)
   - [ ] [Action 1 - Large refactor]
   - [ ] [Action 2 - Nice to have]

   ## =¡ Best Practices

   - Always check bundle impact before adding new dependencies
   - Use bundlephobia.com to compare package sizes
   - Prefer packages with good tree-shaking support
   - Consider native browser APIs before adding polyfills
   - Regularly audit dependencies with tools like \`npx depcheck\`

   ## =Ú Resources

   - [Bundlephobia](https://bundlephobia.com) - Check package sizes
   - [Package Phobia](https://packagephobia.com) - Install size analysis
   - [Webpack Bundle Analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer) - Visualize bundle
   - [Import Cost VS Code Extension](https://marketplace.visualstudio.com/items?itemName=wix.vscode-import-cost) - See import costs in editor

   ---

   **Next Steps:** Start with the quick wins in the action plan. Re-run this analyzer after implementing optimizations to track progress.

Start by reading the project files, then analyze dependencies and generate the comprehensive optimization report.`;

  try {
    const result = query({
      prompt,
      options: {
        cwd: PROJECT_PATH,
        systemPrompt,
        allowedTools: [
          'Read',
          'Glob',
          'Grep',
          'WebSearch',
          'Bash',
          'Write'
        ],
        permissionMode: 'bypassPermissions',
        model: 'sonnet',
      }
    });

    for await (const message of result) {
      if (message.type === 'assistant') {
        // Show assistant thinking/working
        for (const block of message.message.content) {
          if (block.type === 'text') {
            console.log(block.text);
          }
        }
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          console.log('\n Bundle analysis complete!');
          console.log(`ñ  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
          console.log(`=° Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`=Ê Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);

          if (message.result) {
            console.log('\n' + message.result);
          }

          console.log(`\n=Ä Analysis report saved to: ${OUTPUT_FILE}`);
          console.log('=€ Follow the action plan to reduce your bundle size!');
          console.log('=¡ Tip: Re-run after implementing optimizations to track progress');
        } else {
          console.error('\nL Analysis failed:', message.subtype);
        }
      }
    }
  } catch (error) {
    console.error('L Error running Package Size Analyzer:', error);
    process.exit(1);
  }
}

main();
