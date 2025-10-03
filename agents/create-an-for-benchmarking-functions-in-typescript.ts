#!/usr/bin/env -S bun run

/**
 * TypeScript Function Benchmarking Agent
 *
 * Comprehensive performance benchmarking agent for TypeScript functions:
 * - Auto-discovers benchmark targets via file patterns or explicit function names
 * - Generates benchmark suites using Bun's built-in benchmarking APIs
 * - Executes multi-iteration performance tests with statistical analysis
 * - Compares results across function variants (e.g., optimized vs baseline)
 * - Produces detailed performance reports with percentile breakdowns
 * - Identifies performance regressions and optimization opportunities
 *
 * Usage:
 *   bun run agents/create-an-for-benchmarking-functions-in-typescript.ts [options]
 *
 * Options:
 *   --file <path>           Path to TypeScript file containing functions to benchmark
 *   --function <name>       Specific function name(s) to benchmark (comma-separated)
 *   --iterations <number>   Number of iterations per benchmark (default: 10000)
 *   --warmup <number>       Warmup iterations before measurement (default: 1000)
 *   --compare <path>        Compare with baseline results from previous run
 *   --output <path>         Output report path (default: benchmark-report.md)
 *   --format <type>         Output format: markdown|json|console (default: markdown)
 *   --suite <name>          Benchmark suite name for grouped results
 *   --help, -h              Show this help
 */

import { resolve } from "node:path";
import { claude, parsedArgs, removeAgentFlags } from "./lib";
import type { ClaudeFlags, Settings } from "./lib";

const OUTPUT_FORMATS = ['markdown', 'json', 'console'] as const;
type OutputFormat = (typeof OUTPUT_FORMATS)[number];

interface BenchmarkOptions {
  filePath: string | null;
  functionNames: string[];
  iterations: number;
  warmupIterations: number;
  compareBaseline: string | null;
  outputPath: string;
  outputFormat: OutputFormat;
  suiteName: string | null;
}

const DEFAULT_ITERATIONS = 10000;
const DEFAULT_WARMUP = 1000;
const DEFAULT_OUTPUT = 'benchmark-report.md';
const DEFAULT_FORMAT: OutputFormat = 'markdown';

function printHelp(): void {
  console.log(`
⚡ TypeScript Function Benchmarking Agent

Usage:
  bun run agents/create-an-for-benchmarking-functions-in-typescript.ts [options]

Options:
  --file <path>           Path to TypeScript file containing functions to benchmark
  --function <name>       Specific function name(s) to benchmark (comma-separated)
  --iterations <number>   Number of iterations per benchmark (default: ${DEFAULT_ITERATIONS})
  --warmup <number>       Warmup iterations before measurement (default: ${DEFAULT_WARMUP})
  --compare <path>        Compare with baseline results from previous run (JSON format)
  --output <path>         Output report path (default: ${DEFAULT_OUTPUT})
  --format <type>         Output format: markdown|json|console (default: ${DEFAULT_FORMAT})
  --suite <name>          Benchmark suite name for grouped results
  --help, -h              Show this help

Examples:
  # Benchmark all exported functions in a file
  bun run agents/create-an-for-benchmarking-functions-in-typescript.ts --file ./src/utils.ts

  # Benchmark specific functions with custom iterations
  bun run agents/create-an-for-benchmarking-functions-in-typescript.ts --file ./src/utils.ts --function parseData,formatData --iterations 50000

  # Compare with previous baseline results
  bun run agents/create-an-for-benchmarking-functions-in-typescript.ts --file ./src/utils.ts --compare ./baseline.json

  # Generate JSON output for CI/CD integration
  bun run agents/create-an-for-benchmarking-functions-in-typescript.ts --file ./src/utils.ts --format json --output results.json

  # Run a named benchmark suite
  bun run agents/create-an-for-benchmarking-functions-in-typescript.ts --file ./src/parsers.ts --suite "Parser Performance Suite"
  `);
}

function parseOptions(): BenchmarkOptions | null {
  const { values } = parsedArgs;
  const help = values.help === true || values.h === true;

  if (help) {
    printHelp();
    return null;
  }

  const rawFile = values.file;
  const rawFunctions = values.function;
  const rawIterations = values.iterations;
  const rawWarmup = values.warmup;
  const rawCompare = values.compare;
  const rawOutput = values.output;
  const rawFormat = values.format;
  const rawSuite = values.suite;

  const filePath = typeof rawFile === "string" && rawFile.length > 0
    ? resolve(rawFile)
    : null;

  const functionNames = typeof rawFunctions === "string" && rawFunctions.length > 0
    ? rawFunctions.split(',').map(f => f.trim()).filter(f => f.length > 0)
    : [];

  let iterations = DEFAULT_ITERATIONS;
  if (typeof rawIterations === "string" || typeof rawIterations === "number") {
    const value = Number(rawIterations);
    if (!Number.isNaN(value) && value > 0) {
      iterations = value;
    }
  }

  let warmupIterations = DEFAULT_WARMUP;
  if (typeof rawWarmup === "string" || typeof rawWarmup === "number") {
    const value = Number(rawWarmup);
    if (!Number.isNaN(value) && value >= 0) {
      warmupIterations = value;
    }
  }

  const compareBaseline = typeof rawCompare === "string" && rawCompare.length > 0
    ? resolve(rawCompare)
    : null;

  const outputPath = typeof rawOutput === "string" && rawOutput.length > 0
    ? rawOutput
    : DEFAULT_OUTPUT;

  let outputFormat: OutputFormat = DEFAULT_FORMAT;
  if (typeof rawFormat === "string" && rawFormat.length > 0) {
    const format = rawFormat.toLowerCase();
    if (OUTPUT_FORMATS.includes(format as OutputFormat)) {
      outputFormat = format as OutputFormat;
    } else {
      console.warn(`⚠️  Unknown format "${format}". Falling back to "${DEFAULT_FORMAT}".`);
    }
  }

  const suiteName = typeof rawSuite === "string" && rawSuite.length > 0
    ? rawSuite
    : null;

  return {
    filePath,
    functionNames,
    iterations,
    warmupIterations,
    compareBaseline,
    outputPath,
    outputFormat,
    suiteName,
  };
}

function buildPrompt(options: BenchmarkOptions): string {
  const { filePath, functionNames, iterations, warmupIterations, compareBaseline, outputPath, outputFormat, suiteName } = options;

  return `You are the "TypeScript Function Benchmarking Agent". Your mission is to create comprehensive performance benchmarks for TypeScript functions.

Core workflow:
1. Target discovery
   ${filePath ? `- Analyze the file: ${filePath}` : '- Search the current directory for TypeScript files with exported functions'}
   ${functionNames.length > 0 ? `- Focus specifically on these functions: ${functionNames.join(', ')}` : '- Auto-detect all exported functions as benchmark candidates'}
   - Verify function signatures and extract parameter types for test data generation
   - Skip internal/private functions unless explicitly requested

2. Benchmark suite generation
   - Create a benchmark file using Bun's native benchmarking API (Bun.bench())
   - Generate realistic test data matching function parameter types:
     * Primitives: use representative values
     * Arrays/Objects: create varied sizes (small/medium/large datasets)
     * Complex types: instantiate with realistic values
   - Set iterations to ${iterations} per benchmark
   - Configure warmup runs: ${warmupIterations} iterations
   ${suiteName ? `- Group benchmarks under suite: "${suiteName}"` : '- Use file-based naming for benchmark groups'}

3. Benchmark execution
   - Run the generated benchmark file via \`bun run <benchmark-file>\`
   - Capture timing results: mean, min, max, p50, p95, p99 percentiles
   - Monitor for outliers and unstable measurements
   - Detect JIT optimization patterns if applicable
   - Calculate operations per second (ops/s) and time per operation

4. Statistical analysis
   - Compute standard deviation and coefficient of variation
   - Identify performance characteristics (CPU-bound, memory-bound, I/O)
   - Flag suspiciously fast results (possible dead code elimination)
   - Compare relative performance between function variants
   ${compareBaseline ? `- Load baseline results from: ${compareBaseline}` : ''}
   ${compareBaseline ? '- Calculate performance delta percentages (regression/improvement)' : ''}
   ${compareBaseline ? '- Highlight regressions exceeding 5% threshold' : ''}

5. Report generation
   - Generate ${outputFormat} formatted report at: ${outputPath}
   ${outputFormat === 'markdown' ? `- Include sections: Executive Summary, Benchmark Results Table, Performance Insights, Recommendations
   - Use tables with function name, ops/s, mean time, percentiles
   - Add visualizations (ASCII charts) for timing distributions` : ''}
   ${outputFormat === 'json' ? '- Structure: { suite, timestamp, results: [{ function, stats, percentiles }], baseline_comparison }' : ''}
   ${outputFormat === 'console' ? '- Pretty-print results to console with color-coded performance indicators' : ''}
   - Provide actionable optimization suggestions based on results
   - Recommend profiling next steps for slow functions

Operating constraints:
- Use Bun.bench() for all benchmarks (leverages Bun's optimized harness)
- Never modify the original source files being benchmarked
- Generate benchmark files in a temporary .benchmarks/ directory
- Ensure benchmarks are deterministic (avoid random data unless testing randomness)
- Clean up temporary benchmark files after execution unless --keep flag is set
- For async functions, properly await and measure Promise resolution time
- Handle errors gracefully: log failures but continue with remaining benchmarks

Performance best practices:
- Avoid dead code elimination: ensure function results are used
- Minimize setup/teardown overhead in hot paths
- Run garbage collection between benchmarks if measuring memory-sensitive code
- Report confidence intervals when variance is high
- Suggest larger iteration counts if results are unstable (CV > 10%)

Deliverable: Comprehensive benchmark report with actionable performance insights and optimization guidance.`;
}

const options = parseOptions();
if (!options) {
  process.exit(0);
}

console.log('⚡ TypeScript Function Benchmarking Agent\n');
if (options.filePath) {
  console.log(`📁 Target file: ${options.filePath}`);
} else {
  console.log('📁 Auto-discovering functions in current directory');
}
if (options.functionNames.length > 0) {
  console.log(`🎯 Specific functions: ${options.functionNames.join(', ')}`);
}
console.log(`🔄 Iterations: ${options.iterations} (warmup: ${options.warmupIterations})`);
console.log(`📊 Output format: ${options.outputFormat}`);
console.log(`📝 Report path: ${options.outputPath}`);
if (options.compareBaseline) {
  console.log(`📈 Baseline comparison: ${options.compareBaseline}`);
}
if (options.suiteName) {
  console.log(`📦 Suite name: ${options.suiteName}`);
}
console.log();

const prompt = buildPrompt(options);
const settings: Settings = {};

const allowedTools = [
  'Bash',
  'BashOutput',
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'TodoWrite',
];

removeAgentFlags([
  "file", "function", "iterations", "warmup", "compare", "output", "format", "suite", "help", "h"
]);

const defaultFlags: ClaudeFlags = {
  model: "claude-sonnet-4-5-20250929",
  settings: JSON.stringify(settings),
  allowedTools: allowedTools.join(" "),
  "permission-mode": "acceptEdits",
};

try {
  const exitCode = await claude(prompt, defaultFlags);

  if (exitCode === 0) {
    console.log('\n✨ Benchmarking complete!\n');
    console.log(`📄 Full report: ${options.outputPath}`);
    console.log('\nNext steps:');
    console.log('1. Review benchmark results and identify slow functions');
    console.log('2. Profile hotspots using Bun\'s profiler or Chrome DevTools');
    console.log('3. Apply optimizations and re-run benchmarks');
    if (options.compareBaseline) {
      console.log('4. Monitor for regressions in CI/CD pipeline');
    } else {
      console.log('4. Save results as baseline: --compare <output-file>');
    }
  }
  process.exit(exitCode);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
