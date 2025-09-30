#!/usr/bin/env bun

/**
 * Codebase Time Machine Agent
 *
 * An outside-the-box agent that reconstructs your application's complete state at any point in history:
 * - Uses git history, runtime logs, and code analysis to "replay" development timeline
 * - Visualizes exactly when and why bugs were introduced with full context
 * - Shows the evolution of architectural decisions and feature development
 * - Helps debug time-sensitive issues by understanding what changed between working and broken states
 * - Generates interactive timelines showing how files, functions, and patterns evolved
 * - Identifies the "blast radius" of changes by showing what was affected
 * - Perfect for understanding legacy code decisions and debugging production issues
 *
 * Usage:
 *   bun run agents/codebase-time-machine.ts [options]
 *   bun run agents/codebase-time-machine.ts --bug "authentication fails after login"
 *   bun run agents/codebase-time-machine.ts --file src/auth.ts --when "2024-01-15"
 *   bun run agents/codebase-time-machine.ts --compare "v1.2.0" "v1.3.0"
 *   bun run agents/codebase-time-machine.ts --blame --pattern "memory leak"
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

interface TimeMachineOptions {
  mode?: 'bug-detective' | 'evolution' | 'comparison' | 'blame';
  bug?: string;
  file?: string;
  pattern?: string;
  when?: string;
  compareFrom?: string;
  compareTo?: string;
  outputPath?: string;
  includeBlastRadius?: boolean;
}

async function runCodebaseTimeMachine(options: TimeMachineOptions) {
  const {
    mode = 'bug-detective',
    bug,
    file,
    pattern,
    when,
    compareFrom,
    compareTo,
    outputPath = './TIME_MACHINE_REPORT.md',
    includeBlastRadius = true,
  } = options;

  console.log('⏰ Codebase Time Machine Agent\n');
  console.log(`Mode: ${mode}`);
  if (bug) console.log(`Bug: ${bug}`);
  if (file) console.log(`File: ${file}`);
  if (pattern) console.log(`Pattern: ${pattern}`);
  if (when) console.log(`Time Point: ${when}`);
  if (compareFrom && compareTo) console.log(`Comparison: ${compareFrom} -> ${compareTo}`);
  console.log(`Output: ${outputPath}\n`);

  let prompt = '';

  switch (mode) {
    case 'bug-detective':
      prompt = generateBugDetectivePrompt(bug, file, pattern, outputPath, includeBlastRadius);
      break;
    case 'evolution':
      prompt = generateEvolutionPrompt(file, when, outputPath);
      break;
    case 'comparison':
      prompt = generateComparisonPrompt(compareFrom!, compareTo!, outputPath, includeBlastRadius);
      break;
    case 'blame':
      prompt = generateBlamePrompt(pattern!, outputPath);
      break;
  }

  const queryStream = query({
    prompt,
    options: {
      cwd: process.cwd(),
      model: 'claude-sonnet-4-5-20250929',
      permissionMode: 'acceptEdits',
      maxTurns: 40,

      allowedTools: [
        'Bash',
        'Read',
        'Glob',
        'Grep',
        'Write',
        'TodoWrite'
      ],

      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  if (input.tool_name === 'Bash') {
                    const command = (input.tool_input as any).command || '';
                    if (command.includes('git log')) {
                      console.log('📜 Analyzing git timeline...');
                    } else if (command.includes('git bisect')) {
                      console.log('🔍 Running git bisect...');
                    } else if (command.includes('git blame')) {
                      console.log('👤 Running git blame...');
                    } else if (command.includes('git show')) {
                      console.log('🔎 Examining commit details...');
                    } else if (command.includes('git diff')) {
                      console.log('📊 Comparing code changes...');
                    }
                  } else if (input.tool_name === 'Write') {
                    console.log('✍️  Generating time machine report...');
                  }
                }
                return { continue: true };
              }
            ]
          }
        ],

        PostToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PostToolUse') {
                  if (input.tool_name === 'Write') {
                    const filePath = (input.tool_input as any).file_path;
                    console.log(`✅ Report written to: ${filePath}`);
                  }
                }
                return { continue: true };
              }
            ]
          }
        ]
      }
    }
  });

  let startTime = Date.now();
  let complete = false;

  // Stream results
  for await (const message of queryStream) {
    switch (message.type) {
      case 'assistant':
        // Show assistant progress
        for (const block of message.message.content) {
          if (block.type === 'text') {
            const text = block.text;
            if (text.includes('Found:') || text.includes('Analysis:') || text.includes('Identified:')) {
              console.log(`\n💭 ${text.substring(0, 150)}...`);
            }
          }
        }
        break;

      case 'result':
        complete = true;
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n' + '='.repeat(60));
        if (message.subtype === 'success') {
          console.log('✨ Time Machine Analysis Complete!');
          console.log('='.repeat(60));
          console.log(`📖 Your analysis is ready at: ${outputPath}`);
          console.log(`\n📊 Statistics:`);
          console.log(`   Time: ${elapsedTime}s`);
          console.log(`   Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`   Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);

          if (message.usage.cache_read_input_tokens) {
            console.log(`   Cache hits: ${message.usage.cache_read_input_tokens} tokens`);
          }

          console.log('\n💡 Tip: Use this analysis to understand what changed and why!');
        } else {
          console.log('❌ Error during analysis');
          console.log('='.repeat(60));
          console.log(`Error type: ${message.subtype}`);
        }
        break;

      case 'system':
        if (message.subtype === 'init') {
          console.log('🚀 Initializing Time Machine...');
          console.log(`   Model: ${message.model}`);
          console.log(`   Working Directory: ${message.cwd}\n`);
        }
        break;
    }
  }

  if (!complete) {
    console.log('\n⚠️  Analysis was interrupted.');
  }
}

function generateBugDetectivePrompt(
  bug?: string,
  file?: string,
  pattern?: string,
  outputPath?: string,
  includeBlastRadius?: boolean
): string {
  const target = bug || pattern || 'recent issues';
  const fileScope = file ? ` in ${file}` : '';

  return `You are a Codebase Time Machine in Bug Detective mode. Your mission is to travel through time to identify exactly when and why the bug "${target}" was introduced${fileScope}.

## Your Task

Use git history analysis to reconstruct the timeline and pinpoint the moment when things went wrong.

### Phase 1: Initial Investigation
1. **Gather Recent History**
   - Use Bash: \`git log --since="3 months ago" --pretty=format:"%h|%an|%ad|%s" --date=short\`
   ${file ? `- Get detailed history for ${file}: \`git log --follow --pretty=format:"%h|%an|%ad|%s" --date=short -- "${file}"\`` : ''}
   - Identify commits related to: ${target}
   - Look for keywords: bug, fix, hotfix, regression, revert${pattern ? `, "${pattern}"` : ''}

2. **Identify Suspect Commits**
   - Find commits that touch relevant code areas
   - Look for commits shortly before bug reports or fixes
   - Check for commits with suspicious messages (WIP, temp, quick fix)
   - Identify refactorings or architectural changes in the area

3. **Analyze Change Patterns**
   ${file ? `- Use git blame to see line-by-line history: \`git blame "${file}"\`` : ''}
   - Find when specific code sections were last modified
   - Identify who made the changes and when
   - Look for correlations with reported issues

### Phase 2: Timeline Reconstruction
Create a detailed timeline of events:

1. **The Working State**
   - When was the code last known to be working?
   - What was the state of the code at that point?
   - Use: \`git show <commit>:<file>\` to view old versions

2. **The Breaking Change**
   - Identify the exact commit that introduced the issue
   - Extract the full diff: \`git show <commit>\`
   - Understand what changed and why
   - Read commit messages and related code

3. **The Cascade Effect**${includeBlastRadius ? `
   - Identify all files affected by the breaking change
   - Use: \`git diff --name-only <before-commit> <after-commit>\`
   - Analyze dependencies: what else depends on changed code?
   - Use Grep to find references to changed functions/classes
   - Map out the "blast radius" of the change` : ''}

### Phase 3: Root Cause Analysis
Dig deeper into WHY the bug was introduced:

1. **Code Analysis**
   - Use Read to examine the current buggy code
   - Compare it to the working version
   - Identify the logical error or missing edge case
   - Look for assumptions that became invalid

2. **Context Gathering**
   - Was this part of a larger refactoring?
   - Were there time pressures (check commit times)?
   - Were there multiple authors involved?
   - Check for incomplete features or TODOs

3. **Pattern Recognition**
   - Is this a recurring pattern?
   - Search for similar bugs: \`git log --all --grep="<similar keywords>"\`
   - Have similar mistakes been made before?

### Phase 4: Generate Report
Create a comprehensive report at ${outputPath} with:

#### Bug Detective Report: ${target}

**Executive Summary**
- One paragraph summary of what happened

**Timeline of Events**
\`\`\`
📅 YYYY-MM-DD | Code was working (commit: abc123)
---
⚠️  YYYY-MM-DD | Breaking change introduced (commit: def456)
   Author: Name
   Message: "commit message"
   Files changed: X files
---
🐛 YYYY-MM-DD | Bug likely manifested
---
🔍 YYYY-MM-DD | Investigation began
\`\`\`

**The Breaking Change**
- Commit hash and full message
- Code diff highlighting the problematic change
- Author and timestamp
- What was modified

**Root Cause Analysis**
- Explain exactly what went wrong
- Show the logical error or edge case
- Explain why it wasn't caught earlier
- Discuss the context and pressures

${includeBlastRadius ? `**Blast Radius**
- List all files affected by the change
- Identify dependent code that may also be broken
- Suggest other areas to check` : ''}

**The Fix**
- Recommend how to fix the issue
- Suggest how to prevent similar issues
- Reference if this has been fixed before

**Lessons Learned**
- What can we learn from this bug?
- What processes could prevent it?
- Are there related areas of concern?

## Guidelines
- Be thorough and use actual git data
- Include specific commit hashes for all references
- Show relevant code snippets with context
- Format dates consistently (YYYY-MM-DD)
- Be objective about root causes
- Make actionable recommendations

Start your investigation now!`;
}

function generateEvolutionPrompt(file?: string, when?: string, outputPath?: string): string {
  const target = file || 'the entire codebase';
  const timePoint = when || 'its full history';

  return `You are a Codebase Time Machine in Evolution mode. Show how ${target} evolved over ${timePoint}.

## Your Task

Create a detailed evolution report showing how code changed over time.

### Phase 1: Gather Evolution Data
1. **Timeline Construction**
   ${file ? `- Get complete file history: \`git log --follow --pretty=format:"%h|%an|%ad|%s" --date=short -- "${file}"\`` : '- Get repository history: \`git log --all --pretty=format:"%h|%an|%ad|%s" --date=short\`'}
   ${when ? `- Focus on time period around: ${when}` : ''}
   - Identify major milestones and changes
   - Track version tags: \`git tag -l --sort=-version:refname\`

2. **Change Analysis**
   ${file ? `- For each major commit, get the diff: \`git show <commit> -- "${file}"\`` : '- Identify files with most changes: \`git log --name-only --pretty=format: | sort | uniq -c | sort -rn | head -20\`'}
   - Look for refactorings, features, and bug fixes
   - Track complexity growth
   - Identify architectural shifts

3. **Pattern Evolution**
   - How did coding patterns change?
   - What technologies were adopted/deprecated?
   - How did testing strategies evolve?
   ${file ? `- Use git blame to see line-by-line evolution: \`git blame "${file}"\`` : ''}

### Phase 2: Create Evolution Report
Generate a comprehensive report at ${outputPath} with:

#### Evolution Report: ${target}

**Timeline Visualization**
Create a visual timeline showing major changes

**Key Milestones**
For each major change:
- What changed
- When it changed (commit hash, date, author)
- Why it changed (infer from commits)
- Impact on the codebase

**Code Growth & Complexity**
- Track line count over time
- Identify periods of rapid change
- Show complexity trends

**Pattern Evolution**
- Document how patterns emerged and changed
- Show technology adoption
- Highlight paradigm shifts

**Current State**
- Where are we now?
- What's the legacy of past decisions?
- What technical debt remains from history?

Start the evolution analysis now!`;
}

function generateComparisonPrompt(
  from: string,
  to: string,
  outputPath?: string,
  includeBlastRadius?: boolean
): string {
  return `You are a Codebase Time Machine in Comparison mode. Compare the codebase state between ${from} and ${to}.

## Your Task

Create a detailed comparison report showing what changed between two points in time.

### Phase 1: Gather Comparison Data
1. **Basic Comparison**
   - Get list of changed files: \`git diff --name-status ${from} ${to}\`
   - Count changes: \`git diff --stat ${from} ${to}\`
   - Get commit log: \`git log ${from}..${to} --pretty=format:"%h|%an|%ad|%s" --date=short\`

2. **Detailed Analysis**
   - For major changed files, get full diff: \`git diff ${from} ${to} -- <file>\`
   - Identify new files added
   - Identify files deleted
   - Identify files with significant changes

3. **Architectural Changes**
   - Look for structural changes (new directories, moved files)
   - Identify dependency changes (package.json, requirements.txt, etc.)
   - Find configuration changes
   - Look for new patterns or paradigms

### Phase 2: Impact Analysis${includeBlastRadius ? `
1. **Blast Radius Calculation**
   - For each major change, identify affected areas
   - Use Grep to find dependencies
   - Map out interconnected changes
   - Identify high-risk changes

2. **Risk Assessment**
   - Which changes are most likely to cause issues?
   - What areas need extra testing?
   - Are there breaking changes?` : ''}

### Phase 3: Generate Comparison Report
Create a comprehensive report at ${outputPath} with:

#### Comparison Report: ${from} → ${to}

**Summary**
- Total commits: X
- Files changed: Y
- Lines added/removed: Z

**Major Changes**
List and explain significant changes

**New Features**
What new capabilities were added?

**Bug Fixes**
What was fixed?

**Refactorings**
What was restructured?

**Breaking Changes**
What might break existing functionality?

${includeBlastRadius ? `**Blast Radius Map**
Show interconnected changes and risks` : ''}

**Recommendations**
- What should be tested?
- What should be monitored?
- What needs documentation?

Start the comparison analysis now!`;
}

function generateBlamePrompt(pattern: string, outputPath?: string): string {
  return `You are a Codebase Time Machine in Blame mode. Find when and where the pattern "${pattern}" was introduced into the codebase.

## Your Task

Track down all instances of the pattern and determine their origin story.

### Phase 1: Search & Discovery
1. **Find All Instances**
   - Use Grep to find all occurrences of "${pattern}"
   - Record file paths and line numbers
   - Get surrounding context

2. **Blame Analysis**
   - For each file with matches, run git blame
   - Use: \`git blame -L <start>,<end> <file>\` for relevant sections
   - Identify when each instance was added
   - Record authors and commits

3. **Commit Investigation**
   - For each blame result, examine the full commit
   - Use: \`git show <commit>\` to see context
   - Understand why the pattern was introduced

### Phase 2: Pattern History Report
Generate a comprehensive report at ${outputPath} with:

#### Pattern Investigation: "${pattern}"

**Discovery Summary**
- Total occurrences: X
- First introduced: YYYY-MM-DD (commit: abc123)
- Files affected: Y
- Main contributors: [names]

**Origin Story**
- When was it first introduced?
- Who introduced it and why?
- What problem was it solving?
- How did it spread through the codebase?

**Instance Breakdown**
For each file:
- File path
- Line numbers
- When added (commit + date)
- Author
- Original context/purpose

**Evolution**
- How has usage of this pattern evolved?
- Is it being added or removed over time?
- Are there variations?

**Recommendations**
- Should this pattern be used more or less?
- Are there better alternatives?
- Should it be refactored?

Start the pattern investigation now!`;
}

// CLI interface
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
⏰ Codebase Time Machine

Travel through your codebase history to understand what changed and why!

Usage:
  bun run agents/codebase-time-machine.ts [options]

Modes:
  --bug <description>        Bug Detective: Find when/why a bug was introduced
  --evolution                Evolution: Show how code evolved over time
  --compare <from> <to>      Comparison: Compare two points in time
  --blame --pattern <text>   Blame: Track when/where a pattern was introduced

Options:
  --file <path>              Focus on specific file
  --when <date>              Time point for evolution mode
  --pattern <text>           Pattern to search for
  --output <path>            Output file (default: ./TIME_MACHINE_REPORT.md)
  --no-blast-radius          Skip blast radius analysis
  --help, -h                 Show this help

Examples:
  # Find when a bug was introduced
  bun run agents/codebase-time-machine.ts --bug "login fails after password reset"

  # Show file evolution
  bun run agents/codebase-time-machine.ts --evolution --file src/auth.ts

  # Compare two versions
  bun run agents/codebase-time-machine.ts --compare v1.2.0 v1.3.0

  # Track pattern introduction
  bun run agents/codebase-time-machine.ts --blame --pattern "TODO: refactor"

  # Bug detective for specific file
  bun run agents/codebase-time-machine.ts --bug "memory leak" --file src/cache.ts
  `);
  process.exit(0);
}

// Parse options
const options: TimeMachineOptions = {
  includeBlastRadius: true,
  outputPath: './TIME_MACHINE_REPORT.md',
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--bug':
      options.mode = 'bug-detective';
      options.bug = args[++i];
      break;
    case '--evolution':
      options.mode = 'evolution';
      break;
    case '--compare':
      options.mode = 'comparison';
      options.compareFrom = args[++i];
      options.compareTo = args[++i];
      break;
    case '--blame':
      options.mode = 'blame';
      break;
    case '--file':
      options.file = args[++i];
      break;
    case '--pattern':
      options.pattern = args[++i];
      break;
    case '--when':
      options.when = args[++i];
      break;
    case '--output':
      options.outputPath = args[++i];
      break;
    case '--no-blast-radius':
      options.includeBlastRadius = false;
      break;
  }
}

// Validate mode-specific requirements
if (options.mode === 'comparison' && (!options.compareFrom || !options.compareTo)) {
  console.error('❌ Error: --compare requires two arguments (from and to)\n');
  console.log('Run with --help for usage information');
  process.exit(1);
}

if (options.mode === 'blame' && !options.pattern) {
  console.error('❌ Error: --blame requires --pattern\n');
  console.log('Run with --help for usage information');
  process.exit(1);
}

// Run the time machine
runCodebaseTimeMachine(options).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
