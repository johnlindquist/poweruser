#!/usr/bin/env bun

/**
 * Side Project Incubator Agent
 *
 * An outside-the-box agent that transforms your skills into actionable side project ideas:
 * - Analyzes your codebase, commit history, and tech stack to identify your strongest skills
 * - Researches current market trends and monetization opportunities
 * - Generates 3-5 complete side project concepts tailored to your skillset
 * - Creates detailed project briefs with problem statements, target audiences, and tech stacks
 * - Develops 90-day MVP roadmaps with weekly milestones
 * - Suggests go-to-market strategies and pricing models
 * - Identifies potential competitors and differentiation strategies
 *
 * Usage: bun run agents/side-project-incubator.ts [--niche <domain>]
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

async function main() {
  const args = process.argv.slice(2);
  const nicheIndex = args.indexOf('--niche');
  const niche = nicheIndex !== -1 && args[nicheIndex + 1] ? args[nicheIndex + 1] : null;

  console.log('\n🚀 Side Project Incubator\n');
  console.log('Analyzing your skills and generating personalized project ideas...\n');

  const prompt = `You are a Side Project Incubator helping a developer discover and plan their next meaningful side project.

Your mission is to:

1. **Analyze their skills** (20% of time):
   - Use Bash to analyze git commit history (git log --pretty=format:"%s" --all | head -50)
   - Read package.json, requirements.txt, go.mod, Cargo.toml, or similar to identify tech stack
   - Use Glob and Grep to identify primary languages, frameworks, and patterns they use
   - Summarize: What are they good at? What do they enjoy building?

2. **Research market opportunities** (30% of time):
   - Use WebSearch to find:
     * Current trends in their tech stack
     * Common pain points developers/users are experiencing
     * Emerging technologies and monetization opportunities
     * Gaps in existing tools/products
   ${niche ? `- Focus specifically on opportunities in the "${niche}" domain` : '- Look broadly across domains where their skills apply'}

3. **Generate 3-5 side project concepts** (50% of time):
   For each idea, create:
   - **Name & Tagline**: Catchy, memorable name with a one-liner
   - **Problem Statement**: What specific problem does this solve?
   - **Target Audience**: Who would pay for/use this?
   - **Core Features**: 5-7 essential features for MVP
   - **Tech Stack**: Recommended stack based on their existing skills
   - **Differentiation**: How is this different from competitors?
   - **Monetization Strategy**: Freemium, SaaS, one-time purchase, ads, etc.
   - **90-Day Roadmap**: Weekly milestones to reach MVP
   - **Go-to-Market**: Initial user acquisition channels and marketing approach
   - **Effort Estimate**: Realistic time commitment (hours per week)
   - **Revenue Potential**: Ballpark estimate based on market research

4. **Write comprehensive report**:
   - Create a file called "side-project-ideas.md" with all findings
   - Include market research insights
   - Add links to competitors and inspiration
   - Provide next steps for getting started

Focus on ideas that:
- Match their existing skills (80% familiar, 20% stretch)
- Solve real problems they or others face
- Can reach MVP in 3 months with part-time effort
- Have clear monetization paths
- Are exciting and motivating to build

Be realistic, encouraging, and specific. This should be a document they can act on immediately.`;

  const response = query({
    prompt,
    options: {
      cwd: process.cwd(),
      permissionMode: 'acceptEdits',
      allowedTools: ['Bash', 'Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Write'],
      model: 'claude-sonnet-4-5-20250929',
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: `You are an expert at identifying market opportunities, understanding developer skills, and creating actionable side project plans. You combine technical expertise with business acumen to help developers build meaningful products.`
      }
    },
  });

  for await (const message of response) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          console.log(block.text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('\n✅ Side project ideas generated!\n');
        console.log(`📊 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
        console.log(`🎯 Turns: ${message.num_turns}\n`);
        console.log('Check side-project-ideas.md for your personalized project ideas!\n');
      } else {
        console.error('\n❌ Error generating side project ideas');
        console.error(message);
        process.exit(1);
      }
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
