# Agent SDK Ideas

## 1. Stale Code Cleaner
A practical agent that identifies and safely removes dead code to improve maintainability:
- Finds unused imports, exports, and dependencies across the entire codebase
- Detects dead code paths using static analysis and coverage data
- Identifies orphaned CSS classes, unused styles, and redundant assets
- Analyzes call graphs to find unreachable functions and classes
- Generates impact reports showing bundle size savings
- Creates a safe removal plan with rollback capability
Uses `Grep`/`Glob` for code scanning, `Bash` for dependency analysis, `canUseTool` for safe deletion approval, and `Write` for cleanup reports.

## 2. Codebase Time Machine
An outside-the-box agent that reconstructs your application's complete state at any point in history:
- Uses git history, runtime logs, and code analysis to "replay" development timeline
- Visualizes exactly when and why bugs were introduced with full context
- Shows the evolution of architectural decisions and feature development
- Helps debug time-sensitive issues by understanding what changed between working and broken states
- Generates interactive timelines showing how files, functions, and patterns evolved
- Identifies the "blast radius" of changes by showing what was affected
- Perfect for understanding legacy code decisions and debugging production issues
This is like having a DVR for your codebase that lets you travel through time to understand the story behind every line. Uses `Bash` for git operations, `Read` for code analysis, `Write` for generating timeline reports, and completes in under a minute for typical repositories.

## 3. Error Message Enhancer
A practical everyday agent that transforms generic errors into helpful, actionable messages:
- Scans codebase for unhelpful error messages ("Invalid input", "Error occurred", "Something went wrong")
- Generates context-rich alternatives that explain what was expected vs. what was received
- Adds actionable suggestions for how to fix the error
- Ensures consistency across error handling patterns throughout the codebase
- Can generate user-friendly error pages and developer-friendly stack traces
- Identifies error messages that leak sensitive information or implementation details
- Creates error message style guide based on your codebase patterns
Uses `Grep`/`Glob` to find error messages, `Read` to understand context, `Edit` to improve messages in-place, and completes quickly for immediate impact on developer and user experience.

## 4. Open Source Mentor
An outside-the-box agent that helps developers contribute to major open source projects and achieve their dreams:
- Analyzes popular repositories (React, Next.js, VS Code) to understand contribution patterns and community culture
- Identifies beginner-friendly issues with full context, explanations of what needs to be done, and why it matters
- Generates comprehensive contribution guides including local development setup, testing, and debugging
- Drafts professional PR descriptions following project-specific conventions and templates
- Suggests how to engage with maintainers professionally and navigate code review feedback
- Builds a personalized roadmap from first contribution to becoming a recognized contributor
- Helps developers overcome imposter syndrome by breaking down intimidating codebases into manageable chunks
This transforms the dream of contributing to major OSS projects into reality. Uses `Bash` for git/GitHub operations, `Read` and `Grep` for codebase analysis, `WebFetch` for issue details, and `Write` for generating contribution guides.

## 5. README Showcase Generator
An outside-the-box agent that transforms boring README files into eye-catching showcases that attract GitHub stars and contributors:
- Analyzes your project structure, features, and code to understand what makes it special
- Generates beautiful badges (build status, coverage, version, license, etc.) with proper links
- Creates compelling copy that explains the "why" behind your project, not just the "what"
- Adds architecture diagrams and visual explanations of complex concepts
- Includes all sections that successful OSS projects have (features, installation, usage, contributing, etc.)
- Suggests demo GIFs/screenshots locations and what to capture
- Formats code examples with proper syntax highlighting and explanations
- Ensures consistent tone and style throughout the documentation
This helps your project stand out in the crowded GitHub ecosystem and attract the contributors and users it deserves. Uses `Read` to analyze project files, `Grep`/`Glob` to discover features, and `Write` to generate the enhanced README.

## 6. Changelog Automator
A practical everyday agent that generates beautiful, user-friendly changelogs automatically:
- Analyzes git commits and PR descriptions since the last release tag
- Categorizes changes into Breaking Changes, Features, Fixes, Documentation, and Internal
- Detects breaking changes by analyzing code diffs and conventional commit messages
- Generates migration guides for breaking API changes
- Adds links to relevant PRs and issues for transparency
- Formats output in multiple styles (Markdown, JSON, Keep a Changelog format)
- Can update CHANGELOG.md files automatically with proper versioning
- Suggests semantic version bumps based on change types
- Filters out noise like merge commits and dependency updates
Perfect for maintaining professional changelogs without manual effort. Uses `Bash` for git operations, `Read` to analyze changes, and `Edit` to update changelog files.

## 7. AI Pair Programming Mentor
An outside-the-box agent that analyzes your coding journey and accelerates your growth as a developer:
- Watches your git history to identify patterns in how you solve problems
- Analyzes code you've written to detect areas where you're strong vs. areas needing improvement
- Generates personalized coding challenges based on real weaknesses in your codebase
- Suggests refactoring exercises that teach better patterns through hands-on practice
- Tracks your progress over time and celebrates improvements
- Identifies when you're repeating anti-patterns and suggests alternatives
- Creates a personalized learning roadmap to level up from mid-level to senior to architect
This transforms everyday coding into a deliberate practice opportunity, helping you achieve your career goals. Uses `Bash` for git analysis, `Read` and `Grep` for code pattern detection, and `Write` for generating exercises and reports.

## 8. Breaking Change Detector
A practical everyday agent that prevents "it works in dev but breaks in prod" disasters:
- Analyzes function signatures, API endpoints, and exported interfaces for changes
- Compares current branch against main/production to detect breaking changes
- Identifies all call sites that would be affected by the changes
- Generates detailed migration guides showing exactly what needs to be updated
- Checks if changes match semantic versioning conventions
- Suggests gradual deprecation strategies for major changes
- Creates comprehensive test scenarios to verify backward compatibility
Perfect for teams shipping libraries or APIs where breaking changes have real consequences. Uses `Bash` for git diffs, `Grep` to find affected code, `Read` for analysis, and `Write` for migration guides.

## 9. Unused Variable Sweeper
A lightning-fast 3-second script that cleans up code clutter:
- Scans entire codebase for unused variables, parameters, and function arguments
- Detects unused imports that bloat your bundle size
- Finds function parameters that are declared but never referenced
- Identifies variables assigned but never read
- Generates a prioritized cleanup report sorted by file and severity
- Can automatically remove safe-to-delete items with confirmation
- Shows estimated bundle size savings from removing unused code
Perfect for keeping codebases clean and bundle sizes small. Uses `Grep` for detection and completes in seconds even for large projects.

