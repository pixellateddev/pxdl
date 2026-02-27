import { existsSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { API_BASE, PID_FILE, LOG_FILE } from '@pxdl/core'

export const isDaemonRunning = async () => {
  try {
    const res = await fetch(API_BASE, { signal: AbortSignal.timeout(500) })
    return res.status === 200
  } catch {
    return false
  }
}

export const startDaemonBackground = async () => {
  if (await isDaemonRunning()) {
    return true
  }

  // Determine command to run the daemon
  const globalDaemon = '/usr/local/bin/pxdl-daemon'
  const localDaemon = join(import.meta.dir, 'pxdl-daemon')
  
  // Detect if we are running from source (development)
  const isDev = import.meta.filename.endsWith('.ts') || import.meta.filename.endsWith('.tsx')

  let command: string[]
  
  if (isDev) {
    // In development, always prefer running via bun from source
    command = ['bun', 'src/daemon/index.ts']
  } else if (existsSync(localDaemon)) {
    command = [localDaemon]
  } else if (existsSync(globalDaemon)) {
    command = [globalDaemon]
  } else {
    // Last resort fallback
    command = ['bun', 'src/daemon/index.ts']
  }

  const proc = Bun.spawn(command, {
    stdout: Bun.file(LOG_FILE),
    stderr: Bun.file(LOG_FILE),
    detached: true,
  })

  writeFileSync(PID_FILE, proc.pid.toString())
  proc.unref()

  // Wait for daemon to become responsive
  for (let i = 0; i < 10; i++) {
    if (await isDaemonRunning()) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return false
}

export const ensureDaemonRunning = async () => {
  if (!(await isDaemonRunning())) {
    process.stdout.write('Daemon offline, starting... ')
    const success = await startDaemonBackground()
    if (success) {
      process.stdout.write('🚀\n')
    } else {
      process.stdout.write('❌\n')
      console.error('Error: Could not start daemon.')
      process.exit(1)
    }
  }
}

export const stopDaemon = async () => {
  if (!existsSync(PID_FILE)) {
    console.log('No PID file found. Daemon might not be running.')
    return
  }

  const pidText = await Bun.file(PID_FILE).text()
  const pid = Number.parseInt(pidText.trim())
  try {
    process.kill(pid, 'SIGTERM')
    console.log(`🛑 Daemon (PID: ${pid}) stopped.`)
  } catch (e) {
    console.log('Could not kill process. It might have already stopped.')
  }
  try {
    unlinkSync(PID_FILE)
  } catch {}
}
