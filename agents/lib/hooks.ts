/**
 * Utility functions for managing Claude hooks
 */

/**
 * Helper function to get user permission
 */
function askPermission(message: string): boolean {
    const response = prompt(`${message} (y/n): `)
    return response?.toLowerCase() === 'y'
}

/**
 * Setup Claude hooks by merging provided hooks into settings
 */
export async function setupHooks(hooks: Record<string, any>) {
    const settingsPath = ".claude/settings.local.json"
    const exists = await Bun.file(settingsPath).exists()

    if (!exists) {
        if (askPermission('Allow me to create the settings file to enable hooks?')) {
            await Bun.write(settingsPath, JSON.stringify({ hooks }, null, 2))
        } else {
            console.warn('Skipped hook update. Behavior may suffer.')
        }
        return
    }

    const settingsJSON = await Bun.file(settingsPath).json()
    if (!settingsJSON?.hooks?.["UserPromptSubmit"]) {
        const before = JSON.stringify(settingsJSON.hooks || {})
        const after = JSON.stringify(hooks)
        const message = `Allow me to update the settings file to enable hooks?\n Settings before: ${before}\n Settings after: ${after}`

        if (askPermission(message)) {
            settingsJSON.hooks = { ...settingsJSON.hooks, ...hooks }
            await Bun.write(settingsPath, JSON.stringify(settingsJSON, null, 2))
        } else {
            console.warn('Skipped hook update. Behavior may suffer.')
        }
    }
} 