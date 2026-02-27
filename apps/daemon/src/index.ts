import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, parse } from 'node:path'
import { probeUrl, repository } from '@pxdl/core'
import type { NewDownload } from '@pxdl/types'
import { activeDownloaders, startScheduler, triggerScheduler } from './scheduler'
import { DAEMON_PORT } from '@pxdl/core'

startScheduler()

const DEFAULT_DOWNLOAD_DIR = join(homedir(), 'Downloads')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const getUniqueFilename = (directory: string, filename: string): string => {
  let finalName = filename
  let counter = 1
  const p = parse(filename)
  while (
    existsSync(join(directory, finalName)) ||
    existsSync(join(directory, `.${finalName}.pxdl`)) ||
    repository.getByFilename(finalName)
  ) {
    finalName = `${p.name} (${counter})${p.ext}`
    counter++
  }
  return finalName
}

const getTasksWithStats = () => {
  const tasks = repository.getAllDownloads()
  return tasks.map((task) => {
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
          return { ...s, downloadedBytes: stats.downloaded, speed: segmentSpeed > 0 ? segmentSpeed : 0 }
        }
      }
      return s
    })

    return { ...task, downloadedBytes, speed, eta, segments }
  })
}

Bun.serve({
  port: DAEMON_PORT,
  async fetch(req) {
    const url = new URL(req.url)

    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

    // --- SSE ENDPOINT ---
    if (url.pathname === '/events') {
      const signal = req.signal
      let timer: Timer

      return new Response(
        new ReadableStream({
          start(controller) {
            timer = setInterval(() => {
              if (signal.aborted) {
                clearInterval(timer)
                try {
                  controller.close()
                } catch (e) {
                  // Already closed
                }
                return
              }
              const stats = getTasksWithStats()
              controller.enqueue(`data: ${JSON.stringify(stats)}\n\n`)
            }, 1000)
          },
          cancel() {
            if (timer) clearInterval(timer)
          },
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        }
      )
    }

    let response: Response

    if (url.pathname === '/probe') {
      const targetUrl = url.searchParams.get('url')
      if (!targetUrl) {
        response = Response.json({ error: 'Missing URL parameter' }, { status: 400 })
      } else {
        try {
          const result = await probeUrl(targetUrl)
          response = Response.json(result)
        } catch (err: any) {
          response = Response.json({ error: err.message }, { status: 500 })
        }
      }
    } else if (req.method === 'POST' && url.pathname === '/add') {
      const body = (await req.json()) as NewDownload & { force?: boolean }
      const directory = body.directory || DEFAULT_DOWNLOAD_DIR
      const existing = !body.force ? repository.getByUrl(body.url) : null

      if (existing) {
        response = Response.json({ success: false, error: 'ALREADY_EXISTS', message: `Already in queue: ${existing.filename}` }, { status: 409 })
      } else {
        const filename = getUniqueFilename(directory, body.filename)
        const task = repository.addDownload({ url: body.url, filename, directory, size: body.size, isResumable: body.isResumable })
        triggerScheduler()
        response = Response.json({ success: true, id: task.id, message: `Added ${filename}` })
      }
    } else if (url.pathname === '/status') {
      response = Response.json(getTasksWithStats())
    } else if (req.method === 'POST' && url.pathname === '/pause') {
      const { id } = (await req.json()) as { id: number }
      const downloader = activeDownloaders.get(id)
      if (downloader) { downloader.stop(); activeDownloaders.delete(id) }
      repository.updateStatus(id, 'paused')
      response = Response.json({ success: true })
    } else if (req.method === 'POST' && url.pathname === '/resume') {
      const { id } = (await req.json()) as { id: number }
      repository.updateStatus(id, 'pending')
      triggerScheduler()
      response = Response.json({ success: true })
    } else if (req.method === 'POST' && url.pathname === '/delete') {
      const { id, deleteFile } = (await req.json()) as { id: number; deleteFile?: boolean }
      const task = repository.getDownloadById(id)
      if (task) {
        const downloader = activeDownloaders.get(id)
        if (downloader) { downloader.stop(); activeDownloaders.delete(id) }
        if (deleteFile || task.status !== 'completed') {
          await Bun.file(join(task.directory, task.filename)).delete().catch(() => {})
          await Bun.file(join(task.directory, `.${task.filename}.pxdl`)).delete().catch(() => {})
        }
        repository.deleteDownload(id)
      }
      response = Response.json({ success: true })
    } else {
      response = new Response('pxdl daemon is running', { status: 200 })
    }

    for (const [key, value] of Object.entries(corsHeaders)) response.headers.set(key, value)
    return response
  },
})

console.log(`🚀 pxdl daemon running on http://localhost:${DAEMON_PORT}`)
