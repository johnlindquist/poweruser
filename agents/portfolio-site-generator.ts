#!/usr/bin/env -S bun run

/**
 * Portfolio Site Generator
 *
 * An outside-the-box agent that transforms your GitHub work into a professional portfolio website.
 * Analyzes your repositories, selects the best projects, and generates a modern, responsive site.
 *
 * Usage:
 *   bun run agents/portfolio-site-generator.ts [output-directory] [options]
 *
 * Examples:
 *   bun run agents/portfolio-site-generator.ts
 *   bun run agents/portfolio-site-generator.ts ./my-portfolio
 *   bun run agents/portfolio-site-generator.ts --help
 */

import { resolve } from "node:path";
import { claude, parsedArgs , removeAgentFlags} from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface PortfolioOptions {
  outputDir: string;
}

const DEFAULT_OUTPUT_DIR = "./portfolio";

function printHelp(): void {
  console.log(`
🎨 Portfolio Site Generator

Usage:
  bun run agents/portfolio-site-generator.ts [output-directory] [options]

Arguments:
  output-directory        Directory for generated portfolio (default: ${DEFAULT_OUTPUT_DIR})

Options:
  --help, -h              Show this help

Examples:
  bun run agents/portfolio-site-generator.ts
  bun run agents/portfolio-site-generator.ts ./my-portfolio
  `);
}

function parseOptions(): PortfolioOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawOutputDir = positionals[0];
  const outputDir = typeof rawOutputDir === "string" && rawOutputDir.length > 0
    ? resolve(rawOutputDir)
    : DEFAULT_OUTPUT_DIR;

  return {
    outputDir,
  };
}

function buildPrompt(options: PortfolioOptions): string {
  const { outputDir } = options;

  return `You are a Portfolio Site Generator, an expert at showcasing developer work professionally.

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

## Your Task:

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
}



const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("🎨 Portfolio Site Generator\n");
console.log(`Output directory: ${options.outputDir}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Bash",
  "Read",
  "Glob",
  "Grep",
  "Write",
  "WebSearch",
  "TodoWrite",
];

removeAgentFlags([
    "help", "h"
  ]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "acceptEdits",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Portfolio site generated successfully!\n");
    console.log(`📂 Output location: ${options.outputDir}`);
    console.log("\nNext steps:");
    console.log("1. Review the generated site files");
    console.log("2. Test the site locally (open index.html)");
    console.log("3. Customize content and styling as needed");
    console.log("4. Deploy to Vercel, Netlify, or GitHub Pages");
    console.log("5. Set up a custom domain (optional)");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
