#!/usr/bin/env bun

/**
 * README Showcase Generator Agent
 *
 * Transforms boring README files into eye-catching showcases that attract stars and contributors.
 * This agent analyzes your project structure, features, and code to create compelling documentation.
 *
 * Features:
 * - Generates beautiful badges (build status, coverage, version, license)
 * - Creates compelling copy explaining the "why" behind your project
 * - Adds all sections successful OSS projects have (features, installation, usage, contributing)
 * - Suggests demo GIF/screenshot locations and what to capture
 * - Formats code examples with proper syntax highlighting
 * - Ensures consistent tone and style throughout
 *
 * Usage: bun run agents/readme-showcase-generator.ts [project-path]
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { resolve } from 'path';

async function main() {
  const args = process.argv.slice(2);
  const projectPath = args.length > 0 ? resolve(args[0]!) : process.cwd();

  console.log(`\n📝 Generating showcase README for: ${projectPath}\n`);

  const prompt = `Analyze the project at "${projectPath}" and generate an enhanced, eye-catching README.md that will attract GitHub stars and contributors.

Your task:

1. **Project Analysis**
   - Read package.json (if exists) to understand the project name, description, version, dependencies
   - Read existing README.md (if exists) to understand current documentation
   - Use Glob to discover key project files (src/, lib/, tests/, docs/, etc.)
   - Read key source files to understand the main features and functionality
   - Identify the project type (library, CLI tool, web app, etc.)

2. **Generate Badges**
   Create appropriate badges for:
   - npm version (if npm package)
   - Build status placeholder
   - License (extract from package.json or LICENSE file)
   - GitHub stars/forks placeholders
   - Coverage placeholder
   - Other relevant badges based on project type

3. **Create Compelling Content**
   Include these sections with engaging, professional copy:

   **Header**
   - Project name with emoji
   - Tagline explaining what it does in one sentence
   - Badges row
   - Brief paragraph explaining the "why" - what problem does this solve?

   **Features**
   - Bullet list of key features discovered from code analysis
   - Focus on user benefits, not just technical details

   **Installation**
   - Clear, copy-paste ready installation instructions
   - Include all package managers (npm, yarn, pnpm, bun if applicable)

   **Quick Start**
   - Minimal example showing core functionality
   - Include code blocks with proper syntax highlighting
   - Add explanatory comments in code examples

   **Usage**
   - More detailed examples covering main use cases
   - Include API documentation if it's a library
   - Show configuration options if applicable

   **Demo**
   - Placeholder for screenshots/GIFs
   - Suggestions for what to capture in demos

   **Contributing**
   - Welcoming message for contributors
   - Link to CONTRIBUTING.md or basic guidelines
   - Code of Conduct mention

   **License**
   - License information from package.json or LICENSE file

   **Footer**
   - Made with ❤️ by [maintainer]
   - Links to related projects/resources

4. **Style Guidelines**
   - Use clear, friendly, professional tone
   - Add emojis sparingly to enhance readability (section headers only)
   - Use proper markdown formatting
   - Include horizontal rules (---) to separate major sections
   - Keep paragraphs short and scannable
   - Use tables for API documentation if applicable

5. **Output**
   - Write the new README.md (or README-new.md if you want to preserve the old one)
   - Provide a summary of what was generated
   - List suggestions for demo content to capture

Important notes:
- If a README.md already exists, preserve any unique content that should be kept
- Make the README stand out while remaining professional
- Focus on clarity and ease of understanding for new users
- Include real, working code examples based on the actual project code
- Suggest where placeholder URLs should be updated (badges, demo links, etc.)`;

  const response = query({
    prompt,
    options: {
      cwd: projectPath,
      permissionMode: 'bypassPermissions',
      allowedTools: ['Read', 'Write', 'Glob', 'Grep', 'Bash'],
      model: 'sonnet',
    },
  });

  for await (const message of response) {
    if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('\n✅ README showcase generation complete!\n');
        console.log(message.result);
        console.log('\n');
      } else {
        console.error('\n❌ Error during generation:');
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