# Agent SDK Ideas

## 1. Refactoring Opportunity Finder
An outside-the-box agent that identifies high-impact refactoring opportunities using design pattern analysis:
- Scans codebase for common code smells: God objects, feature envy, shotgun surgery, primitive obsession
- Identifies design pattern violations and suggests pattern applications (Strategy, Factory, Observer, etc.)
- Detects long methods, large classes, and inappropriate intimacy between modules
- Prioritizes refactoring opportunities by impact score (technical debt reduction, maintainability improvement)
- Generates step-by-step refactoring guides with before/after code examples
- Suggests modern language features to replace verbose patterns (optional chaining, destructuring, etc.)
- Creates a refactoring roadmap with estimated effort and risk assessment
- Perfect for developers who want to improve code quality systematically and learn design patterns in practice
This analyzes your codebase for refactoring opportunities in under 75 seconds. Uses `Grep` to find patterns, `Read` to analyze code structure, and `Write` to generate refactoring guides.

## 2. API Documentation Generator
A practical everyday agent that creates comprehensive API documentation automatically:
- Scans your API routes/controllers to discover all endpoints (Express, FastAPI, Flask, Rails, etc.)
- Extracts HTTP methods, paths, parameters, request bodies, and response formats
- Analyzes route handlers to infer data types, validation rules, and business logic
- Generates OpenAPI/Swagger specification with complete schemas and examples
- Creates human-readable markdown documentation with code samples in multiple languages
- Identifies undocumented endpoints and suggests missing descriptions
- Detects inconsistencies like mismatched response types or missing error handling
- Perfect for maintaining up-to-date API docs without manual writing
This generates your API documentation in under 60 seconds. Uses `Grep` to find routes, `Read` to analyze handlers, and `Write` to create OpenAPI specs and markdown docs.

## 3. Tech Debt Negotiator
An outside-the-box agent that helps developers communicate technical debt to stakeholders:
- Analyzes your codebase to identify and quantify technical debt (complexity metrics, code duplication, outdated patterns)
- Calculates business impact: estimated time spent working around tech debt, bug frequency in problematic areas
- Generates executive-friendly presentations with charts showing debt accumulation over time
- Creates ROI projections for refactoring efforts (time saved, reduced bugs, faster feature velocity)
- Suggests phased refactoring approaches that minimize business disruption
- Provides talking points and analogies that resonate with non-technical audiences
- Builds comparison scenarios: "Current state vs. After refactoring" with tangible metrics
- Perfect for developers who know what needs fixing but struggle to get buy-in from management
This transforms technical concerns into business language in under 2 minutes. Uses `Grep` and `Read` to analyze code quality, `Bash` for metrics collection, and `Write` to generate persuasive presentations.

## 4. Learning Path Generator
An outside-the-box agent that creates personalized developer learning roadmaps:
- Analyzes your codebase to understand your current tech stack and skill level
- Reviews your git history to identify patterns in your work and areas of expertise
- Detects gaps in your knowledge based on common patterns you avoid or struggle with
- Searches for trending technologies and best practices in your domain using WebSearch
- Generates a personalized 30-day learning path with specific resources: tutorials, articles, videos
- Suggests open source projects to study that match your level and interests
- Creates coding challenges that target your weak spots and build on your strengths
- Perfect for developers who want structured growth and don't know what to learn next
This creates your learning path in under 60 seconds. Uses `Bash` for git analysis, `Grep` to analyze code patterns, `WebSearch` for resources, and `Write` to generate your roadmap.

## 6. Side Project Blueprint Generator
An outside-the-box agent that transforms your side project dreams into actionable plans:
- Analyzes your coding patterns and git history to understand your strengths and preferred tech stack
- Takes your project idea and generates a complete technical architecture with database schemas, API design, and component hierarchy
- Creates a realistic timeline with milestones based on your coding velocity from git commits
- Suggests tech stack combinations that match your experience level and project requirements
- Generates starter code structure with configured build tools, linting, testing framework, and CI/CD pipeline
- Provides a launch checklist: MVP features, marketing landing page, deployment strategy, monitoring setup
- Creates a risk assessment identifying potential technical challenges before you start
- Perfect for developers who have great ideas but struggle with the "where do I even start?" paralysis
This generates your project blueprint in under 90 seconds. Uses `Bash` for git analysis, `WebSearch` for tech trends, `Write` to generate architecture docs and starter files.

## 8. Conference Talk Generator
An outside-the-box agent that transforms your code into compelling conference talk proposals:
- Analyzes your codebase to find interesting technical decisions, novel solutions, and valuable lessons learned
- Scans git history for evolution of complex features that tell a compelling story
- Identifies patterns that showcase expertise: performance optimizations, architecture choices, problem-solving approaches
- Generates 3-5 talk outlines with catchy titles, abstracts, and key takeaways for different conference formats (lightning, 20min, 40min)
- Suggests target conferences based on your tech stack and the talk's focus area
- Creates speaker notes with code examples, potential demo flows, and audience engagement points
- Provides storytelling structure: the problem you faced, failed approaches, breakthrough moment, impact/results
- Perfect for developers who want to share knowledge but don't know where to start or what's worth talking about
This generates talk proposals in under 90 seconds. Uses `Bash` for git analysis, `Grep` to find interesting code patterns, `Read` to analyze implementation details, and `Write` to create polished proposals.

## 9. Form Flow Optimizer
A practical everyday agent that optimizes conversion rates for multi-step forms:
- Navigates through your form flow automatically, filling fields with realistic test data
- Measures time spent on each field and identifies slow-to-interact inputs
- Records user experience friction: fields that require multiple attempts, confusing labels, validation errors
- Analyzes drop-off points where users might abandon the form
- Takes snapshots at each step to identify visual clarity issues
- Tests form validation behavior and error message clarity
- Generates heat map data showing which fields take longest to complete
- Provides actionable UX recommendations with predicted conversion improvements
- Creates A/B test variations with optimized field order, labels, and validation patterns
- Perfect for increasing sign-ups, checkouts, and lead generation without guesswork
This analyzes your form in under 60 seconds. Uses Chrome DevTools MCP for automation and network analysis, creates optimization reports with `Write`.

## 10. Link Rot Detector
A tiny quick agent that finds all broken links and dead resources on your site:
- Blazingly fast crawl (under 10 seconds) of your entire site to discover all internal and external links
- Checks for 404 errors, broken anchor links, and redirect chains
- Identifies slow-loading external resources that hurt page performance
- Detects mixed content warnings (HTTP resources on HTTPS pages)
- Validates that all image sources exist and load correctly
- Lists suspicious links: shortened URLs, expired domains, dead social media profiles
- Generates markdown report with file:line references for easy fixing in your codebase
- Can run as pre-deployment check in CI/CD pipeline
- Perfect for maintaining site quality and SEO health
This scans your site in under 10 seconds. Uses Chrome DevTools MCP for navigation and network requests, `Write` to generate clean reports.
