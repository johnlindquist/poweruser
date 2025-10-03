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

  let prompt = `I need help preparing for technical interviews. Please analyze my GitHub profile and generate comprehensive interview preparation materials.\n\n`;

  // Phase 1: GitHub Analysis
  prompt += `## Phase 1: Analyze My GitHub Profile\n\n`;
  prompt += `Use Bash with gh CLI to analyze @${githubUsername}'s GitHub profile:\n\n`;
  prompt += `1. List all repositories and identify the most significant ones:\n`;
  prompt += `   - Repositories with most commits, stars, or forks\n`;
  prompt += `   - Most recently active projects\n`;
  prompt += `   - Diversity of technologies and project types\n`;

  if (focusRepo) {
    prompt += `   - Pay special attention to: ${focusRepo}\n`;
  }

  prompt += `\n2. For the top 3-5 most impressive repositories:\n`;
  prompt += `   - Clone or fetch repository details\n`;
  prompt += `   - Analyze git log to understand commit history and contributions\n`;
  prompt += `   - Review README to understand project purpose and scope\n`;
  prompt += `   - Examine code structure and architecture patterns\n`;
  prompt += `   - Extract key technologies, frameworks, and tools used\n`;
  prompt += `   - Count lines of code, commits, and other metrics\n\n`;

  prompt += `3. Analyze contribution patterns:\n`;
  prompt += `   - Review merged pull requests for collaboration examples\n`;
  prompt += `   - Check code review activity\n`;
  prompt += `   - Look for issue resolutions and bug fixes\n`;
  prompt += `   - Identify open source contributions\n\n`;

  // Phase 2: Extract Achievements
  prompt += `## Phase 2: Extract Quantifiable Achievements\n\n`;
  prompt += `From the GitHub analysis, extract concrete metrics:\n`;
  prompt += `- Total repositories created\n`;
  prompt += `- Total commits made\n`;
  prompt += `- Pull requests merged\n`;
  prompt += `- Issues closed\n`;
  prompt += `- Lines of code contributed\n`;
  prompt += `- Stars and forks received\n`;
  prompt += `- Technologies mastered (list all languages, frameworks, tools)\n`;
  prompt += `- Open source projects contributed to\n`;
  prompt += `- Years of activity and consistency patterns\n\n`;

  // Phase 3: STAR Stories
  prompt += `## Phase 3: Generate STAR Method Stories\n\n`;
  prompt += `Create 8-10 compelling STAR stories based on real GitHub activity:\n\n`;
  prompt += `For each story, analyze commits, PRs, and code to construct:\n`;
  prompt += `- **Situation**: What was the context? (project goals, team size, constraints)\n`;
  prompt += `- **Task**: What problem needed solving? (technical challenge, business need)\n`;
  prompt += `- **Action**: What did I specifically do? (use commit history and code as evidence)\n`;
  prompt += `- **Result**: What was the outcome? (metrics, impact, learnings)\n\n`;

  prompt += `Cover these story types:\n`;
  prompt += `1. Complex technical problem-solving (debugging, optimization)\n`;
  prompt += `2. System design and architecture decisions\n`;
  prompt += `3. Learning and applying new technologies\n`;
  prompt += `4. Collaboration and code review\n`;
  prompt += `5. Performance improvements or refactoring\n`;
  prompt += `6. Handling ambiguous requirements\n`;
  prompt += `7. Dealing with technical debt\n`;
  prompt += `8. Project from inception to deployment\n\n`;

  // Phase 4: Technical Questions
  prompt += `## Phase 4: Generate Technical Interview Questions\n\n`;
  prompt += `Based on my actual code and projects, create likely technical questions:\n`;
  prompt += `- "Walk me through the architecture of [specific project]"\n`;
  prompt += `- "Why did you choose [technology X] over [technology Y]?"\n`;
  prompt += `- "What was the most challenging bug in [project]?"\n`;
  prompt += `- "How would you scale [project] to handle 10x traffic?"\n`;
  prompt += `- "Explain your approach to [specific feature] in [repo]"\n`;
  prompt += `- Deep-dive questions about specific code I wrote\n\n`;

  prompt += `For each question, provide:\n`;
  prompt += `- The likely question\n`;
  prompt += `- A prepared 2-3 minute answer referencing my actual work\n`;
  prompt += `- Key technical terms and concepts to mention\n`;
  prompt += `- Potential follow-up questions and how to handle them\n\n`;

  // Phase 5: Job-Specific Analysis
  if (jobUrl || targetRole) {
    prompt += `## Phase 5: Tailor Prep for Target Role\n\n`;

    if (jobUrl) {
      prompt += `1. Fetch and analyze the job description at: ${jobUrl}\n`;
      prompt += `   - Extract all required and preferred skills\n`;
      prompt += `   - Identify key responsibilities\n`;
      prompt += `   - Understand what the company values\n\n`;
    }

    if (targetRole) {
      prompt += `2. Research common interview questions for ${targetRole} role using WebSearch\n`;
      prompt += `   - Find typical technical questions for this role\n`;
      prompt += `   - Identify key skills interviewers assess\n`;
      prompt += `   - Research company-specific interview styles if job URL provided\n\n`;
    }

    prompt += `3. Compare my GitHub skills with role requirements:\n`;
    prompt += `   - Skills I have strong evidence for (highlight these!)\n`;
    prompt += `   - Skills I have but need to showcase better\n`;
    prompt += `   - Skills I should brush up on before interview\n`;
    prompt += `   - Gap areas to address honestly if asked\n\n`;
  }

  // Phase 6: Portfolio Presentation
  prompt += `## Phase 6: Create Portfolio Presentation Script\n\n`;
  prompt += `Build a compelling narrative for walking through my best work:\n`;
  prompt += `1. Opening hook: Start with most impressive achievement\n`;
  prompt += `2. For top 3 projects, create presentation scripts:\n`;
  prompt += `   - Project overview and motivation (30 seconds)\n`;
  prompt += `   - Technical approach and architecture (1 minute)\n`;
  prompt += `   - Key challenges and solutions (1 minute)\n`;
  prompt += `   - Results and impact (30 seconds)\n`;
  prompt += `   - What I learned and would do differently (30 seconds)\n`;
  prompt += `3. Transition statements between projects\n`;
  prompt += `4. Anticipated follow-up questions with answers\n\n`;

  // Phase 7: Behavioral Questions
  prompt += `## Phase 7: Prepare Behavioral Interview Answers\n\n`;
  prompt += `Using GitHub activity as evidence, answer these behavioral questions:\n`;
  prompt += `- "Tell me about yourself" (focus on my development journey from GitHub)\n`;
  prompt += `- "Describe your most challenging project"\n`;
  prompt += `- "Tell me about a time you failed or made a mistake"\n`;
  prompt += `- "How do you handle disagreement about technical decisions?"\n`;
  prompt += `- "Describe a time you had to learn something new quickly"\n`;
  prompt += `- "How do you stay current with technology trends?"\n`;
  prompt += `- "Tell me about a time you improved a process or system"\n`;
  prompt += `- "Describe your approach to code quality and testing"\n\n`;

  // Phase 8: Brag Document
  prompt += `## Phase 8: Create Brag Document\n\n`;
  prompt += `Compile a comprehensive achievement document:\n`;
  prompt += `- Timeline of major contributions and milestones\n`;
  prompt += `- Full technology stack with evidence of usage\n`;
  prompt += `- All projects with descriptions and impact\n`;
  prompt += `- Open source contributions\n`;
  prompt += `- Code quality metrics and best practices demonstrated\n`;
  prompt += `- Collaboration and leadership examples\n`;
  prompt += `- Learning trajectory showing growth\n`;
  prompt += `- Unique strengths and differentiators\n\n`;

  // Output instructions
  prompt += `## Generate All Materials as Markdown Files\n\n`;
  prompt += `Save all interview prep materials in "${outputDir}/":\n`;
  prompt += `- github-analysis.md (complete profile assessment)\n`;
  prompt += `- star-stories.md (8-10 detailed STAR stories)\n`;
  prompt += `- technical-questions.md (likely questions with answers)\n`;
  prompt += `- portfolio-presentation.md (scripts for walking through work)\n`;
  prompt += `- behavioral-questions.md (behavioral answers with examples)\n`;
  prompt += `- brag-document.md (comprehensive achievement list)\n`;

  if (jobUrl || targetRole) {
    prompt += `- knowledge-gaps.md (skills analysis vs job requirements)\n`;
  }

  prompt += `- interview-cheatsheet.md (quick reference for interview day)\n`;
  prompt += `- talking-points.md (key phrases and stories to use)\n`;
  prompt += `- README.md (how to use these materials)\n\n`;

  prompt += `Use TodoWrite to track progress through each phase.\n\n`;

  prompt += `IMPORTANT:\n`;
  prompt += `- All stories must be based on real commits, PRs, and code\n`;
  prompt += `- Include specific project names, technologies, and metrics\n`;
  prompt += `- Make answers conversational and authentic, not scripted\n`;
  prompt += `- Prepare for follow-up questions on every point\n`;
  prompt += `- Focus on impact and learning, not just technical details\n`;

  return prompt;
}

// Parse command line arguments
function parseArgs(): InterviewPrepOptions {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
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

  let githubUsername: string | undefined;
  let jobUrl: string | undefined;
  let targetRole: string | undefined;
  let focusRepo: string | undefined;
  let outputDir = './interview-prep';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--github':
        if (!nextArg) {
          console.error('Error: --github requires a username');
          process.exit(1);
        }
        githubUsername = nextArg;
        i++;
        break;
      case '--job-url':
        if (!nextArg) {
          console.error('Error: --job-url requires a URL');
          process.exit(1);
        }
        jobUrl = nextArg;
        i++;
        break;
      case '--role':
        if (!nextArg) {
          console.error('Error: --role requires a role title');
          process.exit(1);
        }
        targetRole = nextArg;
        i++;
        break;
      case '--repo':
        if (!nextArg) {
          console.error('Error: --repo requires a repository name');
          process.exit(1);
        }
        focusRepo = nextArg;
        i++;
        break;
      case '--output':
        if (!nextArg) {
          console.error('Error: --output requires a directory path');
          process.exit(1);
        }
        outputDir = nextArg;
        i++;
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
    }
  }

  // Validate required arguments
  if (!githubUsername) {
    console.error('Error: --github <username> is required');
    console.error('Run with --help to see usage examples');
    process.exit(1);
  }

  return {
    githubUsername,
    jobUrl,
    targetRole,
    focusRepo,
    outputDir,
  };
}

// Main execution
const options = parseArgs();
generateInterviewPrep(options);
