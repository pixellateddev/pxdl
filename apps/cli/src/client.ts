import { probeUrl } from '@pxdl/core'
import { formatBytes } from '@pxdl/core'
import type { DownloadTask, NewDownload } from '@pxdl/types'
import { ensureDaemonRunning } from './daemon'
import { API_BASE } from '@pxdl/core'

export const addToQueue = async (url: string) => {
  await ensureDaemonRunning()
  try {
    console.log('Probing URL...')
    const probe = await probeUrl(url)

    console.log(`File: ${probe.filename}`)
    console.log(`Size: ${formatBytes(probe.size)}`)

    const response = await fetch(`${API_BASE}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: probe.url,
        filename: probe.filename,
        size: probe.size,
        isResumable: probe.isResumable,
      } as NewDownload),
    })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as any
      throw new Error(errorData.message || 'Could not add download to daemon.')
    }

    const result = (await response.json()) as { success: boolean; message: string }
    console.log(`✅ ${result.message}`)
  } catch (error: any) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }
}

export const listTasks = async () => {
  await ensureDaemonRunning()
  try {
    const res = await fetch(`${API_BASE}/status`)
    if (!res.ok) throw new Error('Failed to fetch tasks')
    const tasks = (await res.json()) as DownloadTask[]

    if (tasks.length === 0) {
      console.log('No tasks in queue.')
      return
    }

    console.log('ID | Filename | Size | Status | Progress')
    console.log('---|----------|------|--------|---------')
    for (const task of tasks) {
      const progress = ((task.downloadedBytes / task.size) * 100).toFixed(1)
      console.log(
        `${task.id} | ${task.filename} | ${formatBytes(task.size)} | ${task.status} | ${progress}%`
      )
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`)
  }
}

export const pauseTask = async (id: string) => {
  await ensureDaemonRunning()
  try {
    if (id === 'all') {
      const res = await fetch(`${API_BASE}/status`)
      const tasks = (await res.json()) as DownloadTask[]
      for (const task of tasks) {
        if (task.status === 'downloading' || task.status === 'pending') {
          await fetch(`${API_BASE}/pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: task.id }),
          })
        }
      }
      console.log('✅ Paused all tasks.')
    } else {
      const taskId = Number.parseInt(id)
      const res = await fetch(`${API_BASE}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId }),
      })
      if (res.ok) {
        console.log(`✅ Paused task ${taskId}`)
      } else {
        console.log(`❌ Failed to pause task ${taskId}`)
      }
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`)
  }
}

export const resumeTask = async (id: string) => {
  await ensureDaemonRunning()
  try {
    if (id === 'all') {
      const res = await fetch(`${API_BASE}/status`)
      const tasks = (await res.json()) as DownloadTask[]
      for (const task of tasks) {
        if (task.status === 'paused' || task.status === 'failed') {
          await fetch(`${API_BASE}/resume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: task.id }),
          })
        }
      }
      console.log('✅ Resumed all tasks.')
    } else {
      const taskId = Number.parseInt(id)
      const res = await fetch(`${API_BASE}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId }),
      })
      if (res.ok) {
        console.log(`✅ Resumed task ${taskId}`)
      } else {
        console.log(`❌ Failed to resume task ${taskId}`)
      }
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`)
  }
}

export const removeTask = async (id: string, clean: boolean) => {
  await ensureDaemonRunning()
  try {
    const taskId = Number.parseInt(id)
    const res = await fetch(`${API_BASE}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, deleteFile: clean }),
    })
    if (res.ok) {
      console.log(`✅ Removed task ${taskId}${clean ? ' and deleted file' : ''}`)
    } else {
      console.log(`❌ Failed to remove task ${taskId}`)
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`)
  }
}
