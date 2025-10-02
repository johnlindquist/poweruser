/**
 * State Manager for Agent State Files
 * 
 * Centralized management of state files in agents/tmp directory
 * Ensures consistent state file handling across all agents
 */

import { readFile, writeFile, mkdir, unlink } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, dirname } from "node:path"

export interface StateManagerOptions {
    /**
     * The base name for the state file (e.g., "design-system-state", "extraction-state")
     */
    stateName: string
    
    /**
     * Optional subdirectory within agents/tmp (e.g., "storybook", "extraction")
     */
    subDir?: string
    
    /**
     * Whether to create the directory if it doesn't exist
     */
    createDir?: boolean
}

/**
 * Generic state type - agents can extend this
 */
export interface BaseState {
    version: string
    timestamp: string
    [key: string]: any
}

/**
 * Manages state persistence for agents in the tmp directory
 */
export class StateManager<T extends BaseState = BaseState> {
    private stateFilePath: string
    
    constructor(options: StateManagerOptions) {
        // Build the state file path
        const baseDir = join(process.cwd(), "agents", "tmp")
        const fullDir = options.subDir ? join(baseDir, options.subDir) : baseDir
        this.stateFilePath = join(fullDir, `${options.stateName}.json`)
        
        console.log(`[StateManager] Initialized for ${this.stateFilePath}`)
        
        // Create directory if requested
        if (options.createDir !== false) {
            this.ensureDirectory()
        }
    }
    
    /**
     * Ensure the directory exists
     */
    private async ensureDirectory(): Promise<void> {
        const dir = dirname(this.stateFilePath)
        if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true })
            console.log(`[StateManager] Created directory: ${dir}`)
        }
    }
    
    /**
     * Read the current state from file
     * @returns The state object or null if file doesn't exist
     */
    async read(): Promise<T | null> {
        try {
            if (!existsSync(this.stateFilePath)) {
                console.log(`[StateManager] State file not found: ${this.stateFilePath}`)
                return null
            }
            
            const content = await readFile(this.stateFilePath, "utf8")
            const state = JSON.parse(content) as T
            console.log(`[StateManager] Read state from ${this.stateFilePath}`)
            return state
        } catch (error) {
            console.error(`[StateManager] Error reading state:`, error)
            return null
        }
    }
    
    /**
     * Write state to file
     * @param state - The state object to persist
     */
    async write(state: T): Promise<void> {
        try {
            await this.ensureDirectory()
            
            // Add timestamp if not present
            if (!state.timestamp) {
                state.timestamp = new Date().toISOString()
            }
            
            const content = JSON.stringify(state, null, 2)
            await writeFile(this.stateFilePath, content, "utf8")
            console.log(`[StateManager] Wrote state to ${this.stateFilePath}`)
        } catch (error) {
            console.error(`[StateManager] Error writing state:`, error)
            throw error
        }
    }
    
    /**
     * Update the state with a partial update
     * @param update - Partial state to merge with existing state
     */
    async update(update: Partial<T>): Promise<T> {
        const currentState = await this.read()
        const newState = {
            ...(currentState || {} as T),
            ...update,
            timestamp: new Date().toISOString()
        } as T
        
        await this.write(newState)
        return newState
    }
    
    /**
     * Delete the state file
     */
    async delete(): Promise<void> {
        try {
            if (existsSync(this.stateFilePath)) {
                await unlink(this.stateFilePath)
                console.log(`[StateManager] Deleted state file: ${this.stateFilePath}`)
            }
        } catch (error) {
            console.error(`[StateManager] Error deleting state:`, error)
        }
    }
    
    /**
     * Check if state file exists
     */
    exists(): boolean {
        return existsSync(this.stateFilePath)
    }
    
    /**
     * Get the full path to the state file
     */
    getPath(): string {
        return this.stateFilePath
    }
    
    /**
     * Initialize state with default values if it doesn't exist
     * @param defaultState - Default state to use if file doesn't exist
     */
    async initialize(defaultState: T): Promise<T> {
        const existing = await this.read()
        if (existing) {
            console.log(`[StateManager] State already exists, returning existing state`)
            return existing
        }
        
        await this.write(defaultState)
        console.log(`[StateManager] Initialized new state with defaults`)
        return defaultState
    }
}

/**
 * Design System State - specific state for storybook-designer
 */
export interface DesignSystemState extends BaseState {
    currentPhase: string
    selections: Record<string, any>
    history: Array<{
        phase: string
        component: string
        action: string
        option: string
        timestamp: string
        userFeedback?: string
    }>
}

/**
 * Extraction State - specific state for storybook-extractor
 */
export interface ExtractionState extends BaseState {
    projectName: string
    scanDate: string
    phases: {
        discovery: "pending" | "in-progress" | "complete"
        tokenExtraction: "pending" | "in-progress" | "complete"
        componentCataloging: "pending" | "in-progress" | "complete"
        storyGeneration: "pending" | "in-progress" | "complete"
    }
    findings: {
        colors?: { unique: number; consolidated: number }
        typography?: { fontFamilies: number; sizes: number }
        components?: { total: number; documented: number }
    }
    output: {
        auditReport?: string
        tokens?: string
        stories?: string
    }
}

/**
 * Factory function to create a DesignSystemState manager
 */
export function createDesignSystemStateManager(): StateManager<DesignSystemState> {
    return new StateManager<DesignSystemState>({
        stateName: "design-system-state",
        subDir: "storybook",
        createDir: true
    })
}

/**
 * Factory function to create an ExtractionState manager
 */
export function createExtractionStateManager(): StateManager<ExtractionState> {
    return new StateManager<ExtractionState>({
        stateName: "extraction-state",
        subDir: "extraction",
        createDir: true
    })
}

/**
 * Utility to clean up all state files in tmp directory
 */
export async function cleanupAllStates(): Promise<void> {
    const tmpDir = join(process.cwd(), "agents", "tmp")
    console.log(`[StateManager] Cleaning up all states in ${tmpDir}`)
    
    // This would typically be more sophisticated, 
    // but for now we'll just log the action
    // Actual cleanup would require listing and removing files
}

export default StateManager
