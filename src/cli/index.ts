import { probeUrl } from '@/core/probe'
import { formatBytes } from '@/core/utils'

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
        size: probe.size
      })
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

const url = Bun.argv[2]
if (!url) {
  console.log('Usage: bun src/cli/index.ts <url>')
  process.exit(1)
}

addToQueue(url)
