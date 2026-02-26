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

    if (req.method === 'POST' && url.pathname === '/pause') {
      const { id } = await req.json()
      console.log(`[API] Pausing task ${id}`)
      const downloader = activeDownloaders.get(id)
      if (downloader) {
        downloader.stop()
        activeDownloaders.delete(id)
      }
      repository.updateStatus(id, 'paused')
      return Response.json({ success: true })
    }

    if (req.method === 'POST' && url.pathname === '/resume') {
      const { id } = await req.json()
      console.log(`[API] Resuming task ${id}`)
      repository.updateStatus(id, 'pending')
      return Response.json({ success: true })
    }

    if (req.method === 'POST' && url.pathname === '/delete') {
      const { id } = await req.json()
      console.log(`[API] Deleting task ${id}`)
      
      const task = repository.getDownloadById(id)
      if (task) {
        const downloader = activeDownloaders.get(id)
        if (downloader) {
          downloader.stop()
          activeDownloaders.delete(id)
        }

        if (task.status !== 'completed') {
          const file = Bun.file(task.filename)
          if (await file.exists()) {
            console.log(`[API] Removing partial file: ${task.filename}`)
            await file.delete()
          }
        }
        
        repository.deleteDownload(id)
      }
      
      return Response.json({ success: true })
    }

    return new Response('pxdl daemon is running', { status: 200 })
  },
})

console.log('🚀 pxdl daemon running on http://localhost:8000')
