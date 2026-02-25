import { formatBytes, formatDuration } from '../core/utils'
import { probeUrl } from '../core/probe'

async function downloadFile(url: string) {
  const probe = await probeUrl(url)
  
  const response = await fetch(url, {
    headers: {
      'Accept-Encoding': 'identity',
    },
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
  }

  const totalBytes = probe.size
  const filename = probe.filename

  console.log(`Downloading ${filename} (${formatBytes(totalBytes)})...`)
  console.log(`Resumable: ${probe.isResumable ? 'Yes' : 'No'}`)

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Failed to get response body reader')
  }

  const writer = Bun.file(filename).writer()
  let downloadedBytes = 0
  let lastReportedProgress = -1
  const startTime = Date.now()

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    writer.write(value)
    downloadedBytes += value.length

    const now = Date.now()
    const elapsedSeconds = (now - startTime) / 1000
    const speed = downloadedBytes / elapsedSeconds
    const remainingBytes = totalBytes - downloadedBytes
    const eta = remainingBytes / speed

    if (totalBytes > 0) {
      const progress = Math.min(100, Math.floor((downloadedBytes / totalBytes) * 100))
      if (progress !== lastReportedProgress || elapsedSeconds % 1 < 0.1) {
        process.stdout.write(
          `\rProgress: ${progress}% | ${formatBytes(downloadedBytes)}/${formatBytes(totalBytes)} | ${formatBytes(speed)}/s | ETA: ${formatDuration(eta)}`
        )
        lastReportedProgress = progress
      }
    } else {
      process.stdout.write(`\rDownloaded: ${formatBytes(downloadedBytes)} | ${formatBytes(speed)}/s`)
    }
  }

  writer.end()
  console.log('\nDownload completed!')
}

const url = Bun.argv[2]
if (!url) {
  console.error('Usage: bun src/cli/index.ts <url>')
  process.exit(1)
}

downloadFile(url).catch((err) => {
  console.error(`\nError: ${err.message}`)
  process.exit(1)
})
