#!/usr/bin/env bun

/**
 * Career Momentum Builder Agent
 *
 * An outside-the-box agent that helps developers break into tech or accelerate their careers by:
 * - Analyzing job descriptions to identify skill gaps and create personalized learning paths
 * - Suggesting strategic open source contributions that align with career goals
 * - Reviewing GitHub profile, resume, and portfolio projects with actionable improvements
 * - Generating compelling portfolio project ideas that demonstrate real-world problem-solving
 * - Creating content ideas for technical blogs and social media
 * - Building a 90-day action plan with milestones to land your dream role or promotion
 *
 * This transforms career anxiety into momentum by providing a clear roadmap and celebrating progress.
 *
 * Usage:
 *   bun run agents/career-momentum-builder.ts [options]
 *
 * Options:
 *   --job-url <url>         URL of job description to analyze
 *   --github <username>     Your GitHub username for profile analysis
 *   --role <title>          Target role (e.g., "Senior Frontend Engineer")
 *   --resume <path>         Path to your resume file
 *   --output <path>         Output directory for action plan (default: ./career-plan)
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { resolve } from 'path';

interface CareerBuilderOptions {
  jobUrl?: string;
  githubUsername?: string;
  targetRole?: string;
  resumePath?: string;
  outputDir: string;
}

async function buildCareerMomentum(options: CareerBuilderOptions) {
  const {
    jobUrl,
    githubUsername,
    targetRole,
    resumePath,
    outputDir,
  } = options;

  console.log('🚀 Career Momentum Builder Starting...\n');
  if (targetRole) console.log(`🎯 Target Role: ${targetRole}`);
  if (githubUsername) console.log(`👤 GitHub: @${githubUsername}`);
  if (jobUrl) console.log(`📄 Job Description: ${jobUrl}`);
  if (resumePath) console.log(`📝 Resume: ${resumePath}`);
  console.log(`📂 Output Directory: ${outputDir}\n`);

  const prompt = buildPrompt(options);

  console.log('🤖 Analyzing your career trajectory and building momentum plan...\n');

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: `
You are the Career Momentum Builder, an expert career coach and technical mentor who helps developers achieve their career dreams.

Your mission is to transform career anxiety into momentum by providing clear, actionable roadmaps that celebrate progress and build confidence.

## Your Approach

### Phase 1: Current State Assessment
1. **Skill Inventory**: Analyze GitHub profile, portfolio projects, and resume to catalog current skills
2. **Experience Evaluation**: Assess depth of experience in key technologies and domains
3. **Strength Identification**: Identify unique strengths and differentiators
4. **Growth Areas**: Pinpoint gaps between current skills and target role requirements

### Phase 2: Target Role Analysis
1. **Job Market Research**: Use WebSearch to understand current market demands
2. **Requirements Breakdown**: Analyze job descriptions to extract must-have vs nice-to-have skills
3. **Competitive Landscape**: Understand what makes candidates stand out
4. **Realistic Timeline**: Estimate time needed to bridge skill gaps

### Phase 3: Strategic Action Plan
1. **Learning Path**: Create prioritized list of skills to develop with specific resources
2. **Portfolio Projects**: Design 2-3 impressive projects that demonstrate target role capabilities
3. **Open Source Strategy**: Identify strategic contributions that align with career goals
4. **Content Creation**: Plan blog posts and social media content to build personal brand
5. **Network Building**: Suggest communities, conferences, and connections to make

### Phase 4: 90-Day Momentum Plan
Create a detailed roadmap with:
- **Weekly milestones** with specific, measurable outcomes
- **Daily habits** to build consistency and momentum
- **Portfolio project sprints** with clear deliverables
- **Content publication schedule** for building visibility
- **Networking activities** for expanding opportunities
- **Progress checkpoints** to celebrate wins and adjust course

### Phase 5: Overcoming Imposter Syndrome
- Document concrete evidence of growing skills
- Reframe "gaps" as "growth opportunities"
- Celebrate small wins and incremental progress
- Provide perspective on realistic expectations vs perfectionism

## Tools You'll Use

- **WebSearch**: Research job market trends, salary data, company information
- **WebFetch**: Analyze job descriptions, company career pages, blog posts
- **Bash**: Clone and analyze repos, use gh CLI for GitHub operations
- **Read**: Analyze resume, portfolio code, existing projects
- **Grep/Glob**: Find patterns in portfolio projects, assess code quality
- **Write**: Generate action plans, project specs, resume improvements, content ideas
- **TodoWrite**: Track progress through each phase of analysis

## Output Guidelines

Generate comprehensive markdown files in the output directory:

1. **career-assessment.md**: Current state analysis with strengths and growth areas
2. **skill-gap-analysis.md**: Detailed breakdown of what to learn and why
3. **portfolio-project-ideas.md**: 2-3 impressive project specs with implementation guides
4. **learning-resources.md**: Curated list of courses, docs, and tutorials
5. **content-strategy.md**: Blog post ideas and social media content calendar
6. **networking-plan.md**: Communities to join, events to attend, people to connect with
7. **90-day-roadmap.md**: Week-by-week action plan with milestones
8. **resume-optimization.md**: Specific improvements to resume and GitHub profile
9. **interview-prep.md**: Common questions and how to showcase your unique strengths
10. **momentum-tracker.md**: Template for tracking daily progress and celebrating wins

## Key Principles

- **Be Realistic**: Set achievable goals that build momentum, not overwhelm
- **Be Specific**: Provide exact resources, projects, and actions (no vague advice)
- **Be Encouraging**: Celebrate existing strengths and reframe growth areas positively
- **Be Strategic**: Focus on high-impact activities that accelerate career growth
- **Be Actionable**: Every recommendation should have a clear next step

Remember: Your goal is to transform "I don't know if I can do this" into "I have a clear path forward and I'm making progress every day."
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
          console.log('\n\n✅ Career Momentum Plan Complete!\n');
          console.log('📊 Summary:');
          console.log(`   Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
          console.log(`   Turns: ${message.num_turns}`);
          console.log(`   Cost: $${message.total_cost_usd.toFixed(4)}`);
          console.log(`   Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);
          console.log(`\n📂 Check ${outputDir}/ for your complete career action plan!`);
          console.log('\n💪 Remember: Career growth is a marathon, not a sprint.');
          console.log('   Focus on consistent progress, celebrate small wins, and trust the process.\n');
        } else {
          console.error('\n❌ Failed to generate career momentum plan');
          if (message.subtype === 'error_max_turns') {
            console.error('Error: Maximum turns reached');
          }
        }
      }
    }
  } catch (error) {
    console.error('\n❌ Error during career plan generation:', error);
    process.exit(1);
  }
}

function buildPrompt(options: CareerBuilderOptions): string {
  const { jobUrl, githubUsername, targetRole, resumePath, outputDir } = options;

  let prompt = `I need help accelerating my career as a developer. `;

  if (targetRole) {
    prompt += `My goal is to become a ${targetRole}. `;
  } else {
    prompt += `I want to advance my career but I'm not sure what role to target. `;
  }

  prompt += `\n\nPlease help me build career momentum by:\n\n`;

  // Phase 1: Assessment
  prompt += `## Phase 1: Assess My Current State\n\n`;

  if (githubUsername) {
    prompt += `1. Analyze my GitHub profile (@${githubUsername}) using WebFetch or Bash with gh CLI:\n`;
    prompt += `   - Review my repositories to understand my tech stack and experience\n`;
    prompt += `   - Assess code quality, project complexity, and contribution patterns\n`;
    prompt += `   - Identify my strongest skills and unique differentiators\n`;
    prompt += `   - Suggest specific improvements to make my profile more impressive\n\n`;
  }

  if (resumePath) {
    prompt += `2. Review my resume at "${resumePath}":\n`;
    prompt += `   - Identify strengths and areas that need better highlighting\n`;
    prompt += `   - Suggest specific improvements for impact and clarity\n`;
    prompt += `   - Recommend what to add/remove/reframe\n\n`;
  }

  if (!githubUsername && !resumePath) {
    prompt += `1. Since I haven't provided a GitHub username or resume, guide me on:\n`;
    prompt += `   - What I should include in my GitHub profile\n`;
    prompt += `   - How to structure an impressive developer portfolio\n`;
    prompt += `   - Key projects that would demonstrate my capabilities\n\n`;
  }

  // Phase 2: Target Role Analysis
  prompt += `## Phase 2: Analyze Target Role Requirements\n\n`;

  if (jobUrl) {
    prompt += `1. Analyze the job description at ${jobUrl} using WebFetch:\n`;
    prompt += `   - Extract all required and preferred skills\n`;
    prompt += `   - Identify must-have vs nice-to-have qualifications\n`;
    prompt += `   - Understand what the company values in candidates\n\n`;
  }

  if (targetRole) {
    prompt += `2. Research the ${targetRole} role using WebSearch:\n`;
    prompt += `   - Find 3-5 real job postings for this role\n`;
    prompt += `   - Identify common required skills and technologies\n`;
    prompt += `   - Understand typical experience requirements\n`;
    prompt += `   - Research salary ranges and career progression paths\n\n`;
  } else {
    prompt += `2. Help me identify suitable target roles based on my current skills:\n`;
    prompt += `   - Suggest 2-3 realistic next-step roles\n`;
    prompt += `   - Explain why each role would be a good fit\n`;
    prompt += `   - Provide market demand and salary information\n\n`;
  }

  // Phase 3: Skill Gap Analysis
  prompt += `## Phase 3: Create My Skill Development Plan\n\n`;
  prompt += `1. Compare my current skills with target role requirements\n`;
  prompt += `2. Create a prioritized list of skills to develop:\n`;
  prompt += `   - Categorize as: Critical (must learn), Important (should learn), Bonus (nice to have)\n`;
  prompt += `   - Estimate time needed to reach proficiency for each\n`;
  prompt += `   - Provide specific learning resources (courses, docs, tutorials)\n`;
  prompt += `3. Identify skills I already have that can be better showcased\n\n`;

  // Phase 4: Portfolio Projects
  prompt += `## Phase 4: Design Impressive Portfolio Projects\n\n`;
  prompt += `1. Generate 2-3 portfolio project ideas that:\n`;
  prompt += `   - Demonstrate skills required for my target role\n`;
  prompt += `   - Solve real-world problems (not just tutorials)\n`;
  prompt += `   - Are impressive but achievable in 2-4 weeks each\n`;
  prompt += `   - Would make great talking points in interviews\n`;
  prompt += `2. For each project, provide:\n`;
  prompt += `   - Complete project specification\n`;
  prompt += `   - Recommended tech stack with justification\n`;
  prompt += `   - Implementation roadmap broken into phases\n`;
  prompt += `   - How to showcase it effectively\n\n`;

  // Phase 5: Content Strategy
  prompt += `## Phase 5: Build My Personal Brand\n\n`;
  prompt += `1. Create a content strategy for technical blog posts:\n`;
  prompt += `   - Suggest 5 blog post topics based on my skills and projects\n`;
  prompt += `   - Include SEO-friendly titles and key points to cover\n`;
  prompt += `   - Recommend platforms (Dev.to, Medium, personal blog)\n`;
  prompt += `2. Plan social media content:\n`;
  prompt += `   - Weekly themes for sharing progress and insights\n`;
  prompt += `   - How to engage with developer community effectively\n\n`;

  // Phase 6: Strategic Open Source
  prompt += `## Phase 6: Open Source Contribution Strategy\n\n`;
  prompt += `1. Identify 2-3 open source projects that:\n`;
  prompt += `   - Align with my target role requirements\n`;
  prompt += `   - Have active maintainers and welcoming communities\n`;
  prompt += `   - Would look impressive on my resume\n`;
  prompt += `2. Find specific issues I could tackle in each project\n`;
  prompt += `3. Explain how these contributions advance my career goals\n\n`;

  // Phase 7: 90-Day Roadmap
  prompt += `## Phase 7: Create My 90-Day Action Plan\n\n`;
  prompt += `1. Build a detailed week-by-week roadmap with:\n`;
  prompt += `   - Specific milestones for each week\n`;
  prompt += `   - Learning activities with time estimates\n`;
  prompt += `   - Portfolio project sprints with deliverables\n`;
  prompt += `   - Content creation schedule\n`;
  prompt += `   - Networking and community engagement activities\n`;
  prompt += `2. Include daily habits to build momentum:\n`;
  prompt += `   - Morning routine for learning\n`;
  prompt += `   - Evening reflection and progress tracking\n`;
  prompt += `3. Set up progress checkpoints:\n`;
  prompt += `   - 30-day: First portfolio project complete\n`;
  prompt += `   - 60-day: Second portfolio project + 2 blog posts\n`;
  prompt += `   - 90-day: Ready to actively apply for target roles\n\n`;

  // Phase 8: Overcoming Challenges
  prompt += `## Phase 8: Build My Confidence\n\n`;
  prompt += `1. Document evidence of my growing skills:\n`;
  prompt += `   - Skills I already have that demonstrate my capabilities\n`;
  prompt += `   - Projects that show my problem-solving ability\n`;
  prompt += `   - Progress I've made in my career so far\n`;
  prompt += `2. Reframe imposter syndrome:\n`;
  prompt += `   - Realistic expectations for my experience level\n`;
  prompt += `   - How growth areas are opportunities, not failures\n`;
  prompt += `   - Evidence that I'm on the right track\n\n`;

  // Output instructions
  prompt += `## Output All Plans as Markdown Files\n\n`;
  prompt += `Save all analysis and recommendations in the "${outputDir}/" directory:\n`;
  prompt += `- career-assessment.md\n`;
  prompt += `- skill-gap-analysis.md\n`;
  prompt += `- portfolio-project-ideas.md\n`;
  prompt += `- learning-resources.md\n`;
  prompt += `- content-strategy.md\n`;
  prompt += `- networking-plan.md\n`;
  prompt += `- 90-day-roadmap.md\n`;
  prompt += `- resume-optimization.md (if resume provided)\n`;
  prompt += `- interview-prep.md\n`;
  prompt += `- momentum-tracker.md\n`;
  prompt += `- README.md (overview with quick-start guide)\n\n`;

  prompt += `Use TodoWrite to track your progress through each phase. `;
  prompt += `Be encouraging, specific, and actionable. Focus on building momentum with achievable goals.`;

  return prompt;
}

// Parse command line arguments
function parseArgs(): CareerBuilderOptions {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
🚀 Career Momentum Builder - Transform career anxiety into actionable momentum

Usage: bun run agents/career-momentum-builder.ts [options]

Options:
  --job-url <url>         URL of job description to analyze
  --github <username>     Your GitHub username for profile analysis
  --role <title>          Target role (e.g., "Senior Frontend Engineer")
  --resume <path>         Path to your resume file
  --output <path>         Output directory for action plan (default: ./career-plan)
  --help, -h             Show this help message

Examples:
  # Analyze specific job and create plan
  bun run agents/career-momentum-builder.ts --job-url "https://example.com/job" --github yourusername

  # Target a specific role with resume review
  bun run agents/career-momentum-builder.ts --role "Senior Backend Engineer" --resume ./resume.pdf --github yourusername

  # General career assessment and planning
  bun run agents/career-momentum-builder.ts --github yourusername --output ./my-career-plan

  # Complete analysis with all options
  bun run agents/career-momentum-builder.ts --role "Staff Engineer" --job-url "https://example.com/job" --github yourusername --resume ./resume.pdf
`);
    process.exit(0);
  }

  let jobUrl: string | undefined;
  let githubUsername: string | undefined;
  let targetRole: string | undefined;
  let resumePath: string | undefined;
  let outputDir = './career-plan';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--job-url':
        if (!nextArg) {
          console.error('Error: --job-url requires a URL');
          process.exit(1);
        }
        jobUrl = nextArg;
        i++;
        break;
      case '--github':
        if (!nextArg) {
          console.error('Error: --github requires a username');
          process.exit(1);
        }
        githubUsername = nextArg;
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
      case '--resume':
        if (!nextArg) {
          console.error('Error: --resume requires a file path');
          process.exit(1);
        }
        resumePath = resolve(nextArg);
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

  // Validate that at least some input is provided
  if (!jobUrl && !githubUsername && !targetRole && !resumePath) {
    console.error('Error: Please provide at least one of: --job-url, --github, --role, or --resume');
    console.error('Run with --help to see usage examples');
    process.exit(1);
  }

  return {
    jobUrl,
    githubUsername,
    targetRole,
    resumePath,
    outputDir,
  };
}

// Main execution
const options = parseArgs();
buildCareerMomentum(options);
