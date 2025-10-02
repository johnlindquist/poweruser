#!/usr/bin/env bun

/**
 * Storybook Coverage Keeper Agent
 *
 * A practical everyday agent that keeps component libraries fully exercised in Storybook:
 * - Detects framework (React, Vue, Svelte) and Storybook configuration automatically
 * - Maps UI components to existing stories and flags missing or outdated coverage
 * - Checks CSF/MDX stories for interaction tests, controls, and accessibility annotations
 * - Highlights flaky or duplicate stories and suggests consolidation opportunities
 * - Generates coverage heatmaps (by directory, component type, and story variants)
 * - Offers ready-to-commit story stubs that follow the project's coding style
 * - Integrates with CI by exporting a markdown report and optional JSON summary for dashboards
 * - Perfect for teams who need confidence that every reusable component has a quality Storybook presence
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { parseArgs } from 'util';

interface StorybookCoverageOptions {
  projectPath: string;
  storyDirs: string[];
  componentGlobs: string[];
  reportFile: string;
  autoStub: boolean;
  focusComponent?: string;
  includeMdx: boolean;
}

function getOptions(): StorybookCoverageOptions {
  const { positionals, values } = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: {
      'stories-dir': { type: 'string' },
      'component-globs': { type: 'string' },
      'report': { type: 'string' },
      'component': { type: 'string' },
      'auto-stub': { type: 'boolean' },
      'no-mdx': { type: 'boolean' },
    },
  });

  const projectPath = positionals[0] || process.cwd();
  const storyDirValue = values['stories-dir'] as string | undefined;
  const componentGlobValue = values['component-globs'] as string | undefined;
  const reportValue = values['report'] as string | undefined;
  const focusComponent = values['component'] as string | undefined;

  return {
    projectPath,
    storyDirs: storyDirValue
      ? storyDirValue.split(',').map((value) => value.trim()).filter(Boolean)
      : ['src', 'apps'],
    componentGlobs: componentGlobValue
      ? componentGlobValue.split(',').map((value) => value.trim()).filter(Boolean)
      : [
          'src/components/**/*.{tsx,ts,jsx,js,vue,svelte}',
          'src/ui/**/*.{tsx,ts,jsx,js,vue,svelte}',
        ],
    reportFile: reportValue || 'storybook-coverage-report.md',
    autoStub: values['auto-stub'] === true,
    focusComponent,
    includeMdx: values['no-mdx'] !== true,
  };
}

async function main() {
  const options = getOptions();

  console.log('📚 Storybook Coverage Keeper');
  console.log(`📁 Project: ${options.projectPath}`);
  console.log(`📄 Report: ${options.reportFile}`);
  console.log(`📂 Story directories: ${options.storyDirs.join(', ')}`);
  console.log(`🎯 Component globs: ${options.componentGlobs.join(', ')}`);
  if (options.focusComponent) {
    console.log(`🔍 Focus component: ${options.focusComponent}`);
  }
  console.log(`🧩 Include MDX stories: ${options.includeMdx ? 'Yes' : 'No'}`);
  console.log(`🛠️  Auto-stub missing stories: ${options.autoStub ? 'Enabled' : 'Disabled'}`);
  console.log('');

  const systemPrompt = `You are the Storybook Coverage Keeper, an expert agent that audits component libraries to ensure Storybook completeness and quality.`;

  const prompt = `Project root: ${options.projectPath}
Story directories to inspect: ${options.storyDirs.join(', ') || '(auto-detect)'}
Component glob patterns: ${options.componentGlobs.join(', ')}
Target component: ${options.focusComponent ?? 'All components'}
Auto stub missing stories: ${options.autoStub ? 'Yes' : 'No'}
Include MDX stories: ${options.includeMdx ? 'Yes' : 'No'}
Output report path: ${options.reportFile}

Objectives:
1. Detect Storybook configuration:
   - Locate main.js, manager.js, preview.js/ts files under .storybook/ or packages/*/.storybook/
   - Determine framework (React, Vue, Svelte, Web Components) and Storybook version
   - Identify story file naming patterns (CSF *.stories.tsx, *.stories.jsx, *.mdx)

2. Discover components:
   - Use Glob to enumerate components using the provided patterns
   - Filter out utility files (index.ts, barrel exports, test files, story files themselves)
   - Capture component meta data (path, exported component names, presence of default export)
   - When a specific component is requested, limit to files matching its name

3. Map stories to components:
   - Find all story files (*.stories.* and *.mdx if enabled)
   - Read story files to identify the component they reference (default export component, Meta object, import path)
   - Detect duplicate stories pointing to the same component from multiple locations
   - Flag stories that import non-existent components or reference removed props

4. Compute coverage insights:
   - Percentage of components with at least one story
   - Components missing stories, grouped by directory and priority (shared/ui > feature-specific)
   - Components with outdated stories (props mismatched, missing controls, interactions lacking play function)
   - Identify stories missing accessibility annotations (a11y addon), docs, or args tables
   - Summarize story density (stories per component, average number of variants)

5. Generate a markdown report saved to ${options.reportFile} with sections:
   # Storybook Coverage Report
   - Executive summary with coverage percentages and key risks
   - Coverage heatmap table (directory vs coverage %)
   - Missing stories section with actionable next steps
   - Outdated or flaky stories section with remediation guidance
   - Optional JSON appendix (embedded in fenced code block) that CI/CD can parse

6. If auto-stub is ${options.autoStub ? 'enabled' : 'disabled'}:
   ${options.autoStub ? `- Create CSF3 story stubs for missing components next to the component file (ComponentName.stories.tsx)
     Template requirements:
       * Default export with title derived from folder structure (e.g., "Components/Button")
       * Component import using relative path
       * Primary story with basic args example
       * Annotate with component-level parameters for controls and a11y
       * Respect existing project conventions (TypeScript vs JavaScript, strict mode, addons)
     - Use Write or MultiEdit to create new story files, avoiding overwriting existing stories
     - Provide TODO comments for authors to flesh out details` : '- Provide recommended file paths and stub templates but do not create files'}

7. Cross-check prop coverage:
   - Compare component prop definitions (TS interfaces, PropTypes, JS docs) with story args/controls
   - Highlight props lacking coverage or stories missing essential variations
   - Suggest new stories for edge cases (error states, loading states, responsive variants)

Execution guidelines:
- Use Glob for discovering files, Grep for quick matching, and Read for deeper analysis
- Prefer minimal file writes; never overwrite existing handcrafted stories
- When writing stubs, adhere to Prettier/eslint configuration if detected
- Surface any blockers (missing Storybook config, monorepo boundaries) in the report

Deliverables:
- Progress updates streamed to the user
- Markdown report written to ${options.reportFile}
- If auto-stub enabled, create new story files and summarize them in the report
- Celebrate completion with coverage metrics
`;

  try {
    const result = query({
      prompt,
      options: {
        cwd: options.projectPath,
        systemPrompt,
        allowedTools: [
          'Glob',
          'Grep',
          'Read',
          'Write',
          'Edit',
          'MultiEdit'
        ],
        permissionMode: 'bypassPermissions',
        model: 'sonnet',
      }
    });

    for await (const message of result) {
      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if (block.type === 'text') {
            console.log(block.text);
          }
        }
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          console.log('\n✅ Storybook coverage analysis complete!');
          console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
          console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`📊 Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);

          if (message.result) {
            console.log('\n' + message.result);
          }

          console.log(`\n📄 Report saved to: ${options.reportFile}`);
          if (options.autoStub) {
            console.log('🪄 Story stubs generated for missing coverage. Review them before committing.');
          } else {
            console.log('💡 Run with --auto-stub to scaffold missing stories automatically.');
          }
        } else {
          console.error('\n❌ Storybook coverage analysis failed:', message.subtype);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error running Storybook Coverage Keeper:', error);
    process.exit(1);
  }
}

main();
