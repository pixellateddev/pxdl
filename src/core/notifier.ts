import { $ } from 'bun'

export async function notify(title: string, message: string) {
  if (process.platform === 'darwin') {
    try {
      const escapedMsg = message.replace(/"/g, '\\"')
      const escapedTitle = title.replace(/"/g, '\\"')
      
      // Standard macOS notification (Confirmed working when Focus mode is off)
      await $`osascript -e 'display notification "${escapedMsg}" with title "${escapedTitle}" sound name "Glass"'`.quiet()
    } catch (err) {
      // Ignore
    }
  }
}
