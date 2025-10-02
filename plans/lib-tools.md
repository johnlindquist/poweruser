# Refactoring Plan: Consolidate Agent CLI Tools into Lib

**Goal:** Reduce code duplication across agent scripts by extracting common command-line interface (CLI) utility functions into the `agents/lib` directory. This will improve maintainability, consistency, and accelerate new agent development.

## 1. Analysis: Identified Duplication

A review of the agent scripts in the `agents/` directory reveals significant duplication of logic for handling CLI arguments. The most common repeated patterns are:

1.  **Flag Parsing Functions:** Many agents define their own helper functions to read string, number, and boolean flags (e.g., `readStringFlag`, `readNumberFlag`, `readBooleanFlag`). This logic is often identical. Agents like `chrome-console-error-hunter.ts`, `ci-failure-explainer.ts`, and `dependency-update-guardian.ts` contain near-identical implementations.

2.  **Agent Flag Removal:** A common pattern is a `removeAgentFlags` function that deletes agent-specific flags from the `parsedArgs.values` object before passing the remaining flags to the `claude` wrapper. The implementation is the same across many agents; only the list of keys to remove differs.

3.  **Option Parsing Boilerplate:** The overall structure of the main `parseOptions` function in each agent is highly repetitive:
    *   Get `values` and `positionals` from `parsedArgs`.
    *   Check for a `--help` or `-h` flag to print help text.
    *   Read various flags using helper functions.
    *   Construct and return a typed options object.

## 2. Proposed Refactoring Plan

To eliminate this duplication, I propose creating a new shared module for these utilities.

### Step 2.1: Create `agents/lib/cli.ts`

A new file, `agents/lib/cli.ts`, will be created to house all shared CLI helper functions.

### Step 2.2: Extract and Generalize Helper Functions

The following functions will be extracted from various agents, generalized, and moved into `agents/lib/cli.ts`:

*   **`readStringFlag(name: string): string | undefined`**: A function to safely read a string value for a given flag name from `parsedArgs`.
*   **`readNumberFlag(name: string, defaultValue: number): number`**: A function to read and parse a number for a given flag, with a fallback to a default value.
*   **`readBooleanFlag(name: string, defaultValue: boolean): boolean`**: A function to safely check for the presence of a boolean flag.
*   **`removeAgentFlags(agentKeys: readonly string[]): void`**: A generic function that accepts an array of flag names and removes them from `parsedArgs.values`.

### Step 2.3: Update `agents/lib/index.ts`

The new helper functions from `agents/lib/cli.ts` will be exported from the main `agents/lib/index.ts` barrel file for easy consumption by all agents.

### Step 2.4: Refactor Agents to Use Shared Utilities

All agents currently implementing their own versions of the functions listed above will be refactored to import and use the new, centralized versions from `./lib`.

**Example Refactoring for `chrome-console-error-hunter.ts`:**

1.  **Remove Local Definitions:** Delete the local `readStringFlag`, `readNumberFlag`, and `readBooleanFlag` functions from the script.
2.  **Update Imports:** Add the new helpers to the existing import from `./lib`.
    ```typescript
    // Before
    import { claude, getPositionals, parsedArgs } from './lib';

    // After
    import { claude, getPositionals, parsedArgs, readStringFlag, readNumberFlag, readBooleanFlag } from './lib';
    ```
3.  **No Other Changes Needed:** The `parseOptions` function will now use the imported helpers, and the rest of the script remains unchanged.

## 3. Benefits of This Refactoring

*   **Reduced Duplication (DRY):** Eliminates hundreds of lines of redundant code, making the codebase smaller and cleaner.
*   **Improved Maintainability:** Bug fixes or enhancements to CLI parsing logic can be made in a single, central location, benefiting all agents simultaneously.
*   **Enhanced Consistency:** Ensures all agents handle CLI arguments in a uniform and predictable manner.
*   **Faster Development:** New agents can be scaffolded more quickly by reusing this robust set of common utilities, allowing developers to focus on the agent's core logic.
