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

## 13. Feature Flag Drift Sniffer
A tiny quick agent that keeps feature flags tidy and up-to-date:
- Finds stale flags by correlating rollout percentages and last-usage timestamps in under five seconds
- Scans code for dead flag branches or flags stuck in permanent rollout states using `Grep`
- Checks experiment dashboards via `WebFetch` to see if data collection has stopped
- Suggests cleanup diffs removing obsolete conditions and updating documentation
- Generates a slack-ready summary listing flags to sunset this sprint
- Perfect for teams drowning in legacy flags that slow down releases
This runs instantly as a pre-commit hook. Uses `Read` for flag configs, `Grep` for usage sweeps, and `Write` to emit cleanup guidance.

## 14. Epic Quest Career Architect
An outside-the-box agent that turns your dream developer journey into a playable questline:
- Mines repos, blog posts, and commit history to build a "current stats" profile of your skills, passions, and narrative beats
- Scans job boards, conference talk themes, and OSS trends with `WebSearch` to map the legendary destinations you care about
- Generates a branching quest log with weekly missions, side quests, and boss fights that unlock specific dream milestones
- Summons holographic mentor personas by remixing interviews, talks, and books into personalized guidance scripts
- Projects alternate future timelines showing what happens if you pick different quest branches, weighted by momentum and burnout risk
- Rewards completed quests with brag-document entries, portfolio artifacts, and celebratory social posts
- Tracks morale, XP, and rare loot (network invites, speaking slots, stretch projects) so you see compounded wins
- Perfect for devs who chase legendary careers but need epic storytelling to stay motivated
This weaves your heroic roadmap in under 90 seconds. Uses `Bash` for git archeology, `Read` for narrative mining, `WebSearch` for horizon scanning, and `Write` to render cinematic quest scrolls.

## 54. Test Skip Tripwire
A tiny quick agent that stops accidental `skip` and `todo` tests from silently shipping:
- Globs for test files changed in the latest commit or branch
- Flags `it.skip`, `describe.only`, `pytest.mark.skip`, and framework-specific suppression patterns
- Surfaces historical context showing when the test was last unskipped or why it was muted
- Suggests lightweight fixes or alternative guards (feature flags, mocks) to keep coverage active
- Emits a compact PR comment or Slack-ready snippet with the risky skips highlighted
- Perfect for teams tightening test discipline without adding manual review overhead
This fires in under 3 seconds. Uses `Glob`, `Grep`, and `Read` to keep the safety net intact.


## 60. Dream Stack Residency Curator
An outside-the-box agent that turns a developer's moonshot aspirations into a funded residency roadmap:
- Mines personal blogs, commits, and social posts to map the skills and passions that define their dream lab
- Scans fellowships, residencies, and builder programs to surface the ones aligned with the developer's vibe and goals
- Generates story-driven pitch briefs with prototypes to build, metrics to capture, and narratives to share with sponsors
- Designs a mentorship constellation of experts, peer circles, and asynchronous rituals to keep momentum soaring
- Synthesizes financial scaffolding: grant templates, sponsorship ladders, and patron outreach sequences
- Projects alternative timelines showing how each residency accelerates their legendary endpoint
- Perfect for devs who want to manifest their ultimate playground instead of waiting for the perfect opportunity
This assembles a custom residency masterplan in under 90 seconds. Uses `WebSearch`, `Read`, `Task`, and `Write` to weave the dream.

## 62. Package Script Orphan Snipper
A tiny quick agent that prunes unused package scripts before they linger like dead weight:
- Parses `package.json`, `bunfig.toml`, and monorepo workspace configs for declared scripts
- Greps commit history, CI configs, and documentation to track whether scripts are actually invoked
- Flags orphaned scripts, missing dependencies, or duplicated commands with context
- Suggests inline replacements or archive notes so removals stay safe
- Emits a compact diff-ready markdown snippet for PRs or quick cleanups
- Perfect for keeping your automation menu lean and trustworthy
This runs in under three seconds. Uses `Read`, `Grep`, and `Write` to snip orphaned scripts before they rot.

## 73. Moonshot Alliance Architect
An outside-the-box agent that assembles the dream collaborators and resources for your moonshot build:
- Maps your repositories, talks, and social footprints with `Read` and `WebFetch` to understand your north star
- Cross-references fellowship lists, open-source ecosystems, and venture scout posts via `WebSearch` to surface aligned partners
- Designs multi-channel outreach cadences with personalized pitch decks, demo scripts, and mutual-benefit framings
- Simulates coalition scenarios that balance roles, funding, and timelines so you can choose the most energizing crew
- Tracks commitment signals, follow-ups, and blockers in a living alliance dashboard
- Perfect for devs who want to graduate from solo tinkering to a legendary, well-supported lab
This forges your moonshot alliance in under two minutes. Uses `Task` for orchestration, `Read` for storytelling assets, and `WebSearch` for opportunity scouting.

## 75. ESLint Disable Sentinel
A tiny quick agent that stops `eslint-disable` comments from turning into permanent blind spots:
- Globs for JS/TS files touched in the latest branch and uses `Grep` to spot `eslint-disable` directives
- Reads surrounding code to classify whether the comment still guards a real lint violation or can be removed safely
- Suggests precise diffs to re-enable lint rules, including modernizing code snippets when the original issue disappeared
- Emits a punchy PR comment summarizing risky suppressions, sorted by severity and ownership
- Perfect for teams who treat lint suppressions as temporary debt, not forever free passes
This runs in under five seconds. Uses `Glob`, `Grep`, `Read`, and `Write` to keep lint discipline tight.
