import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, parse } from 'node:path'
import { repository } from '@pxdl/core'
import type { NewDownload } from '@pxdl/types'
import { activeDownloaders, startScheduler, triggerScheduler } from './scheduler'

import { DAEMON_PORT } from '@pxdl/core'

// Start background scheduler
startScheduler()

const DEFAULT_DOWNLOAD_DIR = join(homedir(), 'Downloads')

/**
 * Ensures a filename is unique by checking both the disk and the task database.
 * Appends (1), (2), etc. if collisions are found.
 */
const getUniqueFilename = (directory: string, filename: string): string => {
  let finalName = filename
  let counter = 1

  const p = parse(filename)
  const base = p.name
  const ext = p.ext

  // Keep incrementing if:
  // 1. Final file exists on disk
  // 2. Hidden temp file exists on disk
  // 3. Filename is already registered in our DB
  while (
    existsSync(join(directory, finalName)) ||
    existsSync(join(directory, `.${finalName}.pxdl`)) ||
    repository.getByFilename(finalName)
  ) {
    finalName = `${base} (${counter})${ext}`
    counter++
  }

  return finalName
}

Bun.serve({
  port: DAEMON_PORT,
  async fetch(req) {
    const url = new URL(req.url)

    if (req.method === 'POST' && url.pathname === '/add') {
      const body = (await req.json()) as NewDownload & { force?: boolean }
      const directory = body.directory || DEFAULT_DOWNLOAD_DIR

      if (!body.force) {
        const existing = repository.getByUrl(body.url)
        if (existing) {
          return Response.json(
            {
              success: false,
              error: 'ALREADY_EXISTS',
              message: `URL already in queue: ${existing.filename}`,
            },
            { status: 409 }
          )
        }
      }

      // Automatically find a unique filename to avoid overwriting anything
      const filename = getUniqueFilename(directory, body.filename)

      const task = repository.addDownload({
        url: body.url,
        filename: filename,
        directory: directory,
        size: body.size,
        isResumable: body.isResumable,
      })

      triggerScheduler()

      return Response.json({
        success: true,
        id: task.id,
        message: `Added ${filename} to queue`,
      })
    }

    if (url.pathname === '/status') {
      const tasks = repository.getAllDownloads()

      const tasksWithStats = tasks.map((task) => {
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

        const segments = rawSegments.map((s) => {
          if (downloader) {
            const stats = downloader.segmentStats.get(s.id)
            if (stats && downloader.startTime > 0) {
              const elapsed = (Date.now() - downloader.startTime) / 1000
              const segmentSpeed = stats.sessionDownloaded / elapsed
              return {
                ...s,
                downloadedBytes: stats.downloaded,
                speed: segmentSpeed > 0 ? segmentSpeed : 0,
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
          segments,
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
      triggerScheduler()
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
          const file = Bun.file(fullPath)
          if (await file.exists()) {
            console.log(`[API] Removing file: ${fullPath}`)
            await file.delete()
          }
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

console.log(`🚀 pxdl daemon running on http://localhost:${DAEMON_PORT}`)
