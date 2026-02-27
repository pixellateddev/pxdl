import { closeSync, existsSync, openSync, renameSync, truncateSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import type { DownloadTask, SegmentTask } from '@/types'
import { repository } from './db'
import { notify } from './notifier'

const SEGMENT_COUNT = 8
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export class Downloader {
  private task: DownloadTask
  private abortController: AbortController
  private filePath: string
  private tempPath: string
  public downloadedBytes = 0
  public sessionDownloadedBytes = 0
  public startTime = 0
  public segmentStats = new Map<number, { downloaded: number; sessionDownloaded: number }>()

  constructor(task: DownloadTask) {
    this.task = task
    this.abortController = new AbortController()
    this.downloadedBytes = task.downloadedBytes
    this.filePath = join(task.directory, task.filename)
    // Hidden temp file: .filename.pxdl
    this.tempPath = join(task.directory, `.${task.filename}.pxdl`)
  }

  async start(): Promise<void> {
    try {
      this.startTime = Date.now()
      repository.updateStatus(this.task.id, 'downloading')

      if (this.task.isResumable && this.task.size > 1024 * 1024) {
        await this.downloadMultiThreaded()
      } else {
        await this.downloadSingleThreaded()
      }

      // Rename from hidden .filename.pxdl to final filename upon completion
      if (existsSync(this.tempPath)) {
        renameSync(this.tempPath, this.filePath)
      }

      repository.markCompleted(this.task.id, this.task.size || this.downloadedBytes)

      // Success notification
      await notify('Download Complete', `${this.task.filename} finished successfully.`)
    } catch (error: any) {
      if (error.name === 'AbortError') {
        repository.updateStatus(this.task.id, 'paused')
        return
      }

      console.error(`Download failed for ${this.task.filename}:`, error.message)
      repository.updateStatus(this.task.id, 'failed')

      // Failure notification
      await notify('Download Failed', `${this.task.filename}: ${error.message}`)
      throw error
    }
  }

  private async downloadSingleThreaded(): Promise<void> {
    const startByte = existsSync(this.tempPath) ? Bun.file(this.tempPath).size : 0

    if (this.task.size > 0 && startByte >= this.task.size) {
      return
    }

    const response = await fetch(this.task.url, {
      headers: {
        'Accept-Encoding': 'identity',
        'User-Agent': USER_AGENT,
        ...(startByte > 0 ? { Range: `bytes=${startByte}-` } : {}),
      },
      signal: this.abortController.signal,
    })

    if (!response.ok && response.status !== 206 && response.status !== 200) {
      throw new Error(`HTTP ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No body')
    }

    const isPartial = response.status === 206
    const fd = openSync(this.tempPath, isPartial ? 'a' : 'w')

    let downloaded = isPartial ? startByte : 0
    let lastDbUpdate = downloaded
    this.downloadedBytes = downloaded

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        writeSync(fd, value)
        downloaded += value.length
        this.downloadedBytes = downloaded
        this.sessionDownloadedBytes += value.length

        if (downloaded - lastDbUpdate > 1024 * 1024) {
          repository.updateProgress(this.task.id, downloaded)
          lastDbUpdate = downloaded
        }
      }
    } finally {
      closeSync(fd)
    }
  }

  private async downloadMultiThreaded(): Promise<void> {
    let segments = repository.getSegments(this.task.id)

    if (segments.length === 0) {
      const totalSize = this.task.size
      const segmentSize = Math.floor(totalSize / SEGMENT_COUNT)
      const newSegments = []

      for (let i = 0; i < SEGMENT_COUNT; i++) {
        const start = i * segmentSize
        const end = i === SEGMENT_COUNT - 1 ? totalSize - 1 : (i + 1) * segmentSize - 1
        newSegments.push({ downloadId: this.task.id, startByte: start, endByte: end })
      }

      repository.createSegments(newSegments)
      segments = repository.getSegments(this.task.id)
    }

    if (!existsSync(this.tempPath)) {
      const empty = new Uint8Array(0)
      await Bun.write(this.tempPath, empty)
      truncateSync(this.tempPath, this.task.size)
    }

    const fd = openSync(this.tempPath, 'r+')

    try {
      const results = await Promise.allSettled(
        segments.map((segment) => this.downloadSegment(segment, fd))
      )

      const errors = results.filter((r) => r.status === 'rejected')
      if (errors.length > 0) {
        const firstError = (errors[0] as PromiseRejectedResult).reason
        throw firstError
      }
    } finally {
      closeSync(fd)
    }
  }

  private async downloadSegment(segment: SegmentTask, fd: number, retries = 3): Promise<void> {
    if (segment.status === 'completed') {
      return
    }

    let currentAttempt = 0
    while (currentAttempt <= retries) {
      try {
        const start = segment.startByte + segment.downloadedBytes
        if (start > segment.endByte) {
          repository.updateSegmentProgress(segment.id, segment.downloadedBytes, 'completed')
          return
        }

        const response = await fetch(this.task.url, {
          headers: {
            'Accept-Encoding': 'identity',
            'User-Agent': USER_AGENT,
            Range: `bytes=${start}-${segment.endByte}`,
          },
          signal: this.abortController.signal,
        })

        if (!response.ok && response.status !== 206) {
          throw new Error(`Segment HTTP ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('Segment no body')
        }

        let downloadedInSegment = segment.downloadedBytes
        let lastDbUpdate = segment.downloadedBytes

        this.segmentStats.set(segment.id, {
          downloaded: downloadedInSegment,
          sessionDownloaded: 0,
        })

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            break
          }

          writeSync(fd, value, 0, value.length, segment.startByte + downloadedInSegment)

          const chunkLength = value.length
          downloadedInSegment += chunkLength

          this.downloadedBytes += chunkLength
          this.sessionDownloadedBytes += chunkLength

          this.segmentStats.set(segment.id, {
            downloaded: downloadedInSegment,
            sessionDownloaded:
              (this.segmentStats.get(segment.id)?.sessionDownloaded || 0) + chunkLength,
          })

          if (downloadedInSegment - lastDbUpdate > 1024 * 1024) {
            repository.updateSegmentProgress(segment.id, downloadedInSegment, 'downloading')
            repository.updateProgress(this.task.id, this.downloadedBytes)
            lastDbUpdate = downloadedInSegment
          }
        }

        repository.updateSegmentProgress(segment.id, downloadedInSegment, 'completed')
        repository.updateProgress(this.task.id, this.downloadedBytes)
        return // Success
      } catch (error: any) {
        if (error.name === 'AbortError') throw error

        currentAttempt++
        if (currentAttempt > retries) {
          repository.updateSegmentProgress(segment.id, segment.downloadedBytes, 'failed')
          throw error
        }

        console.warn(
          `Segment ${segment.id} retry ${currentAttempt}/${retries} after error: ${error.message}`
        )
        await Bun.sleep(1000 * currentAttempt) // Exponential-ish backoff
      }
    }
  }

  private syncTotalProgress(): void {
    const segments = repository.getSegments(this.task.id)
    const total = segments.reduce((acc, s) => acc + s.downloadedBytes, 0)
    repository.updateProgress(this.task.id, total)
  }

  stop(): void {
    this.abortController.abort()
  }
}
