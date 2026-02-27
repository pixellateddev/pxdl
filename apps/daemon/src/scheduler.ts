import { EventEmitter } from 'node:events'
import { Downloader, repository } from '@pxdl/core'

const MAX_CONCURRENT_DOWNLOADS = 3
export const activeDownloaders = new Map<number, Downloader>()
const schedulerEvents = new EventEmitter()

let isProcessing = false

const processQueue = async () => {
  if (isProcessing) return
  isProcessing = true

  try {
    while (activeDownloaders.size < MAX_CONCURRENT_DOWNLOADS) {
      const task = repository.getPendingTask()

      if (!task || activeDownloaders.has(task.id)) {
        break
      }

      const downloader = new Downloader(task)
      activeDownloaders.set(task.id, downloader)

      console.log(`[Queue] Starting ${task.filename} (Active: ${activeDownloaders.size})`)

      // Run downloader in background
      downloader
        .start()
        .catch((err) => {
          console.error(`Error in downloader for ${task.id}:`, err)
        })
        .finally(() => {
          activeDownloaders.delete(task.id)
          triggerScheduler() // Check queue again when a task finishes
        })
    }
  } finally {
    isProcessing = false
  }
}

export const triggerScheduler = () => {
  schedulerEvents.emit('check')
}

export const startScheduler = async () => {
  console.log('Scheduler started...')

  schedulerEvents.on('check', () => {
    processQueue().catch((err) => console.error('Scheduler process error:', err))
  })

  // Initial check
  triggerScheduler()
}
