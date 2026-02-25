import { repository } from '../core/db'

async function processQueue() {
  while (true) {
    const task = repository.getPendingTask()

    if (!task) {
      await Bun.sleep(5000)
      continue
    }

    try {
      repository.updateStatus(task.id, 'downloading')
      console.log(`Starting download: ${task.filename}`)

      const response = await fetch(task.url, {
        headers: { 'Accept-Encoding': 'identity' }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No body')
      }

      const writer = Bun.file(task.filename).writer()
      let downloaded = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        writer.write(value)
        downloaded += value.length
        
        // Update DB periodically (throttled by 1MB increments for simplicity)
        if (downloaded % (1024 * 1024) === 0) {
           repository.updateProgress(task.id, downloaded)
        }
      }

      await writer.flush()
      writer.end()
      repository.markCompleted(task.id, downloaded)
      console.log(`Finished download: ${task.filename}`)

    } catch (error: any) {
      console.error(`Failed to download ${task.filename}:`, error.message)
      repository.updateStatus(task.id, 'failed')
    }
  }
}

processQueue()

Bun.serve({
  port: 8000,
  async fetch(req) {
    const url = new URL(req.url)

    if (req.method === 'POST' && url.pathname === '/add') {
      const body = await req.json()
      const task = repository.addDownload({
        url: body.url,
        filename: body.filename,
        size: body.size
      })

      return Response.json({ 
        success: true, 
        id: task.id,
        message: `Added ${task.filename} to queue`
      })
    }

    if (url.pathname === '/status') {
      const tasks = repository.getAllDownloads()
      return Response.json(tasks)
    }

    return new Response("pxdl daemon is running", { status: 200 })
  }
})

console.log('🚀 pxdl daemon running on port 8000')
