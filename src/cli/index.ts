import { probeUrl } from '@/core/probe'
import { formatBytes } from '@/core/utils'
import { startDashboard } from './dashboard'
import type { NewDownload } from '@/types'

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

const command = Bun.argv[2]

if (!command) {
  console.log('Usage:')
  console.log('  bun src/cli/index.ts <url>   - Add download to queue')
  console.log('  bun src/cli/index.ts dash    - Show download dashboard')
  process.exit(1)
}

if (command === 'dash' || command === 'list') {
  startDashboard()
} else {
  // Assume it's a URL
  addToQueue(command)
}
