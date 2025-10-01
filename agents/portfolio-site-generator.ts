#!/usr/bin/env bun

/**
 * Portfolio Site Generator
 *
 * An outside-the-box agent that transforms your GitHub work into a professional portfolio website.
 * Analyzes your repositories, selects the best projects, and generates a modern, responsive site.
 *
 * Usage:
 *   bun run agents/portfolio-site-generator.ts [output-directory]
 *
 * Examples:
 *   bun run agents/portfolio-site-generator.ts
 *   bun run agents/portfolio-site-generator.ts ./my-portfolio
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const SYSTEM_PROMPT = `You are a Portfolio Site Generator, an expert at showcasing developer work professionally.

Your mission is to:
1. Analyze the current project and available repositories to identify showcase-worthy work
2. Select the best projects based on code quality, complexity, and potential impact
3. Generate a modern, responsive portfolio website with:
   - Clean, professional design using modern CSS/Tailwind
   - Project showcase cards with descriptions, tech stacks, and links
   - About Me section with skills and experience
   - Contact section with social links
   - Responsive mobile-first design
4. Create compelling project descriptions from README files and code analysis
5. Extract tech stack information from package.json, dependencies, and code
6. Generate deployment-ready code (static HTML/CSS/JS or Next.js/React)

## Portfolio Best Practices:

**Project Selection:**
- Prioritize projects with clear purpose and good documentation
- Highlight projects that solve real problems
- Include variety: different tech stacks and project types
- Focus on 3-6 best projects rather than overwhelming with quantity

**Content Quality:**
- Write engaging, non-technical descriptions for each project
- Highlight the "why" and "what" before the "how"
- Include live demos or screenshots when possible
- Show impact: users, downloads, stars, or problem solved

**Design Principles:**
- Clean, minimal design that puts content first
- Fast loading and optimized assets
- Accessible and semantic HTML
- Dark/light mode support
- Professional color scheme and typography

**SEO & Performance:**
- Semantic HTML with proper meta tags
- Fast loading times
- Mobile responsive
- Social media preview cards

## Output Structure:

Generate a complete portfolio site with:
1. index.html - Main landing page with hero, projects, about, contact
2. styles.css - Modern, responsive stylesheet
3. script.js - Interactive elements (optional)
4. assets/ - Folder for images/icons
5. README.md - Deployment instructions
6. package.json - If using a framework (optional)

## Tools at Your Disposal:

- Bash: Run git commands to analyze repositories
- Read: Analyze code, README files, package.json
- Glob: Find project files and structure
- Grep: Search for specific patterns in code
- Write: Generate portfolio site files
- WebSearch: Find portfolio best practices and design trends

Work efficiently and create a professional, deployment-ready portfolio site.`;

async function main() {
  const args = process.argv.slice(2);
  const outputDir = args[0] || './portfolio';

  console.log('🎨 Portfolio Site Generator starting...\n');
  console.log(`Output directory: ${outputDir}\n`);

  const prompt = `Generate a professional portfolio website showcasing this developer's work.

Please follow these steps:

1. **Analyze the current repository**:
   - Use Bash to run git commands to understand the project structure
   - Check if this is a multi-project workspace or single project
   - Look for README, package.json, and other indicators of project quality

2. **Identify showcase projects**:
   - Analyze the current project or look for related projects
   - Read README files to understand each project's purpose
   - Extract tech stack from dependencies and code
   - Identify 3-6 best projects to showcase

3. **Gather developer information**:
   - Extract name, bio, and contact info from git config or README
   - Identify skills and technologies used across projects
   - Create a compelling "About Me" section

4. **Design the portfolio**:
   - Create a modern, responsive layout
   - Use a professional color scheme (suggest dark mode support)
   - Design project cards with: title, description, tech stack, links
   - Include hero section, projects grid, about section, and contact footer

5. **Generate the site files** in "${outputDir}":
   - index.html with semantic, accessible markup
   - styles.css with modern, responsive design (consider using CSS Grid/Flexbox)
   - script.js with smooth scrolling, dark mode toggle, etc.
   - README.md with deployment instructions (Vercel, Netlify, GitHub Pages)
   - Any necessary assets or icons

6. **Provide deployment guidance**:
   - Include instructions for deploying to Vercel/Netlify/GitHub Pages
   - Suggest custom domain setup steps
   - Add analytics setup (Google Analytics, Plausible, etc.)

Create a portfolio that:
- Loads fast and works on all devices
- Showcases work professionally and compellingly
- Makes it easy for recruiters/clients to contact the developer
- Follows modern web best practices

Focus on quality over quantity - a clean, professional site with 3-5 great projects beats a cluttered site with 20 mediocre ones.`;

  try {
    const result = query({
      prompt,
      options: {
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: SYSTEM_PROMPT
        },
        model: 'claude-sonnet-4-5-20250929',
        allowedTools: [
          'Bash',
          'Read',
          'Glob',
          'Grep',
          'Write',
          'WebSearch',
          'TodoWrite'
        ],
        maxTurns: 30,
        permissionMode: 'acceptEdits',
      },
    });

    // Stream the results
    for await (const message of result) {
      if (message.type === 'assistant') {
        // Print assistant messages
        for (const content of message.message.content) {
          if (content.type === 'text') {
            console.log(content.text);
          }
        }
      } else if (message.type === 'result') {
        // Print final results
        console.log('\n' + '='.repeat(80));
        if (message.subtype === 'success') {
          console.log('✅ Portfolio site generated successfully!');
          console.log(`\nOutput location: ${outputDir}`);
          console.log(`Total turns: ${message.num_turns}`);
          console.log(`Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
          console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
        } else {
          console.log('⚠️  Generation completed with limitations');
          console.log(`Reason: ${message.subtype}`);
        }
        console.log('='.repeat(80));
      }
    }

  } catch (error) {
    console.error('❌ Error running Portfolio Site Generator:', error);
    process.exit(1);
  }
}

main();
