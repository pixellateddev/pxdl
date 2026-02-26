import { repository } from '@/core/db'
import type { NewDownload } from '@/types'
import { startScheduler, activeDownloaders } from './scheduler'

// Start background scheduler
startScheduler()

Bun.serve({
  port: 8000,
  async fetch(req) {
    const url = new URL(req.url)

    if (req.method === 'POST' && url.pathname === '/add') {
      const body = (await req.json()) as NewDownload
      const task = repository.addDownload({
        url: body.url,
        filename: body.filename,
        size: body.size,
      })

      return Response.json({
        success: true,
        id: task.id,
        message: `Added ${task.filename} to queue`,
      })
    }

    if (url.pathname === '/status') {
      const tasks = repository.getAllDownloads()
      
      const tasksWithStats = tasks.map(task => {
        const downloader = activeDownloaders.get(task.id)
        if (downloader && downloader.startTime > 0) {
          const now = Date.now()
          const elapsed = (now - downloader.startTime) / 1000
          const downloaded = downloader.downloadedBytes
          const speed = downloaded / elapsed
          const remaining = task.size - downloaded
          const eta = speed > 0 ? Math.floor(remaining / speed) : 0
          
          return {
            ...task,
            downloadedBytes: downloaded, // Use real-time bytes instead of DB bytes
            speed,
            eta
          }
        }
        return task
      })

      return Response.json(tasksWithStats)
    }

    return new Response('pxdl daemon is running', { status: 200 })
  },
})

console.log('🚀 pxdl daemon running on port 8000')
