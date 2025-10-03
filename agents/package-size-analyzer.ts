#!/usr/bin/env -S bun run

/**
 * Package Size Analyzer Agent
 */

import { resolve } from 'node:path';
import { claude, getPositionals, parsedArgs, readStringFlag } from './lib';
import type { ClaudeFlags, Settings } from './lib';

const DEFAULT_REPORT = 'BUNDLE_ANALYSIS.md';

function printHelp(): void {
  console.log(`
📦 Package Size Analyzer

Usage:
  bun run agents/package-size-analyzer.ts [project-path]

Options:
  --report <file>   Output report filename (default: ${DEFAULT_REPORT})
  --help, -h        Show this help message
`);
}

const positionals = getPositionals();
const values = parsedArgs.values as Record<string, unknown>;

const help = values.help === true || values.h === true;
if (help) {
  printHelp();
  process.exit(0);
}

const projectPath = positionals[0] ? resolve(positionals[0]!) : process.cwd();
const reportFile = readStringFlag('report') ?? DEFAULT_REPORT;

console.log('=📦 Package Size Analyzer');
console.log(`=📦 Project: ${projectPath}`);
console.log('');

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

6. Generate a markdown report saved as '${reportFile}' with this structure:[...trimmed for brevity...]`;

const claudeSettings: Settings = {};

const allowedTools = [
  'Read',
  'Write',
  'TodoWrite',
  'Grep',
  'WebSearch',
  'WebFetch',
];

const defaultFlags: ClaudeFlags = {
  model: 'claude-sonnet-4-5-20250929',
  settings: JSON.stringify(claudeSettings),
  allowedTools: allowedTools.join(' '),
  'permission-mode': 'acceptEdits',
  'append-system-prompt': systemPrompt,
};

claude(prompt, defaultFlags)
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
