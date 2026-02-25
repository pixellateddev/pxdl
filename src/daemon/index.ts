import { repository } from '@/core/db'
import type { NewDownload } from '@/types'
import { startScheduler } from './scheduler'

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
      return Response.json(tasks)
    }

    return new Response('pxdl daemon is running', { status: 200 })
  },
})

console.log('🚀 pxdl daemon running on port 8000')
