#!/usr/bin/env bun

/**
 * Interview Prep Autopilot Agent
 *
 * An outside-the-box agent that transforms your GitHub profile into personalized interview preparation materials:
 * - Analyzes your repositories to identify your strongest technical skills and projects
 * - Generates STAR method stories from your most significant commits and PRs
 * - Creates technical interview questions based on your actual codebase experience
 * - Builds a "portfolio presentation" script for walking through your best work
 * - Identifies knowledge gaps based on job descriptions you're targeting
 * - Generates behavioral interview answers that reference your real projects
 * - Creates a "brag document" with quantified achievements extracted from commit history
 * - Perfect for developers who struggle to articulate their experience in interviews
 *
 * This transforms your GitHub activity into interview confidence in under 2 minutes.
 *
 * Usage:
 *   bun run agents/interview-prep-autopilot.ts [options]
 *
 * Options:
 *   --github <username>     Your GitHub username (required)
 *   --job-url <url>         URL of job description to tailor prep for
 *   --role <title>          Target role (e.g., "Senior Backend Engineer")
 *   --repo <name>           Focus on specific repository
 *   --output <path>         Output directory (default: ./interview-prep)
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { resolve } from 'path';
import { parseArgs } from 'util';

interface InterviewPrepOptions {
  githubUsername: string;
  jobUrl?: string;
  targetRole?: string;
  focusRepo?: string;
  outputDir: string;
}

async function generateInterviewPrep(options: InterviewPrepOptions) {
  const { githubUsername, jobUrl, targetRole, focusRepo, outputDir } = options;

  console.log('🎯 Interview Prep Autopilot Starting...\n');
  console.log(`👤 GitHub: @${githubUsername}`);
  if (targetRole) console.log(`🎯 Target Role: ${targetRole}`);
  if (jobUrl) console.log(`📄 Job Description: ${jobUrl}`);
  if (focusRepo) console.log(`📦 Focus Repository: ${focusRepo}`);
  console.log(`📂 Output Directory: ${outputDir}\n`);

  const prompt = buildPrompt(options);

  console.log('🤖 Analyzing your GitHub profile and generating interview materials...\n');

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: `
You are the Interview Prep Autopilot, an expert technical interviewer and career coach who helps developers confidently articulate their experience.

Your mission is to transform a developer's GitHub activity into compelling interview stories and preparation materials.

## Your Approach

### Phase 1: GitHub Profile Analysis
1. **Repository Discovery**: Use Bash with gh CLI to fetch the user's repositories
2. **Commit History Mining**: Analyze git history to find significant contributions
3. **PR Analysis**: Review merged PRs for collaboration and problem-solving examples
4. **Code Quality Assessment**: Evaluate code patterns, architecture decisions, and technical depth
5. **Technology Stack**: Catalog all technologies, frameworks, and tools used

### Phase 2: Achievement Extraction
1. **Quantifiable Metrics**: Extract numbers (lines of code, issues closed, PRs merged, stars, forks)
2. **Technical Challenges**: Identify complex problems solved from commit messages and code
3. **Leadership Examples**: Find instances of code reviews, mentoring, architecture decisions
4. **Impact Stories**: Discover features shipped, bugs fixed, performance improvements
5. **Evolution**: Track skill growth and technology adoption over time

### Phase 3: STAR Story Generation
For each significant contribution, create STAR method stories:
- **Situation**: Set the context (project, team, business need)
- **Task**: Define the problem or goal
- **Action**: Detail your specific contributions and approach
- **Result**: Quantify the impact and outcomes

Generate 8-10 compelling STAR stories covering:
- Technical problem-solving
- System design and architecture
- Debugging and optimization
- Cross-functional collaboration
- Leadership and mentorship
- Learning new technologies
- Handling ambiguity
- Dealing with technical debt

### Phase 4: Technical Interview Questions
Based on actual code, generate likely technical questions:
- "Walk me through your implementation of X in [repo]"
- "Why did you choose [technology] for [project]?"
- "What was the most challenging bug you fixed in [repo]?"
- "How would you improve [specific code] if you could refactor it?"
- System design questions based on actual projects built

### Phase 5: Portfolio Presentation Script
Create a compelling narrative for walking through portfolio projects:
1. **Hook**: Start with the most impressive project
2. **Problem Statement**: Clearly articulate what you were solving
3. **Technical Approach**: Explain architecture, technology choices, trade-offs
4. **Challenges Overcome**: Discuss interesting technical problems
5. **Results & Learning**: Share outcomes and what you learned
6. **Follow-up Points**: Anticipate and prepare for likely follow-up questions

### Phase 6: Knowledge Gap Analysis
If job description provided:
1. Compare required skills with demonstrated GitHub activity
2. Identify skills present but not well-showcased
3. Identify skills missing that need learning
4. Suggest projects or contributions to fill gaps

### Phase 7: Behavioral Interview Prep
Generate answers to common behavioral questions anchored in real projects:
- Tell me about yourself (focusing on GitHub journey)
- Describe a challenging project
- How do you handle disagreement?
- Describe a time you failed
- How do you stay current with technology?

### Phase 8: Brag Document
Create a comprehensive achievement document with:
- Timeline of major contributions
- Projects shipped with impact metrics
- Open source contributions
- Technical skills demonstrated with evidence
- Leadership and collaboration examples
- Learning and growth trajectory

## Tools You'll Use

- **Bash**: Use gh CLI for GitHub data, git commands for commit analysis
- **WebFetch**: Fetch job descriptions and GitHub profiles
- **WebSearch**: Research company info, interview questions for role
- **Read**: Analyze code files for technical depth assessment
- **Grep/Glob**: Search for patterns in code, find architectural decisions
- **Write**: Generate all interview prep documents
- **TodoWrite**: Track progress through analysis phases

## Output Guidelines

Generate comprehensive markdown files in the output directory:

1. **github-analysis.md**: Complete GitHub profile assessment with skills inventory
2. **star-stories.md**: 8-10 detailed STAR method stories ready to use
3. **technical-questions.md**: Likely technical questions with prepared answers
4. **portfolio-presentation.md**: Script for walking through your best work
5. **behavioral-questions.md**: Common behavioral questions with your answers
6. **brag-document.md**: Quantified achievements and impact metrics
7. **knowledge-gaps.md**: Skills to highlight or develop (if job description provided)
8. **interview-cheatsheet.md**: Quick reference guide for interview day
9. **talking-points.md**: Key phrases and stories to weave into answers
10. **README.md**: How to use these materials effectively

## Key Principles

- **Be Specific**: Use real project names, actual metrics, concrete examples
- **Be Authentic**: Stories should reflect actual work, not embellished
- **Be Concise**: Prepare 2-3 minute versions of each story
- **Be Confident**: Frame contributions positively while being honest about learnings
- **Be Prepared**: Anticipate follow-up questions for each story

Remember: Your goal is to help developers confidently articulate the impressive work they've already done, not fabricate experiences.
`
        },
        allowedTools: [
          'Bash',
          'Read',
          'Write',
          'Grep',
          'Glob',
          'WebFetch',
          'WebSearch',
          'TodoWrite'
        ],
        permissionMode: 'acceptEdits',
        includePartialMessages: false,
      },
    })) {
      if (message.type === 'assistant') {
        const content = message.message.content;
        for (const block of content) {
          if (block.type === 'text') {
            console.log(block.text);
          }
        }
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          console.log('\n\n✅ Interview Prep Materials Complete!\n');
          console.log('📊 Summary:');
          console.log(`   Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
          console.log(`   Turns: ${message.num_turns}`);
          console.log(`   Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`   Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);
          console.log(`\n📂 Check ${outputDir}/ for your complete interview prep materials!`);
          console.log('\n🎯 Pro Tips:');
          console.log('   - Practice telling each STAR story out loud');
          console.log('   - Review technical questions and code before interview');
          console.log('   - Keep the cheat sheet open during virtual interviews');
          console.log('   - Remember: You\'ve done impressive work - now showcase it!\n');
        } else {
          console.error('\n❌ Failed to generate interview prep materials');
          if (message.subtype === 'error_max_turns') {
            console.error('Error: Maximum turns reached');
          }
        }
      }
    }
  } catch (error) {
    console.error('\n❌ Error during interview prep generation:', error);
    process.exit(1);
  }
}

function buildPrompt(options: InterviewPrepOptions): string {
  const { githubUsername, jobUrl, targetRole, focusRepo, outputDir } = options;

  return `I need help preparing for technical interviews. Please analyze my GitHub profile and generate comprehensive interview preparation materials.

## Phase 1: Analyze My GitHub Profile

Use Bash with gh CLI to analyze @${githubUsername}'s GitHub profile:

1. List all repositories and identify the most significant ones:
   - Repositories with most commits, stars, or forks
   - Most recently active projects
   - Diversity of technologies and project types
${focusRepo ? `   - Pay special attention to: ${focusRepo}\n` : ''}
2. For the top 3-5 most impressive repositories:
   - Clone or fetch repository details
   - Analyze git log to understand commit history and contributions
   - Review README to understand project purpose and scope
   - Examine code structure and architecture patterns
   - Extract key technologies, frameworks, and tools used
   - Count lines of code, commits, and other metrics

3. Analyze contribution patterns:
   - Review merged pull requests for collaboration examples
   - Check code review activity
   - Look for issue resolutions and bug fixes
   - Identify open source contributions

## Phase 2: Extract Quantifiable Achievements

From the GitHub analysis, extract concrete metrics:
- Total repositories created
- Total commits made
- Pull requests merged
- Issues closed
- Lines of code contributed
- Stars and forks received
- Technologies mastered (list all languages, frameworks, tools)
- Open source projects contributed to
- Years of activity and consistency patterns

## Phase 3: Generate STAR Method Stories

Create 8-10 compelling STAR stories based on real GitHub activity:

For each story, analyze commits, PRs, and code to construct:
- **Situation**: What was the context? (project goals, team size, constraints)
- **Task**: What problem needed solving? (technical challenge, business need)
- **Action**: What did I specifically do? (use commit history and code as evidence)
- **Result**: What was the outcome? (metrics, impact, learnings)

Cover these story types:
1. Complex technical problem-solving (debugging, optimization)
2. System design and architecture decisions
3. Learning and applying new technologies
4. Collaboration and code review
5. Performance improvements or refactoring
6. Handling ambiguous requirements
7. Dealing with technical debt
8. Project from inception to deployment

## Phase 4: Generate Technical Interview Questions

Based on my actual code and projects, create likely technical questions:
- "Walk me through the architecture of [specific project]"
- "Why did you choose [technology X] over [technology Y]?"
- "What was the most challenging bug in [project]?"
- "How would you scale [project] to handle 10x traffic?"
- "Explain your approach to [specific feature] in [repo]"
- Deep-dive questions about specific code I wrote

For each question, provide:
- The likely question
- A prepared 2-3 minute answer referencing my actual work
- Key technical terms and concepts to mention
- Potential follow-up questions and how to handle them

${jobUrl || targetRole
    ? `## Phase 5: Tailor Prep for Target Role

${jobUrl
      ? `1. Fetch and analyze the job description at: ${jobUrl}\n   - Extract all required and preferred skills\n   - Identify key responsibilities\n   - Understand what the company values\n\n`
      : ''
    }${targetRole
      ? `2. Research common interview questions for ${targetRole} role using WebSearch\n   - Find typical technical questions for this role\n   - Identify key skills interviewers assess\n   - Research company-specific interview styles if job URL provided\n\n`
      : ''
    }3. Compare my GitHub skills with role requirements:
   - Skills I have strong evidence for (highlight these!)
   - Skills I have but need to showcase better
   - Skills I should brush up on before interview
   - Gap areas to address honestly if asked

`
    : ''
}## Phase 6: Create Portfolio Presentation Script

Build a compelling narrative for walking through my best work:
1. Opening hook: Start with most impressive achievement
2. For top 3 projects, create presentation scripts:
   - Project overview and motivation (30 seconds)
   - Technical approach and architecture (1 minute)
   - Key challenges and solutions (1 minute)
   - Results and impact (30 seconds)
   - What I learned and would do differently (30 seconds)
3. Transition statements between projects
4. Anticipated follow-up questions with answers

## Phase 7: Prepare Behavioral Interview Answers

Using GitHub activity as evidence, answer these behavioral questions:
- "Tell me about yourself" (focus on my development journey from GitHub)
- "Describe your most challenging project"
- "Tell me about a time you failed or made a mistake"
- "How do you handle disagreement about technical decisions?"
- "Describe a time you had to learn something new quickly"
- "How do you stay current with technology trends?"
- "Tell me about a time you improved a process or system"
- "Describe your approach to code quality and testing"

## Phase 8: Create Brag Document

Compile a comprehensive achievement document:
- Timeline of major contributions and milestones
- Full technology stack with evidence of usage
- All projects with descriptions and impact
- Open source contributions
- Code quality metrics and best practices demonstrated
- Collaboration and leadership examples
- Learning trajectory showing growth
- Unique strengths and differentiators

## Generate All Materials as Markdown Files

Save all interview prep materials in "${outputDir}/":
- github-analysis.md (complete profile assessment)
- star-stories.md (8-10 detailed STAR stories)
- technical-questions.md (likely questions with answers)
- portfolio-presentation.md (scripts for walking through work)
- behavioral-questions.md (behavioral answers with examples)
- brag-document.md (comprehensive achievement list)
${jobUrl || targetRole ? `- knowledge-gaps.md (skills analysis vs job requirements)\n` : ''}- interview-cheatsheet.md (quick reference for interview day)
- talking-points.md (key phrases and stories to use)
- README.md (how to use these materials)

Use TodoWrite to track progress through each phase.

IMPORTANT:
- All stories must be based on real commits, PRs, and code
- Include specific project names, technologies, and metrics
- Make answers conversational and authentic, not scripted
- Prepare for follow-up questions on every point
- Focus on impact and learning, not just technical details
`;
}

// Parse command line arguments
function parseArgsFromArgv(): InterviewPrepOptions {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      github: { type: 'string' },
      'job-url': { type: 'string' },
      role: { type: 'string' },
      repo: { type: 'string' },
      output: { type: 'string', default: './interview-prep' },
    },
    strict: true,
  });

  if (values.help || process.argv.slice(2).length === 0) {
    console.log(`
🎯 Interview Prep Autopilot - Transform GitHub activity into interview confidence

Usage: bun run agents/interview-prep-autopilot.ts [options]

Options:
  --github <username>     Your GitHub username (required)
  --job-url <url>         URL of job description to tailor prep for
  --role <title>          Target role (e.g., "Senior Backend Engineer")
  --repo <name>           Focus on specific repository
  --output <path>         Output directory (default: ./interview-prep)
  --help, -h             Show this help message

Examples:
  # Basic interview prep from GitHub profile
  bun run agents/interview-prep-autopilot.ts --github yourusername

  # Tailored prep for specific job posting
  bun run agents/interview-prep-autopilot.ts --github yourusername --job-url "https://example.com/job"

  # Focus on specific role and repository
  bun run agents/interview-prep-autopilot.ts --github yourusername --role "Staff Engineer" --repo "my-best-project"

  # Complete preparation with custom output directory
  bun run agents/interview-prep-autopilot.ts --github yourusername --job-url "https://example.com/job" --role "Senior Backend Engineer" --output ./acme-interview-prep
`);
    process.exit(0);
  }

  // Validate required arguments
  if (!values.github) {
    console.error('Error: --github <username> is required');
    console.error('Run with --help to see usage examples');
    process.exit(1);
  }

  return {
    githubUsername: values.github as string,
    jobUrl: values['job-url'] as string | undefined,
    targetRole: values.role as string | undefined,
    focusRepo: values.repo as string | undefined,
    outputDir: values.output as string,
  };
}

// Main execution
const options = parseArgsFromArgv();
generateInterviewPrep(options);
