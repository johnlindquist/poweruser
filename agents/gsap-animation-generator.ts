#!/usr/bin/env -S bun run

import { claude, parsedArgs, removeAgentFlags } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

interface AnimationOptions {
  description: string;
  outputDir: string;
  iterations: number;
  currentIteration: number;
  previousChoice?: number;
}

function printHelp(): void {
  console.log(`
🎬 GSAP Animation Generator

Usage:
  bun run agents/gsap-animation-generator.ts "<description>" [options]

Arguments:
  description          Natural language description of desired animation

Options:
  --output <dir>       Output directory (default: ./animations)
  --iterations <n>     Number of refinement iterations (default: 3)
  --help, -h           Show this help

Examples:
  bun run agents/gsap-animation-generator.ts "a bouncing ball with elastic easing"
  bun run agents/gsap-animation-generator.ts "fade in cards from left to right" --output ./demos
  `);
}

function parseOptions(): AnimationOptions | null {
  const { values, positionals } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const description = positionals[0];
  if (!description) {
    console.error('❌ Error: Animation description is required');
    printHelp();
    process.exit(1);
  }

  const outputDir = typeof values.output === "string" ? values.output : "./animations";
  const iterations = typeof values.iterations === "number" ? values.iterations : 3;

  return {
    description,
    outputDir,
    iterations,
    currentIteration: 1
  };
}

const options = parseOptions();
if (!options) process.exit(0);

console.log('🎬 GSAP Animation Generator\n');
console.log(`Description: "${options.description}"`);
console.log(`Output: ${options.outputDir}`);
console.log(`Max Iterations: ${options.iterations}\n`);

// System prompt that defines the animation generation workflow
const systemPrompt = `You are a GSAP animation expert specializing in creating multiple variations of animations for iterative refinement.

CRITICAL: This is an INTERACTIVE refinement session. After generating variations:
1. AUTOMATICALLY open the HTML file in the user's browser using the Bash tool
2. WAIT for user feedback about which variation they prefer
3. When user indicates a favorite (e.g., "I like variation 2" or "energetic and fast"), IMMEDIATELY generate 5 NEW variations based on that choice
4. Each refinement iteration should take the preferred style as a BASE and create 5 subtle variations exploring different aspects
5. Continue this iterative process until the user is satisfied

WORKFLOW FOR INITIAL GENERATION:
1. Generate a SINGLE HTML page with 5 distinct animation variations displayed side-by-side
2. Each variation should explore different approaches: timing, easing, sequencing, effects
3. Create one standalone HTML file with embedded GSAP library and inline CSS
4. Use GSAP 3.x from CDN (https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js)
5. Include clear visual labels showing "Variation 1", "Variation 2", etc.
6. Make variations significantly different, not just minor tweaks
7. Add selection UI where users can click to highlight their favorite
8. Include replay/restart controls for all animations
9. Save as animations.html in the specified output directory
10. IMMEDIATELY open in browser using: bash command "open animations/animations.html" (or appropriate command for platform)
11. WAIT for user to indicate their preference

WORKFLOW FOR REFINEMENT ITERATIONS:
When user says they prefer a variation (e.g., "I like energetic and fast" or "variation 2"):
1. Take that variation's core characteristics as the base
2. Generate 5 NEW variations that are subtle refinements of that style
3. Explore minor tweaks: slightly different timing, alternative easing within same family, varied sequencing
4. Overwrite animations.html with the new set
5. AUTOMATICALLY re-open the file in browser
6. WAIT for next preference
7. Repeat until user is satisfied

VARIATION STRATEGIES (INITIAL):
- Variation 1: Conservative, smooth, professional
- Variation 2: Energetic, fast, dynamic
- Variation 3: Playful, bouncy, exaggerated easing
- Variation 4: Elegant, slow, sophisticated
- Variation 5: Creative, experimental, unique approach

REFINEMENT STRATEGIES (when user picks favorite):
- Take chosen variation as base (e.g., "Energetic & Fast")
- Create 5 subtle variations:
  - Variation 1: Slightly faster timing
  - Variation 2: Alternative easing function in same family
  - Variation 3: Different stagger/sequencing pattern
  - Variation 4: Adjusted collision/interaction dynamics
  - Variation 5: Modified exit animation

HTML STRUCTURE:
Single page with:
- Grid layout showing all 5 variations side-by-side (responsive)
- Each variation in its own container with:
  - Descriptive title with variation number
  - Animation area with visible elements and good contrast
  - Individual replay button
  - Brief description of the technique used
- Selection UI (click variation to highlight/select favorite)
- Global controls (replay all, reset selection)
- Clean, modern styling
- Instructions for user at the top
- Comments explaining the GSAP techniques used

GSAP BEST PRACTICES:
- Use gsap.to(), gsap.from(), gsap.fromTo() appropriately
- Leverage timelines for complex sequences
- Explore different easing functions (power, elastic, bounce, back, etc.)
- Use stagger for multiple elements
- Namespace animations to avoid conflicts between variations
- Add proper cleanup and replay functionality for each variation

OUTPUT REQUIREMENTS:
- Single HTML file with all 5 variations
- Ensure all animations auto-play on load
- Make variations visually distinct and easily comparable
- Responsive grid that works on mobile and desktop
- Include TodoWrite tracking for generation progress
- ALWAYS open in browser after generation using Bash tool`;

const prompt = `Generate a SINGLE HTML page with 5 GSAP animation variations for: "${options.description}"

Create ${options.outputDir}/animations.html containing:
- All 5 variations displayed in a responsive grid layout
- Each variation with its own animation area, label, and replay button
- GSAP library from CDN
- Inline CSS styling
- Selection UI to highlight favorite variation
- Global replay controls

Each variation should use different approaches to: "${options.description}"
- Different timing/duration
- Different easing functions
- Different sequencing strategies
- Different visual effects

Make variations significantly different and easily comparable in a single view.

CRITICAL: After creating the file, IMMEDIATELY open it in the browser using the Bash tool with the command:
- macOS: open ${options.outputDir}/animations.html
- Windows: start ${options.outputDir}/animations.html
- Linux: xdg-open ${options.outputDir}/animations.html

Then WAIT for the user to tell you which variation they prefer. When they indicate a preference (e.g., "I like variation 2" or "energetic and fast"), IMMEDIATELY:
1. Read the current animations.html file to understand the preferred variation
2. Generate 5 NEW subtle variations based on that preferred style
3. Overwrite animations.html with the new variations
4. Open the file again in the browser
5. Wait for the next preference

Continue this interactive refinement loop until the user is satisfied with the animation.`;

const settings: Settings = {};
const allowedTools = [
  "Write",
  "Read",
  "Bash",
  "TodoWrite",
  "Edit",
  "Glob"
];

removeAgentFlags([
  "output",
  "iterations",
  "help",
  "h"
]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "acceptEdits",
  "append-system-prompt": systemPrompt,
};

try {
  const exitCode = await claude(prompt, defaultFlags);
  if (exitCode === 0) {
    console.log('\n✨ Animation variations generated!');
    console.log(`📁 Output: ${options.outputDir}/`);

    const htmlPath = `${options.outputDir}/animations.html`;
    console.log(`📄 Opening ${htmlPath} in browser...`);

    // Auto-open in browser
    const openCommand = process.platform === 'darwin' ? 'open' :
                       process.platform === 'win32' ? 'start' : 'xdg-open';
    await Bun.spawn([openCommand, htmlPath], { stdio: ['ignore', 'ignore', 'ignore'] }).exited;

    console.log('\n💡 To refine: Select your favorite variation and run again with more specific description');
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
