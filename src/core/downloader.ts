import type { DownloadTask } from '@/types'
import { repository } from './db'

export class Downloader {
  private task: DownloadTask
  private abortController: AbortController

  constructor(task: DownloadTask) {
    this.task = task
    this.abortController = new AbortController()
  }

  async start(): Promise<void> {
    try {
      repository.updateStatus(this.task.id, 'downloading')

      const response = await fetch(this.task.url, {
        headers: { 'Accept-Encoding': 'identity' },
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Failed to get response body reader')
      }

      const file = Bun.file(this.task.filename)
      const writer = file.writer()
      let downloaded = 0
      let lastDbUpdate = 0

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        writer.write(value)
        downloaded += value.length

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
        repository.updateStatus(this.task.id, 'pending')
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
