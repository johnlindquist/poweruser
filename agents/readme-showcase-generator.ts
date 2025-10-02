#!/usr/bin/env -S bun run

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
 * Usage:
 *   bun run agents/readme-showcase-generator.ts [project-path] [options]
 *
 * Examples:
 *   # Generate showcase README in current directory
 *   bun run agents/readme-showcase-generator.ts
 *
 *   # Generate for specific project
 *   bun run agents/readme-showcase-generator.ts ./my-project
 *
 *   # Preserve existing README, output to new file
 *   bun run agents/readme-showcase-generator.ts --preserve
 */

import { resolve } from "node:path";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface ReadmeGeneratorOptions {
  projectPath: string;
  preserveOriginal: boolean;
}

const DEFAULT_PROJECT_PATH = process.cwd();

function printHelp(): void {
  console.log(`
📝 README Showcase Generator

Usage:
  bun run agents/readme-showcase-generator.ts [project-path] [options]

Arguments:
  project-path            Path to project (default: current directory)

Options:
  --preserve              Preserve existing README.md, output to README-new.md
  --help, -h              Show this help

Examples:
  bun run agents/readme-showcase-generator.ts
  bun run agents/readme-showcase-generator.ts ./my-project
  bun run agents/readme-showcase-generator.ts --preserve
  bun run agents/readme-showcase-generator.ts ./my-project --preserve
  `);
}

function parseOptions(): ReadmeGeneratorOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const projectPath = positionals[0]
    ? resolve(positionals[0])
    : DEFAULT_PROJECT_PATH;

  const preserveOriginal = values.preserve === true;

  return {
    projectPath,
    preserveOriginal,
  };
}

function buildPrompt(options: ReadmeGeneratorOptions): string {
  const { projectPath, preserveOriginal } = options;
  const outputFile = preserveOriginal ? "README-new.md" : "README.md";

  return `Analyze the project at "${projectPath}" and generate an enhanced, eye-catching README.md that will attract GitHub stars and contributors.

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
   - Write the new ${outputFile}${preserveOriginal ? " (preserving existing README.md)" : ""}
   - Provide a summary of what was generated
   - List suggestions for demo content to capture

Important notes:
- If a README.md already exists${preserveOriginal ? ", preserve it by writing to README-new.md" : ", analyze and enhance it while preserving unique content"}
- Make the README stand out while remaining professional
- Focus on clarity and ease of understanding for new users
- Include real, working code examples based on the actual project code
- Suggest where placeholder URLs should be updated (badges, demo links, etc.)`.trim();
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["preserve", "help", "h"] as const;

  for (const key of agentKeys) {
    if (key in values) {
      delete values[key];
    }
  }
}

const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log("📝 README Showcase Generator\n");
console.log(`Project: ${options.projectPath}`);
console.log(`Preserve original: ${options.preserveOriginal ? "Yes (output to README-new.md)" : "No (overwrite README.md)"}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Read",
  "Write",
  "Glob",
  "Grep",
  "Bash",
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "bypassPermissions",
};

// Change working directory to project path
const originalCwd = process.cwd();
process.chdir(options.projectPath);

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ README showcase generation complete!\n");
    console.log("Next steps:");
    console.log("1. Review the generated README");
    console.log("2. Add screenshots/GIFs to showcase features");
    console.log("3. Update badge URLs with real values");
    console.log("4. Customize any generic sections");
    console.log("5. Add to git and push to GitHub");
  }
  process.chdir(originalCwd);
  process.exit(exitCode);
} catch (error) {
  process.chdir(originalCwd);
  console.error("❌ Fatal error:", error);
  process.exit(1);
}