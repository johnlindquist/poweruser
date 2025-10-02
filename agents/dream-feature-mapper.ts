#!/usr/bin/env -S bun run

/**
 * Dream Feature Mapper Agent
 *
 * An agent that transforms dream features into actionable implementation roadmaps:
 * - Takes a feature description in plain English
 * - Analyzes existing codebase architecture, patterns, and tech stack
 * - Identifies reusable components and patterns
 * - Suggests new patterns and libraries needed
 * - Creates detailed step-by-step implementation roadmap
 * - Recommends trade-offs between technical approaches
 * - Generates starter code snippets matching your code style
 *
 * Usage:
 *   bun run agents/dream-feature-mapper.ts "real-time collaborative editing"
 *   bun run agents/dream-feature-mapper.ts "user authentication with OAuth" --output roadmap.md
 *   bun run agents/dream-feature-mapper.ts "dark mode support" --complexity detailed
 *
 * Examples:
 *   bun run agents/dream-feature-mapper.ts "real-time collaborative editing"
 *   bun run agents/dream-feature-mapper.ts "user authentication with OAuth" --output docs/auth-roadmap.md
 *   bun run agents/dream-feature-mapper.ts "dark mode support" --complexity quick --no-code
 */

import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

type ComplexityLevel = "quick" | "detailed" | "comprehensive";

interface MapperOptions {
  featureDescription: string;
  outputPath: string;
  complexityLevel: ComplexityLevel;
  includeStarterCode: boolean;
  focusDirectory?: string;
}

function printHelp(): void {
  console.log(`
🗺️  Dream Feature Mapper

Transforms your dream feature ideas into actionable implementation roadmaps!

Usage:
  bun run agents/dream-feature-mapper.ts "<feature description>" [options]

Arguments:
  <feature description>   Your dream feature in plain English (required)

Options:
  --output <path>        Output file path (default: ./FEATURE_ROADMAP.md)
  --complexity <level>   Detail level: quick|detailed|comprehensive (default: detailed)
  --no-code             Skip starter code generation
  --focus <directory>   Focus analysis on specific directory
  --help, -h            Show this help message

Examples:
  bun run agents/dream-feature-mapper.ts "real-time collaborative editing"
  bun run agents/dream-feature-mapper.ts "user authentication with OAuth" --output docs/auth-roadmap.md
  bun run agents/dream-feature-mapper.ts "dark mode support" --complexity quick --no-code
  bun run agents/dream-feature-mapper.ts "export to PDF" --focus src/features/documents
  bun run agents/dream-feature-mapper.ts "AI-powered search" --complexity comprehensive
  `);
}

function parseOptions(): MapperOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help || positionals.length === 0) {
    printHelp();
    return null;
  }

  const featureDescription = positionals[0];
  if (!featureDescription) {
    console.error("❌ Error: Feature description is required\n");
    console.log('Example: bun run agents/dream-feature-mapper.ts "real-time notifications"');
    console.log("Run with --help for more information");
    process.exit(1);
  }

  const rawOutput = values.output;
  const outputPath =
    typeof rawOutput === "string" && rawOutput.length > 0
      ? rawOutput
      : "./FEATURE_ROADMAP.md";

  const rawComplexity = values.complexity;
  const complexityLevel: ComplexityLevel =
    typeof rawComplexity === "string" &&
    ["quick", "detailed", "comprehensive"].includes(rawComplexity)
      ? (rawComplexity as ComplexityLevel)
      : "detailed";

  const includeStarterCode = values["no-code"] !== true;

  const rawFocus = values.focus;
  const focusDirectory =
    typeof rawFocus === "string" && rawFocus.length > 0
      ? rawFocus
      : undefined;

  return {
    featureDescription,
    outputPath,
    complexityLevel,
    includeStarterCode,
    focusDirectory,
  };
}

function buildPrompt(options: MapperOptions): string {
  const {
    featureDescription,
    outputPath,
    includeStarterCode,
    focusDirectory,
  } = options;

  const focusScope = focusDirectory
    ? `focusing primarily on the "${focusDirectory}" directory`
    : "analyzing the entire codebase";

  return `You are a Dream Feature Mapper. Your mission is to transform a developer's dream feature idea into a concrete, actionable implementation roadmap.

## The Dream Feature
"${featureDescription}"

## Your Task

Create a comprehensive implementation roadmap that turns this dream into reality, ${focusScope}.

### Phase 1: Codebase Analysis & Discovery

1. Understand the project structure:
   - Use Glob to discover key files and directories: \`**/*.{ts,tsx,js,jsx,py,go,java}\`
   - Use Read to check package.json, pyproject.toml, go.mod, or similar for tech stack
   - Identify the primary language and framework being used

2. Analyze existing architecture and patterns:
   ${focusDirectory ? `- Focus heavily on: ${focusDirectory}` : "- Scan the main source directories"}
   - Use Grep to find similar existing features or patterns: \`pattern: "class|function|interface"\`
   - Identify state management approach (Redux, Context, Vuex, etc.)
   - Find API/backend integration patterns
   - Discover component/module organization conventions
   - Identify testing patterns and frameworks

3. Discover reusable components and utilities:
   - Use Grep to find components, hooks, utilities that might be relevant
   - Look for existing authentication, data fetching, or UI patterns
   - Identify shared types, interfaces, or schemas
   - Find configuration files and environment setups

### Phase 2: Implementation Planning

Based on your analysis, create a detailed roadmap with these sections:

#### 🎯 Feature Overview
- Clarify what the feature will do (1-2 paragraphs)
- Identify the primary user benefit
- Estimate overall complexity: Low/Medium/High

#### 🏗️ Architecture Assessment
- **Tech Stack Compatibility**: How well does this feature fit the existing stack?
- **Existing Assets**: What components/patterns can be reused? (List with file paths)
- **New Patterns Needed**: What new patterns or abstractions will be required?
- **Dependencies Required**: What new libraries/packages should be added?

#### 📚 Recommended Approach
Present 2-3 possible technical approaches:

**Approach 1: [Name, e.g., "WebSocket-based Real-time"]**
- How it works (brief description)
- Pros: What makes this approach good
- Cons: What are the trade-offs
- Complexity: Low/Medium/High
- Estimated time: X days/weeks

**Approach 2: [Alternative approach]**
- (Same structure as above)

**Recommendation**: Which approach and why?

#### 🛠️ Implementation Roadmap

Break down implementation into phases with concrete steps:

**Phase 1: Foundation (Estimated: X hours)**
1. [Specific task with file paths where applicable]
   - Why: Brief rationale
   - Files to modify: src/...
   - Dependencies: Any new packages needed

2. [Next task]
   - Why: ...
   - Files: ...

**Phase 2: Core Feature (Estimated: X hours)**
[Continue similar structure]

**Phase 3: Integration & Polish (Estimated: X hours)**
[Continue similar structure]

#### ⚠️ Key Considerations
- **Data Flow**: How will data move through the system?
- **State Management**: Where will state live and how will it update?
- **Error Handling**: What could go wrong and how to handle it?
- **Testing Strategy**: What types of tests are needed?
- **Performance Impact**: What are potential bottlenecks?
- **Security Considerations**: Any security implications?

#### 🔌 Integration Points
Identify where this feature connects to existing code:
- Entry points (which files to start modifying)
- API endpoints (existing or new)
- Database/storage changes
- UI components to create or modify

${includeStarterCode ? `
#### 💻 Starter Code Snippets

Generate 2-3 starter code snippets that match the project's coding style:

**Snippet 1: [e.g., "Core Feature Component"]**
\`\`\`typescript
// File: src/features/${featureDescription.toLowerCase().replace(/\s+/g, "-")}/FeatureComponent.tsx
// Based on patterns found in: [reference existing files]

[Generate actual starter code here that matches the codebase style]
\`\`\`

**Snippet 2: [e.g., "API Integration"]**
\`\`\`typescript
// File: src/api/${featureDescription.toLowerCase().replace(/\s+/g, "-")}.ts
[Generate actual code]
\`\`\`
` : ""}

#### 📋 Checklist Before Starting
- [ ] Review existing [relevant files] to understand patterns
- [ ] Install required dependencies: \`npm install ...\`
- [ ] Set up any necessary environment variables
- [ ] Create feature branch: \`git checkout -b feature/...\`
- [ ] Review this roadmap with team (if applicable)

#### 🚀 Next Steps
1. Start with Phase 1, Step 1
2. Test incrementally after each step
3. Commit frequently with descriptive messages
4. Update this roadmap if you discover better approaches

### Phase 3: Write the Roadmap
- Use the Write tool to create the roadmap file at: ${outputPath}
- Make it practical, specific, and actionable
- Include file paths, code examples, and concrete steps
- Reference actual files from the codebase where relevant

## Guidelines
- Be specific with file paths and concrete examples
- Prioritize reusing existing patterns and code
- Consider the developer's skill level - make it approachable
- Include both quick wins and longer-term considerations
- Estimate times realistically
- Highlight potential pitfalls
- Make the roadmap feel achievable and exciting

Start by analyzing the codebase structure and tech stack.`.trim();
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = [
    "output",
    "complexity",
    "no-code",
    "noCode",
    "focus",
    "help",
    "h",
  ] as const;

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

console.log("🗺️  Dream Feature Mapper\n");
console.log(`Feature: "${options.featureDescription}"`);
console.log(`Complexity: ${options.complexityLevel}`);
console.log(`Output: ${options.outputPath}`);
if (options.focusDirectory) {
  console.log(`Focus: ${options.focusDirectory}`);
}
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Bash",
  "Read",
  "Glob",
  "Grep",
  "Write",
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "acceptEdits",
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Dream Feature Roadmap Complete!\n");
    console.log(`🗺️  Your implementation roadmap is ready at: ${options.outputPath}`);
    console.log("\n🚀 Next Step: Open the roadmap and start with Phase 1, Step 1!");
    console.log("💡 Tip: Adjust the roadmap as you learn more during implementation.");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
