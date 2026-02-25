import { repository } from '@/core/db'
import { Downloader } from '@/core/downloader'

const MAX_CONCURRENT_DOWNLOADS = 3
const activeDownloaders = new Map<number, Downloader>()

export async function startScheduler() {
  console.log('Scheduler started...')

  while (true) {
    if (activeDownloaders.size < MAX_CONCURRENT_DOWNLOADS) {
      const task = repository.getPendingTask()

      if (task && !activeDownloaders.has(task.id)) {
        const downloader = new Downloader(task)
        activeDownloaders.set(task.id, downloader)

        console.log(`[Queue] Starting ${task.filename} (Active: ${activeDownloaders.size})`)

        downloader
          .start()
          .catch((err) => {
            console.error(`Error in downloader for ${task.id}:`, err)
          })
          .finally(() => {
            activeDownloaders.delete(task.id)
          })
      }
    }

    await Bun.sleep(2000)
  }
}
