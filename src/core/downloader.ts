import type { DownloadTask } from '@/types'
import { repository } from './db'

export class Downloader {
  private task: DownloadTask
  private abortController: AbortController
  public downloadedBytes = 0
  public startTime = 0

  constructor(task: DownloadTask) {
    this.task = task
    this.abortController = new AbortController()
    this.downloadedBytes = task.downloadedBytes
  }

  async start(): Promise<void> {
    try {
      this.startTime = Date.now()
      repository.updateStatus(this.task.id, 'downloading')

      const file = Bun.file(this.task.filename)
      const exists = await file.exists()
      let startByte = 0

      if (exists) {
        startByte = file.size
        // If file is already fully downloaded based on the probe size, mark as completed
        if (this.task.size > 0 && startByte >= this.task.size) {
          repository.markCompleted(this.task.id, startByte)
          return
        }
      }

      const headers: Record<string, string> = {
        'Accept-Encoding': 'identity',
      }

      if (startByte > 0) {
        headers['Range'] = `bytes=${startByte}-`
      }

      const response = await fetch(this.task.url, {
        headers,
        signal: this.abortController.signal,
      })

      if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const isPartial = response.status === 206
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Failed to get response body reader')
      }

      // If we requested a range but got a 200, the server doesn't support resume
      // We have to restart from 0
      const actualStart = isPartial ? startByte : 0
      const writer = file.writer({ append: isPartial })
      
      let downloaded = actualStart
      let lastDbUpdate = actualStart
      this.downloadedBytes = actualStart

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        writer.write(value)
        downloaded += value.length
        this.downloadedBytes = downloaded

        // Update database every 1MB to avoid excessive I/O
        if (downloaded - lastDbUpdate > 1024 * 1024) {
          repository.updateProgress(this.task.id, downloaded)
          lastDbUpdate = downloaded
        }
      }

      await writer.flush()
      writer.end()

      repository.markCompleted(this.task.id, downloaded)
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Task remains in its current downloaded state in DB
        repository.updateStatus(this.task.id, 'paused')
        return
      }

      console.error(`Download failed for ${this.task.filename}:`, error.message)
      repository.updateStatus(this.task.id, 'failed')
      throw error
    }
  }

  stop(): void {
    this.abortController.abort()
  }
}
