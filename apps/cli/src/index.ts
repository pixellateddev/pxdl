import { startDashboard } from './dashboard'
import {
  isDaemonRunning,
  startDaemonBackground,
  stopDaemon,
  ensureDaemonRunning,
} from './daemon'
import {
  addToQueue,
  listTasks,
  pauseTask,
  resumeTask,
  removeTask,
} from './client'

const showHelp = () => {
  console.log('Usage:')
  console.log('  pxdl                 - Open interactive dashboard (default)')
  console.log('  pxdl add <url>       - Add a new download')
  console.log('  pxdl list            - List all downloads')
  console.log('  pxdl pause <id|all>  - Pause download(s)')
  console.log('  pxdl resume <id|all> - Resume download(s)')
  console.log('  pxdl remove <id> [--clean] - Remove download (and optionally delete file)')
  console.log('  pxdl start           - Start daemon in background')
  console.log('  pxdl stop            - Stop background daemon')
  console.log('  pxdl status          - Check daemon status')
  console.log('  pxdl help            - Show this help')
}

const showStatus = async () => {
  if (await isDaemonRunning()) {
    console.log('🟢 pxdl daemon is ONLINE')
  } else {
    console.log('🔴 pxdl daemon is OFFLINE')
  }
}

const main = async () => {
  const args = Bun.argv.slice(2)
  const command = args[0]

  if (!command) {
    await ensureDaemonRunning()
    startDashboard()
    return
  }

  switch (command) {
    case 'add':
      if (!args[1]) {
        console.error('Usage: pxdl add <url>')
        process.exit(1)
      }
      await addToQueue(args[1])
      break
    case 'list':
      await listTasks()
      break
    case 'dash':
      await ensureDaemonRunning()
      startDashboard()
      break
    case 'pause':
      if (!args[1]) {
        console.error('Usage: pxdl pause <id|all>')
        process.exit(1)
      }
      await pauseTask(args[1])
      break
    case 'resume':
      if (!args[1]) {
        console.error('Usage: pxdl resume <id|all>')
        process.exit(1)
      }
      await resumeTask(args[1])
      break
    case 'remove':
      if (!args[1]) {
        console.error('Usage: pxdl remove <id> [--clean]')
        process.exit(1)
      }
      await removeTask(args[1], args.includes('--clean'))
      break
    case 'start':
      if (await isDaemonRunning()) {
        console.log('Daemon is already running.')
      } else {
        const success = await startDaemonBackground()
        if (success) {
          console.log('🚀 Daemon started in background.')
        } else {
          console.error('❌ Failed to start daemon.')
          process.exit(1)
        }
      }
      break
    case 'stop':
      await stopDaemon()
      break
    case 'status':
      await showStatus()
      break
    case 'help':
    case '--help':
    case '-h':
      showHelp()
      break
    default:
      // Check if it's a URL
      if (command.startsWith('http://') || command.startsWith('https://')) {
        await addToQueue(command)
      } else {
        console.error(`Unknown command: ${command}`)
        showHelp()
        process.exit(1)
      }
  }
}

main()
