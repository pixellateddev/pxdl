import { repository } from '@/core/db'
import type { NewDownload } from '@/types'
import { startScheduler, activeDownloaders } from './scheduler'
import { join } from 'node:path'
import { homedir } from 'node:os'

// Start background scheduler
startScheduler()

const DEFAULT_DOWNLOAD_DIR = join(homedir(), 'Downloads')

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
        isResumable: body.isResumable,
        directory: body.directory || DEFAULT_DOWNLOAD_DIR
      })

      return Response.json({
        success: true,
        id: task.id,
        message: `Added ${task.filename} to queue`
      })
    }

    if (url.pathname === '/status') {
      const tasks = repository.getAllDownloads()
      
      const tasksWithStats = tasks.map(task => {
        const rawSegments = repository.getSegments(task.id)
        const downloader = activeDownloaders.get(task.id)
        
        let downloadedBytes = task.downloadedBytes
        let speed = 0
        let eta = 0

        if (downloader && downloader.startTime > 0) {
          const now = Date.now()
          const elapsed = (now - downloader.startTime) / 1000
          downloadedBytes = downloader.downloadedBytes
          speed = downloader.sessionDownloadedBytes / elapsed
          const remaining = task.size - downloadedBytes
          eta = speed > 0 ? Math.floor(remaining / speed) : 0
        }

        const segments = rawSegments.map(s => {
          if (downloader) {
            const stats = downloader.segmentStats.get(s.id)
            if (stats && downloader.startTime > 0) {
              const elapsed = (Date.now() - downloader.startTime) / 1000
              const segmentSpeed = stats.sessionDownloaded / elapsed
              return { 
                ...s, 
                downloadedBytes: stats.downloaded,
                speed: segmentSpeed > 0 ? segmentSpeed : 0
              }
            }
          }
          return s
        })
          
        return {
          ...task,
          downloadedBytes,
          speed,
          eta,
          segments
        }
      })

      return Response.json(tasksWithStats)
    }

    if (req.method === 'POST' && url.pathname === '/pause') {
      const body = (await req.json()) as { id: number }
      const id = body.id
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
      const body = (await req.json()) as { id: number }
      const id = body.id
      console.log(`[API] Resuming task ${id}`)
      repository.updateStatus(id, 'pending')
      return Response.json({ success: true })
    }

    if (req.method === 'POST' && url.pathname === '/delete') {
      const body = (await req.json()) as { id: number; deleteFile?: boolean }
      const { id, deleteFile } = body
      console.log(`[API] Deleting task ${id} (Delete File: ${deleteFile})`)
      
      const task = repository.getDownloadById(id)
      if (task) {
        const downloader = activeDownloaders.get(id)
        if (downloader) {
          downloader.stop()
          activeDownloaders.delete(id)
        }

        const fullPath = join(task.directory, task.filename)
        const tempPath = join(task.directory, `.${task.filename}.pxdl`)

        if (deleteFile || task.status !== 'completed') {
          // Remove final file if it exists
          const file = Bun.file(fullPath)
          if (await file.exists()) {
            console.log(`[API] Removing file: ${fullPath}`)
            await file.delete()
          }
          // Remove hidden temp file if it exists
          const tempFile = Bun.file(tempPath)
          if (await tempFile.exists()) {
            console.log(`[API] Removing temp file: ${tempPath}`)
            await tempFile.delete()
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
