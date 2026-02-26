import { probeUrl } from '@/core/probe'
import { formatBytes } from '@/core/utils'
import { startDashboard } from './dashboard'
import type { NewDownload } from '@/types'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync, writeFileSync } from 'node:fs'

const CONFIG_DIR = join(homedir(), '.pxdl')
const PID_FILE = join(CONFIG_DIR, 'daemon.pid')
const LOG_FILE = join(CONFIG_DIR, 'daemon.log')

async function addToQueue(url: string) {
  try {
    console.log('Probing URL...')
    const probe = await probeUrl(url)

    console.log(`File: ${probe.filename}`)
    console.log(`Size: ${formatBytes(probe.size)}`)

    const response = await fetch('http://localhost:8000/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: probe.url,
        filename: probe.filename,
        size: probe.size,
        isResumable: probe.isResumable,
      } as NewDownload),
    })

    if (!response.ok) {
      throw new Error('Could not connect to daemon. Is it running?')
    }

    const result = (await response.json()) as { success: boolean; message: string }
    console.log(`✅ ${result.message}`)
  } catch (error: any) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }
}

async function handleDaemonCommand(action: string) {
  if (action === 'start') {
    if (existsSync(PID_FILE)) {
      console.log('Daemon might already be running. Use "pxdl daemon stop" first if it is stuck.')
    }

    console.log('Starting pxdl daemon in background...')
    const proc = Bun.spawn(['bun', 'src/daemon/index.ts'], {
      stdout: Bun.file(LOG_FILE),
      stderr: Bun.file(LOG_FILE),
      detached: true,
    })

    writeFileSync(PID_FILE, proc.pid.toString())
    console.log(`🚀 Daemon started (PID: ${proc.pid})`)
    console.log(`Logs: ${LOG_FILE}`)
    proc.unref() // Allow CLI to exit while daemon keeps running
    process.exit(0)
  }

  if (action === 'stop') {
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
    const { unlinkSync } = await import('node:fs')
    try { unlinkSync(PID_FILE) } catch {}
    process.exit(0)
  }

  if (action === 'status') {
    try {
      const res = await fetch('http://localhost:8000')
      if (res.ok) {
        console.log('🟢 pxdl daemon is ONLINE')
      } else {
        console.log('🔴 pxdl daemon is unresponsive')
      }
    } catch {
      console.log('🔴 pxdl daemon is OFFLINE')
    }
    process.exit(0)
  }
}

const args = Bun.argv.slice(2)
const command = args[0]

if (!command) {
  console.log('Usage:')
  console.log('  pxdl <url>           - Add download to queue')
  console.log('  pxdl dash            - Show download dashboard')
  console.log('  pxdl daemon start    - Start background daemon')
  console.log('  pxdl daemon stop     - Stop background daemon')
  console.log('  pxdl daemon status   - Check daemon status')
  process.exit(1)
}

if (command === 'daemon') {
  handleDaemonCommand(args[1] || 'status')
} else if (command === 'dash' || command === 'list') {
  startDashboard()
} else {
  // Assume it's a URL
  addToQueue(command)
}
