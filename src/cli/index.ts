import { basename } from 'node:path'

async function downloadFile(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
  }

  const totalBytes = Number.parseInt(response.headers.get('content-length') || '0')
  const filename = basename(new URL(url).pathname) || 'download'
  
  console.log(`Downloading ${filename} (${(totalBytes / 1024 / 1024).toFixed(2)} MB)...`)

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Failed to get response body reader')
  }

  const writer = Bun.file(filename).writer()
  let downloadedBytes = 0
  let lastReportedProgress = -1

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    writer.write(value)
    downloadedBytes += value.length

    if (totalBytes > 0) {
      const progress = Math.floor((downloadedBytes / totalBytes) * 100)
      if (progress !== lastReportedProgress) {
        process.stdout.write(`\rProgress: ${progress}% (${(downloadedBytes / 1024 / 1024).toFixed(2)} MB)`)
        lastReportedProgress = progress
      }
    } else {
      process.stdout.write(`\rDownloaded: ${(downloadedBytes / 1024 / 1024).toFixed(2)} MB`)
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
