#!/usr/bin/env -S bun run

/**
 * Output Style Builder Agent
 *
 * Meta-agent wrapper around the "Output-Style Builder" meta prompt. Given a style
 * specification (inline or via file), it orchestrates the creation of a compact
 * output style markdown file with an inline Resource Pack section in the user's
 * ~/.claude/output-styles directory. The generated style follows repository conventions:
 * - Compact structure with inline resource references
 * - 3-word maximum slug naming (lowercase, dash-separated)
 * - Strict research policy with source prioritization
 *
 * Usage:
 *   bun run agents/output-style-builder.ts "Spec text here"
 *   bun run agents/output-style-builder.ts --spec-file ./spec.json --slug nextjs-react
 *
 * Options:
 *   --spec-file <path>   Path to file containing StyleSpec text (overrides inline spec)
 *   --slug <value>       Force slug for output file (default: AI chooses based on spec)
 *   --dry-run            Preview without writing files
 *   --help               Display usage information
 */

import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { claude, parsedArgs } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface OutputStyleBuilderOptions {
  spec: string;
  slug?: string;
  dryRun: boolean;
  specFile?: string;
}

const META_PROMPT = String.raw`SYSTEM (to the AI):
You are "Output‑Style Builder". You create compact output styles for a coding agent.
Each style must (1) be short, (2) encode a strict research policy, and (3) include an inline Resource Pack section with URLs and search heuristics.

SLUG NAMING RULES:
- Choose a slug that is exactly 3 words maximum, lowercase, dash-separated
- Examples: "interactive-doc-learner", "redux-toolkit-pro", "nextjs-react-ts"
- The slug must be descriptive and memorable
- Use this slug for the .md filename

Your job: from a brief StyleSpec (provided inline or gathered via a 4‑question intake), output ONE file:

output-styles/{slug}.md
   - Follows this skeleton exactly:

---
name: {{name}}
description: {{one-sentence purpose for {{domain}}/{{audience}}}}
---

# Custom Style Instructions
Role: Specialized assistant for {{domain}} focused on {{primary_tasks}}.

## Boundaries & Constraints
- Token budget: {{token_budget}} tokens hard cap for this style.
- Do NOT browse randomly. Use sources in the Resource Pack in strict priority order.
- Prefer first-party docs/changelogs/specs before blogs. Defer opinions to official guidance.
- If a version is unspecified, default to {{default_versions or LTS}}; clearly mark version assumptions.
- Only ask the user 1 concise clarifying question if an answer depends on a choice you cannot safely assume.

## Minimal-Research Playbook
1) Try cached/known patterns. 
2) If version-specific or ambiguous, verify against Resource Pack → \`order_of_operations\`.
3) If still unclear, consult exactly the top matching item; stop after 2 sources unless a security or data-loss risk is present.
4) Summarize findings in 3 bullets with links.

## Response Shape
- Start with: **Plan** (bullets).
- Then: **Answer/Code** (tested or runnable when applicable).
- End with: **Sources used** (links from Resource Pack below).

## Resource Pack
### Default Versions
- {{lang_or_framework}}: {{version_or_LTS}}

### Source Priority Order
1. First-party documentation
2. Changelogs and release notes
3. Standards and specifications
4. Official tooling documentation
5. Vetted guides and references (only if first-party lacks coverage)

### Curated Sources
#### First-Party Documentation
- [{{name}}]({{url}}) - {{notes}}

#### Changelogs & Release Notes
- [{{name}}]({{url}}) - {{notes}}

#### Standards & Specifications
- [{{name}}]({{url}})

#### Official Tooling
- [{{name}}]({{url}})

#### Vetted Guides & References
- [{{name}}]({{url}}) - Use only when first-party docs lack coverage

### Search Heuristics
- \`site:{{official_domain}} "{{component}}" "release notes"\`
- \`site:github.com/{{org}}/{{repo}} releases {{keyword}}\`

### Sanity Checks
- Confirm examples compile/run on {{version}}
- If new major version detected, scan migration guide

### Risk Policy
- Security-critical: Expand to 4 sources, prefer vendor advisories
- Build/deploy: Verify against official CI/CD examples

### Output Rules
- Link budget: 8 max citations per answer
- Follow citation tiers in order of source priority

PROCESS:
If the user provides a StyleSpec as JSON or a short paragraph, extract:
- name, slug, domain, audience, primary_tasks, tech_stack (w/ versions), token_budget, default_versions, and any must-include sources.
If no StyleSpec provided, ask exactly these 4 questions:
1) Domain + top 3 tasks? 
2) Tech stack + versions (or LTS)? 
3) Audience + risk level (prototype vs production)? 
4) Token budget for the style (default 350)?
Then produce the two files. Keep the .md short and push all URLs to the YAML.

QUALITY BAR:
- No fluff. 
- 0 broken links.
- Only official or clearly authoritative sources unless the user requests otherwise.
- Respect the token budget in the style .md.

OUTPUT FORMAT:
Return one fenced code block with file hint:
\`\`\`file:output-styles/{{slug}}.md
...content with inline Resource Pack section...
\`\`\`

EXAMPLE & CHECKLIST:
- Follow the example workflow described for "Next.js + React + TS" styles.
- Governance checklist: one style per domain bundle, source tiering, LTS defaults, link budget, inline Resource Pack section in the markdown file, add calibration prompts.

CURATED SOURCES LIST SUMMARY:
- Frontend/Web: Next.js Docs, React Docs, TypeScript Handbook, MDN, ECMA-262, WHATWG HTML.
- Release Notes: Next.js, React, TypeScript, Node.js.
- Tooling: Vercel Docs, Node Docs, ESLint, SWC.
- Performance: web.dev, Can I Use.
- Alternate FE stacks: Angular, Vue, Svelte docs.
- Python/Data: Python docs, PEP index, PyPI, pandas, NumPy, Django, FastAPI.
- Cloud/DevOps: Kubernetes docs + releases, Helm, Docker, Terraform, AWS/Azure/GCP docs, CNCF landscape.
- Databases: PostgreSQL, MySQL, MongoDB docs.
- AppSec: OWASP Top 10.
- AI Engineering: OpenAI, Anthropic, LangChain, LlamaIndex, Hugging Face docs.

Use these curated URLs to populate Resource Packs when relevant.`;

function buildPrompt(options: OutputStyleBuilderOptions): string {
  const { spec, slug: providedSlug } = options;

  const outputStylesDir = join(homedir(), '.claude', 'output-styles');

  const instructions = providedSlug
    ? `StyleSpec:\n${spec}\n\nProject conventions:\n- Use the slug: ${providedSlug}\n- Write the output style markdown to: ${outputStylesDir}/${providedSlug}.md\n- Include the Resource Pack section inline within the markdown file\n- Ensure ${outputStylesDir} exists (use Bash mkdir -p if needed).\n- Follow repository CLI/comment conventions.\n- After writing the file, provide a concise summary and the code block required by the meta prompt.`
    : `StyleSpec:\n${spec}\n\nProject conventions:\n- Choose an appropriate slug following the SLUG NAMING RULES (3 words max, lowercase, dash-separated)\n- Write the output style markdown to: ${outputStylesDir}/{{slug}}.md\n- Include the Resource Pack section inline within the markdown file\n- Ensure ${outputStylesDir} exists (use Bash mkdir -p if needed).\n- Follow repository CLI/comment conventions.\n- After writing the file, provide a concise summary and the code block required by the meta prompt.`;

  return instructions;
}

function printHelp(): void {
  console.log(`
🧱 Output Style Builder

Usage:
  bun run agents/output-style-builder.ts "<StyleSpec text>"

Arguments:
  spec                 StyleSpec text describing the output style to create

Options:
  --spec-file <path>   Path to file containing StyleSpec text (overrides positional)
  --slug <value>       Explicit slug for output file (default: AI chooses)
  --dry-run            Preview actions without writing files
  --help, -h           Show this help

Examples:
  # Inline spec - AI chooses slug
  bun run agents/output-style-builder.ts "Web FE engineer for React + Next.js + TypeScript"

  # Spec file with explicit slug
  bun run agents/output-style-builder.ts --spec-file ./specs/python.md --slug python-data

  # Dry run preview
  bun run agents/output-style-builder.ts "SRE for Kubernetes" --dry-run

Note: Output will be created at ~/.claude/output-styles/{slug}.md with inline Resource Pack
  `);
}

function parseOptions(): OutputStyleBuilderOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawSpecFile = values["spec-file"] || values.specFile;
  const rawSlug = values.slug;
  const dryRun = values["dry-run"] === true || values.dryRun === true;

  let specFile: string | undefined;
  let slug: string | undefined;

  if (typeof rawSpecFile === "string" && rawSpecFile.length > 0) {
    specFile = resolve(rawSpecFile);
  }

  if (typeof rawSlug === "string" && rawSlug.length > 0) {
    slug = rawSlug;
  }

  let specText = positionals.join(" ").trim();

  if (!specText && !specFile) {
    console.error("❌ Error: StyleSpec text or --spec-file is required");
    printHelp();
    process.exit(1);
  }

  return {
    spec: specText,
    slug,
    dryRun,
    specFile,
  };
}

function removeAgentFlags(): void {
  const values = parsedArgs.values as Record<string, unknown>;
  const agentKeys = ["spec-file", "specFile", "slug", "dry-run", "dryRun", "help", "h"] as const;

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

// Load spec file if provided
if (options.specFile) {
  try {
    const fileText = await readFile(options.specFile, "utf8");
    options.spec = fileText.trim();
  } catch (error) {
    console.error(`❌ Unable to read spec file: ${options.specFile}`);
    console.error(error);
    process.exit(1);
  }
}

if (!options.spec) {
  console.error("❌ StyleSpec text is required");
  process.exit(1);
}

const outputStylesDir = join(homedir(), '.claude', 'output-styles');

console.log("🧱 Output Style Builder\n");
if (options.slug) console.log(`Slug: ${options.slug}`);
console.log(`Output directory: ${outputStylesDir}`);
console.log(`Dry run: ${options.dryRun ? "Yes" : "No"}`);
console.log("");

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  "Task",
  "Glob",
  "Read",
  "Write",
  "Edit",
  "Bash",
  "BashOutput",
  "TodoWrite",
];

removeAgentFlags();

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": options.dryRun ? "default" : "acceptEdits",
  "append-system-prompt": META_PROMPT,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log("\n✨ Output style creation complete!\n");
    console.log(`📂 Output directory: ${outputStylesDir}`);
    if (options.slug) {
      console.log(`📄 File: ${options.slug}.md`);
    }
    console.log("\nNext steps:");
    console.log("1. Review the generated output style");
    console.log("2. Test it with: claude --output-style <slug>");
    console.log("3. Adjust the Resource Pack as needed");
  }
  process.exit(exitCode);
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
