import { $ } from 'bun'

export async function notify(title: string, message: string) {
  if (process.platform === 'darwin') {
    try {
      // Escape double quotes for AppleScript
      const escapedMsg = message.replace(/"/g, '\\"')
      const escapedTitle = title.replace(/"/g, '\\"')
      
      // Native macOS notification via AppleScript with sound
      await $`osascript -e 'display notification "${escapedMsg}" with title "${escapedTitle}" sound name "Glass"'`.quiet()
    } catch (err) {
      console.error('Failed to send notification:', err)
    }
  }
}
