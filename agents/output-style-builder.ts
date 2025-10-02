#!/usr/bin/env bun

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
 * - Uses Claude Agent SDK query() with streaming output
 *
 * Usage:
 *   bun run agents/output-style-builder.ts "Spec text here"
 *   bun run agents/output-style-builder.ts --spec-file ./spec.json --slug nextjs-react
 *
 * Options:
 *   --spec-file <path>   Path to file containing StyleSpec text (overrides inline spec)
 *   --slug <value>       Force slug for output file (default: AI chooses based on spec)
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

async function runOutputStyleBuilder(options: OutputStyleBuilderOptions) {
  const { spec, slug: providedSlug, model, maxTurns, dryRun } = options;

  const homeDir = os.homedir();
  const outputStylesDir = path.join(homeDir, '.claude', 'output-styles');

  console.log('🧱 Output Style Builder launched.\n');
  console.log(`📂 Output styles directory: ${outputStylesDir}`);
  if (providedSlug) {
    console.log(`🎯 Using provided slug: ${providedSlug}`);
  }
  console.log(`🧪 Dry run: ${dryRun}`);
  console.log(`🧠 Model: ${model}`);
  console.log(`🔁 Max turns: ${maxTurns}\n`);

  const instructions = providedSlug
    ? `StyleSpec:\n${spec}\n\nProject conventions:\n- Use the slug: ${providedSlug}\n- Write the output style markdown to: ${outputStylesDir}/${providedSlug}.md\n- Include the Resource Pack section inline within the markdown file\n- Ensure ${outputStylesDir} exists (use Bash mkdir -p if needed).\n- Follow repository CLI/comment conventions.\n- After writing the file, provide a concise summary and the code block required by the meta prompt.`
    : `StyleSpec:\n${spec}\n\nProject conventions:\n- Choose an appropriate slug following the SLUG NAMING RULES (3 words max, lowercase, dash-separated)\n- Write the output style markdown to: ${outputStylesDir}/{{slug}}.md\n- Include the Resource Pack section inline within the markdown file\n- Ensure ${outputStylesDir} exists (use Bash mkdir -p if needed).\n- Follow repository CLI/comment conventions.\n- After writing the file, provide a concise summary and the code block required by the meta prompt.`;

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
  --slug <value>       Explicit slug for output file (default: AI chooses based on spec)
  --model <id>         Claude model id (default: claude-sonnet-4-5-20250929)
  --max-turns <n>      Max conversation turns (default: 26)
  --dry-run            Preview actions without writing files
  --help               Show this message

Examples:
  # Inline spec - AI will choose slug like "nextjs-react-ts"
  bun run agents/output-style-builder.ts "Web FE engineer for React + Next.js + TypeScript; production; prefer LTS"

  # Spec file with explicit slug
  bun run agents/output-style-builder.ts --spec-file ./specs/python-style.md --slug python-data

  # Dry run preview
  bun run agents/output-style-builder.ts "SRE style for Kubernetes" --dry-run

Note: Output file will be created at ~/.claude/output-styles/{slug}.md with inline Resource Pack
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
