#!/usr/bin/env bun

/**
 * Output Style Builder Agent
 *
 * Meta-agent wrapper around the "Output-Style Builder" meta prompt. Given a style
 * specification (inline or via file), it orchestrates the creation of a compact
 * output style markdown file alongside a resource pack YAML in the user's
 * ~/.claude directory. The generated agent follows repository conventions:
 * - Annotated CLI usage block
 * - Explicit option parsing
 * - Uses Claude Agent SDK query() with streaming output
 * - Utilizes the provided meta prompt as the system prompt to ensure consistent
 *   structure and sourcing rules
 *
 * Usage:
 *   bun run agents/output-style-builder.ts "Spec text here"
 *   bun run agents/output-style-builder.ts --spec-file ./spec.json --slug nextjs-react
 *
 * Options:
 *   --spec-file <path>   Path to file containing StyleSpec text (overrides inline spec)
 *   --slug <value>       Force slug for output files (default: derived from spec)
 *   --model <id>         Claude model id (default: claude-sonnet-4-5-20250929)
 *   --max-turns <n>      Maximum conversation turns (default: 26)
 *   --dry-run            Preview without writing files
 *   --help               Display usage information
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import os from 'os';
import path from 'path';
import { readFile } from 'fs/promises';

interface OutputStyleBuilderOptions {
  spec: string;
  slug?: string;
  model: string;
  maxTurns: number;
  dryRun: boolean;
}

const META_PROMPT = String.raw`SYSTEM (to the AI): 
You are "Output‑Style Builder". You create compact output styles for a coding agent.
Each style must (1) be short, (2) encode a strict research policy, and (3) reference a sidecar Resource Pack (YAML) that lists URLs and search heuristics. 
Your job: from a brief StyleSpec (provided inline or gathered via a 4‑question intake), output TWO files:

A) output-styles/{slug}.md  (<= 350 tokens)
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
- End with: **Sources used** (links only from Resource Pack).

## Resource Pack
Load and follow: {{resource_pack_path}}
Never paste the entire Resource Pack into the chat.

B) resource-packs/{slug}.yaml
   - Schema (keep to this structure):
name: {{name}}
slug: {{slug}}
domain: {{domain}}
default_versions:
  {{lang_or_framework}}: {{version_or_LTS}}
order_of_operations:
  - first_party_docs
  - changelogs_and_release_notes
  - standards_and_specs
  - official_tooling
  - vetted_guides_and_refs
sources:
  first_party_docs:
    - {name: "...", url: "...", notes: "..."}
  changelogs_and_release_notes:
    - {name: "...", url: "...", notes: "watch cadence, RSS or releases page"}
  standards_and_specs:
    - {name: "...", url: "..."}
  official_tooling:
    - {name: "...", url: "..."}
  vetted_guides_and_refs:
    - {name: "...", url: "...", include_when: "only if first-party lacks coverage"}
search_heuristics:
  exact_queries:
    - 'site:{{official_domain}} "{{component}}" "release notes"'
    - 'site:github.com/{{org}}/{{repo}} releases {{keyword}}'
  sanity_checks:
    - "Confirm example compiles/runs on {{version}}."
    - "If new major version detected, scan migration guide."
risk_policy:
  escalation_rules:
    - "If security-critical, expand to 4 sources and prefer vendor advisories."
    - "If build/deploy, verify against official CI/CD examples."
output_rules:
  link_budget: 8   # max links you may cite in a single answer
  citation_tiers: ["first_party_docs", "changelogs_and_release_notes", "standards_and_specs", "official_tooling", "vetted_guides_and_refs"]

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
Return two fenced code blocks with file hints:
\`\`\`file:output-styles/{{slug}}.md
...content...
\`\`\`\`

\`\`\`file:resource-packs/{{slug}}.yaml
...content...
\`\`\`

EXAMPLE & CHECKLIST:
- Follow the example workflow described for "Next.js + React + TS" styles.
- Governance checklist: one style per domain bundle, source tiering, LTS defaults, link budget, update resource packs on major releases, store under ~/.claude/output-styles and ~/.claude/resource-packs, add calibration prompts.

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

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  const trimmed = base.replace(/^-+|-+$/g, '');
  if (!trimmed) {
    return 'generated-style';
  }
  return trimmed.slice(0, 120);
}

async function runOutputStyleBuilder(options: OutputStyleBuilderOptions) {
  const { spec, slug: providedSlug, model, maxTurns, dryRun } = options;

  const homeDir = os.homedir();
  const outputStylesDir = path.join(homeDir, '.claude', 'output-styles');
  const resourcePackDir = path.join(homeDir, '.claude', 'resource-packs');

  const slug = providedSlug ?? slugify(spec.split('\n')[0] || spec);
  const styleFilePath = path.join(outputStylesDir, `${slug}.md`);
  const resourceFilePath = path.join(resourcePackDir, `${slug}.yaml`);
  const resourceReferencePath = `~/.claude/resource-packs/${slug}.yaml`;

  console.log('🧱 Output Style Builder launched.\n');
  console.log(`🎯 Target slug: ${slug}`);
  console.log(`📝 Style file: ${styleFilePath}`);
  console.log(`📦 Resource pack: ${resourceFilePath}`);
  console.log(`🧪 Dry run: ${dryRun}`);
  console.log(`🧠 Model: ${model}`);
  console.log(`🔁 Max turns: ${maxTurns}\n`);

  const instructions = `StyleSpec:\n${spec}\n\nProject conventions:\n- Write the style markdown to: ${styleFilePath}\n- Write the resource pack YAML to: ${resourceFilePath}\n- Reference the resource pack inside the markdown as: ${resourceReferencePath}\n- Ensure ${outputStylesDir} and ${resourcePackDir} exist (use Bash mkdir -p if needed).\n- Follow repository CLI/comment conventions.\n- After writing files, provide a concise summary and the two code blocks required by the meta prompt.`;

  const result = query({
    prompt: instructions,
    options: {
      cwd: process.cwd(),
      systemPrompt: META_PROMPT,
      allowedTools: [
        'Task',
        'Glob',
        'Read',
        'Write',
        'Edit',
        'Bash',
        'BashOutput',
      ],
      permissionMode: (dryRun ? 'default' : 'acceptEdits') as 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan',
      maxTurns,
      model,
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PreToolUse') {
                  if ((input.tool_name === 'Write' || input.tool_name === 'Edit') && dryRun) {
                    return { continue: false, reason: 'Dry run active; skipping file modifications.' };
                  }
                  if (input.tool_name === 'Task') {
                    console.log('🧭 Planning workflow...');
                  }
                  if (input.tool_name === 'Bash') {
                    const command = (input.tool_input as any)?.command ?? '';
                    if (command.includes('mkdir')) {
                      console.log('📂 Ensuring output directories exist...');
                    }
                  }
                  if (input.tool_name === 'Write') {
                    console.log('📝 Writing output style files...');
                  }
                }
                return { continue: true };
              },
            ],
          },
        ],
        SessionEnd: [
          {
            hooks: [
              async () => {
                console.log('\n📘 Output style generation session complete.');
                return { continue: true };
              },
            ],
          },
        ],
      },
    },
  });

  let success = false;

  for await (const message of result) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          console.log(block.text);
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype === 'success') {
        success = true;
        console.log('\n✅ Output style builder finished successfully.');
        console.log(`⏱️  Duration: ${(message.duration_ms / 1000).toFixed(1)}s`);
        console.log(`💰 Cost: $${message.total_cost_usd.toFixed(4)}`);
        console.log(`🔢 Turns: ${message.num_turns}`);
        if (message.usage) {
          console.log(`📊 Tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);
        }
        if (message.result) {
          console.log(`\n${message.result}`);
        }
      } else {
        console.error('\n❌ Output style builder failed:', message.subtype);
      }
    }
  }

  if (!success) {
    console.warn('\n⚠️  No style files were confirmed. Review the logs above.');
  }
}

function printHelp() {
  console.log(`
Output Style Builder Agent

Usage:
  bun run agents/output-style-builder.ts "<StyleSpec text>"

Options:
  --spec-file <path>   Path to file containing the StyleSpec text (overrides positional text)
  --slug <value>       Explicit slug for output files (default derived from spec)
  --model <id>         Claude model id (default: claude-sonnet-4-5-20250929)
  --max-turns <n>      Max conversation turns (default: 26)
  --dry-run            Preview actions without writing files
  --help               Show this message

Examples:
  # Inline spec
  bun run agents/output-style-builder.ts "Web FE engineer for React + Next.js + TypeScript; production; prefer LTS"

  # Spec file with explicit slug
  bun run agents/output-style-builder.ts --spec-file ./specs/python-style.md --slug python-data

  # Dry run preview
  bun run agents/output-style-builder.ts "SRE style for Kubernetes" --dry-run
  `);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.length === 0) {
    printHelp();
    if (args.includes('--help') || args.length === 0) {
      process.exit(0);
    }
  }

  let specFile: string | undefined;
  let slug: string | undefined;
  let model = 'claude-sonnet-4-5-20250929';
  let maxTurns = 26;
  let dryRun = false;

  const positionalParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--spec-file':
        specFile = args[++i];
        break;
      case '--slug':
        slug = args[++i];
        break;
      case '--model':
        model = args[++i] ?? model;
        break;
      case '--max-turns': {
        const value = Number(args[++i]);
        if (!Number.isNaN(value) && value > 0) {
          maxTurns = value;
        }
        break;
      }
      case '--dry-run':
        dryRun = true;
        break;
      default:
        if (arg && arg.startsWith('--')) {
          console.warn(`⚠️  Ignoring unknown option: ${arg}`);
        } else if (arg) {
          positionalParts.push(arg);
        }
        break;
    }
  }

  let specText = positionalParts.join(' ').trim();

  if (specFile) {
    try {
      const fileText = await readFile(specFile, 'utf8');
      specText = fileText.trim();
    } catch (error) {
      console.error(`❌ Unable to read spec file: ${specFile}`);
      console.error(error);
      process.exit(1);
    }
  }

  if (!specText) {
    console.error('❌ StyleSpec text is required. Provide inline text or --spec-file.');
    process.exit(1);
  }

  await runOutputStyleBuilder({
    spec: specText,
    slug,
    model,
    maxTurns,
    dryRun,
  });
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('❌ Fatal error during output style build:', error);
    process.exit(1);
  });
}

export { runOutputStyleBuilder };
