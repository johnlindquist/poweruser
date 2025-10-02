#!/usr/bin/env -S bun run

/**
 * Career Momentum Visualizer
 *
 * Analyzes your git history to create a visual developer growth story.
 * Shows productivity patterns, skill evolution, and generates interview-ready talking points.
 *
 * Usage:
 *   bun run agents/career-momentum-visualizer.ts [path-to-repo]
 *
 * Features:
 * - Analyzes commit history over the past year
 * - Identifies flow state periods vs learning phases
 * - Detects skill evolution and technology adoption
 * - Creates visualizations of your growth trajectory
 * - Generates interview-ready talking points
 * - Suggests optimal times for deep work vs shipping features
 */

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

const SYSTEM_PROMPT = `
You are an expert at analyzing git history and identifying developer growth patterns.
You understand productivity psychology and can identify flow states, learning phases, and growth indicators.
You're encouraging and frame everything positively while providing honest, actionable insights.
You create beautiful, well-formatted reports that developers will be proud to share.
`.trim();

function printHelp(): void {
  console.log(`
🚀 Career Momentum Visualizer

Usage:
  bun run agents/career-momentum-visualizer.ts [repo-path]

Arguments:
  repo-path            Path to repository (default: current directory)

Options:
  --help, -h           Show this help

Description:
  Analyzes git history to create a visual developer growth story with:
  - Commit history analysis over the past year
  - Flow state periods vs learning phases
  - Skill evolution and technology adoption
  - Growth trajectory visualizations
  - Interview-ready talking points
  - Optimal deep work vs shipping times

Output:
  Generates ~/career-momentum-report.html with comprehensive analysis
  `);
}

const { values, positionals } = parsedArgs;
const help = values.help === true || values.h === true;

if (help) {
  printHelp();
  process.exit(0);
}

const repoPath = positionals[0] || process.cwd();
const absolutePath = resolve(repoPath);

console.log('🚀 Career Momentum Visualizer');
console.log('📊 Analyzing your developer journey...\n');
console.log(`Repository: ${absolutePath}\n`);

const prompt = `Analyze the git history of the repository at "${absolutePath}" and create a comprehensive developer growth story.

Follow these steps:

1. **Git History Analysis** (use Bash tool):
   - Get commit history for the past year: git log --since="1 year ago" --pretty=format:"%H|%an|%ae|%ad|%s" --date=iso --numstat
   - Get weekly commit frequency: git log --since="1 year ago" --pretty=format:"%ad" --date=format:"%Y-%W" | sort | uniq -c
   - Get commits by day of week: git log --since="1 year ago" --pretty=format:"%ad" --date=format:"%u" | sort | uniq -c
   - Get commits by hour of day: git log --since="1 year ago" --pretty=format:"%ad" --date=format:"%H" | sort | uniq -c
   - Get file types changed most: git log --since="1 year ago" --name-only --pretty=format: | grep -E '\\.[a-z]+$' | sort | uniq -c | sort -rn | head -20
   - Get contributor stats: git shortlog -sn --since="1 year ago"

2. **Technology & Skill Detection** (use Bash/Grep):
   - Identify languages used: Look at file extensions in git history
   - Find frameworks/libraries: Search package.json, requirements.txt, go.mod, Cargo.toml, etc.
   - Detect new technologies adopted: Compare first and last 3 months of commits

3. **Pattern Analysis**:
   Analyze the data to identify:
   - **Flow State Periods**: Weeks with high commit frequency and consistent daily patterns
   - **Learning Phases**: Periods with smaller commits, more experimental changes, lots of file additions
   - **Grinding Periods**: High commit volume but smaller changes, likely maintenance work
   - **Peak Productivity Times**: Most common hours and days for commits
   - **Skill Evolution**: New file types, frameworks, or patterns that appeared over time

4. **Web Research** (use WebSearch):
   - Search for current trends in the developer's primary tech stack
   - Find information about major frameworks/libraries used to contextualize their work
   - Look up best practices in their domain (if identifiable)

5. **Generate Comprehensive Report** (use Write):
   Create a beautiful HTML report: ~/career-momentum-report.html

   The report should include:

   **Executive Summary**
   - Overall productivity score (based on consistency and output)
   - Primary technologies and expertise areas
   - Key achievements and growth moments
   - Career trajectory assessment

   **Visual Timeline**
   Use ASCII or text-based charts showing:
   - Commit activity over the past year (monthly bars)
   - Technology adoption timeline
   - Productivity heatmap (day of week × hour of day)

   **Period Analysis**
   Break the year into quarters and describe:
   - What technologies were used
   - Commit patterns (flow/learning/grinding)
   - Notable achievements or changes
   - Growth indicators

   **Productivity Insights**
   - Best days and times for coding
   - Average commits per week
   - Longest streaks of activity
   - Patterns in commit sizes and types

   **Skill Evolution**
   - Technologies mastered or adopted
   - Areas of deepening expertise
   - New domains explored
   - Recommendations for continued growth

   **Interview Talking Points**
   Generate 5-7 compelling bullet points like:
   - "Led the migration from X to Y, completing 50+ commits over 2 months"
   - "Demonstrated consistent growth in [skill], with increasing complexity of changes"
   - "Maintained high productivity with 85% of commits during optimal flow state hours"

   **Actionable Recommendations**
   - Optimal schedule for deep work vs shipping features
   - Technologies to learn next based on current trajectory
   - Patterns to optimize (e.g., "commit more frequently" or "break down large changes")

   **Career Momentum Score**: X/10 with explanation

   Use good HTML/CSS styling to make it visually appealing with charts, colors, and sections.

6. **Summary Output**:
   Print to console:
   - Total commits analyzed
   - Date range
   - Primary technologies found
   - Top 3 insights
   - Path to generated report

Remember: Be encouraging and positive. Frame everything as growth and achievement. Make the developer feel proud of their work while providing actionable insights.`;

// Change to repository directory if specified
if (absolutePath !== process.cwd()) {
  process.chdir(absolutePath);
}

const settings: Settings = {};

const allowedTools = [
  "Bash",
  "Read",
  "Grep",
  "Glob",
  "WebSearch",
  "Write",
  "TodoWrite",
];

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
  "append-system-prompt": SYSTEM_PROMPT,
};

console.log('📈 Analysis in progress...\n');

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log('\n✅ Career momentum analysis complete!');
    console.log(`\n📊 Report generated at: ~/career-momentum-report.html`);
    console.log(`\nOpen the report in your browser to see your full developer story.\n`);
  }
  process.exit(exitCode);
} catch (error) {
  console.error('\n❌ Error analyzing career momentum:', error);
  process.exit(1);
}
