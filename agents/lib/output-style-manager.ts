/**
 * Output Style Manager for Dynamic Style Injection
 * 
 * Manages isolated output styles by dynamically copying them to Claude's
 * expected output-styles directory and cleaning up on exit.
 */

import { copyFile, unlink, mkdir, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

export interface OutputStyleSettings {
    /**
     * The temporary output style name that will be injected into settings
     */
    outputStyle: string

    /**
     * Additional settings to merge (permissions, etc.)
     */
    [key: string]: any
}

/**
 * Manages dynamic injection of isolated output styles into Claude's system
 */
export class OutputStyleManager {
    private sourcePromptPath: string
    private tempStyleName: string
    private outputStylesDir: string
    private tempStylePath: string
    private lockFile: string
    private isSetup: boolean = false

    constructor(sourcePromptPath: string) {
        this.sourcePromptPath = sourcePromptPath
        // Generate unique temp name using process PID and timestamp to avoid conflicts
        this.tempStyleName = `temp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
        this.outputStylesDir = join(homedir(), ".claude", "output-styles")
        this.tempStylePath = join(this.outputStylesDir, `${this.tempStyleName}.md`)
        this.lockFile = join(this.outputStylesDir, `${this.tempStyleName}.lock`)

        console.log(this.tempStyleName)
        console.log(this.outputStylesDir)
        console.log(this.tempStylePath)
        console.log(this.lockFile)
    }

    /**
     * Set up the temporary output style by copying the source to the expected location
     * @returns The temporary style name to use in settings
     */
    async setup(): Promise<string> {
        if (this.isSetup) {
            throw new Error("OutputStyleManager has already been set up")
        }

        // Ensure output-styles directory exists
        await mkdir(this.outputStylesDir, { recursive: true })

        // Create lock file to mark this temp style as ours
        console.log(`CREATING LOCK FILE 🔒 ${this.lockFile}`)
        await writeFile(this.lockFile, process.pid.toString())

        // Copy isolated prompt to expected location
        console.log(`COPYING 📝 ${this.sourcePromptPath} to ${this.tempStylePath}`)
        await copyFile(this.sourcePromptPath, this.tempStylePath)
        console.log(`COPY COMPLETE 📝 ${this.tempStylePath}`)

        this.isSetup = true
        return this.tempStyleName
    }

    /**
     * Clean up temporary files created during setup
     */
    async cleanup(): Promise<void> {
        const cleanupTasks: Promise<void>[] = []

        console.log(`CLEANUP 🧹`)
        console.log(this.tempStylePath)
        console.log(this.lockFile)

        if (existsSync(this.tempStylePath)) {
            cleanupTasks.push(unlink(this.tempStylePath))
        }

        if (existsSync(this.lockFile)) {
            cleanupTasks.push(unlink(this.lockFile))
        }

        await Promise.allSettled(cleanupTasks)
        this.isSetup = false
    }

    /**
     * Generate settings object with the temporary output style injected
     * @param baseSettings - Base settings to merge with output style
     * @returns Settings object with outputStyle set to the temporary style
     */
    async generateSettings(baseSettings: Record<string, any> = {}): Promise<OutputStyleSettings> {
        if (!this.isSetup) {
            await this.setup()
        }

        return {
            ...baseSettings,
            outputStyle: this.tempStyleName
        }
    }

    /**
     * Get the temporary style name (must call setup() first)
     */
    getStyleName(): string {
        if (!this.isSetup) {
            throw new Error("Must call setup() before getting style name")
        }
        return this.tempStyleName
    }

    /**
     * Static utility method for using an isolated style with automatic cleanup
     * @param promptPath - Path to the source prompt file
     * @param callback - Function to execute with the style manager
     * @returns Result from the callback
     */
    static async withStyle<T>(
        promptPath: string,
        callback: (manager: OutputStyleManager) => Promise<T>
    ): Promise<T> {
        const manager = new OutputStyleManager(promptPath)
        try {
            return await callback(manager)
        } finally {
            await manager.cleanup()
        }
    }

    /**
     * Static utility to create settings with an isolated style
     * @param promptPath - Path to the source prompt file
     * @param baseSettings - Base settings to merge
     * @returns Settings object with outputStyle set
     */
    static async createSettings(
        promptPath: string,
        baseSettings: Record<string, any> = {}
    ): Promise<{ settings: OutputStyleSettings; cleanup: () => Promise<void> }> {
        const manager = new OutputStyleManager(promptPath)
        const settings = await manager.generateSettings(baseSettings)

        return {
            settings,
            cleanup: () => manager.cleanup()
        }
    }
}

/**
 * Utility function to create a cleanup handler for process exit events
 * @param manager - The OutputStyleManager instance to clean up
 */
export function createCleanupHandler(manager: OutputStyleManager): () => Promise<void> {
    return async () => {
        try {
            await manager.cleanup()
        } catch (error) {
            // Silently fail cleanup to avoid exit issues
            console.error("Error during output style cleanup:", error)
        }
    }
}

/**
 * Register cleanup handlers for common exit scenarios
 * @param manager - The OutputStyleManager instance to clean up
 */
export function registerCleanupHandlers(manager: OutputStyleManager): void {
    const cleanup = createCleanupHandler(manager)

    process.on("SIGINT", cleanup)
    process.on("SIGTERM", cleanup)
    process.on("exit", cleanup)

    // Also cleanup on uncaught exceptions
    process.on("uncaughtException", async (error) => {
        console.error("Uncaught exception:", error)
        await cleanup()
        process.exit(1)
    })

    process.on("unhandledRejection", async (reason) => {
        console.error("Unhandled rejection:", reason)
        await cleanup()
        process.exit(1)
    })
}

/**
 * Compose multiple prompt files into a single combined prompt
 * @param promptPaths - Array of prompt file paths to combine
 * @param separator - Separator to use between prompts (default: double newline)
 * @returns Combined prompt content
 */
export async function combinePrompts(
    promptPaths: string[],
    separator: string = "\n\n"
): Promise<string> {
    const prompts: string[] = []

    for (const path of promptPaths) {
        const file = Bun.file(path)
        const content = await file.text()
        prompts.push(content.trim())
    }

    return prompts.join(separator)
}

/**
 * Create a temporary prompt file from composed content
 * @param content - The prompt content to write
 * @param tempDir - Directory to create temp file in (defaults to system temp)
 * @returns Path to the temporary prompt file
 */
export async function createTempPromptFile(
    content: string,
    tempDir?: string
): Promise<string> {
    const dir = tempDir || process.env.TMPDIR || "/tmp"
    const tempFileName = `temp-prompt-${Date.now()}-${Math.random().toString(36).slice(2)}.md`
    const tempPath = join(dir, tempFileName)

    await writeFile(tempPath, content, "utf8")
    return tempPath
}