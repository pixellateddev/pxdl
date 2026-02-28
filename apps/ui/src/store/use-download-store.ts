import { create } from 'zustand'
import type { DownloadTask, ProbeResult } from '@pxdl/types'
import { notifications } from '@mantine/notifications'

const isTauri = () => '__TAURI_INTERNALS__' in window

const API_BASE = 'http://localhost:18281'

interface DownloadState {
  tasks: DownloadTask[]
  error: string | null
  statusMessage: string | null
  addModalOpen: boolean
  newUrl: string
  isProbing: boolean
  searchQuery: string
  detailedTaskId: number | null
  
  // New Modal State
  configModalOpen: boolean
  pendingDownload: ProbeResult | null
  
  // Actions
  setTasks: (tasks: DownloadTask[]) => void
  setError: (error: string | null) => void
  setStatusMessage: (msg: string | null) => void
  setAddModalOpen: (val: boolean) => void
  setNewUrl: (url: string) => void
  setIsProbing: (val: boolean) => void
  setSearchQuery: (query: string) => void
  setDetailedTaskId: (id: number | null) => void
  
  // New Modal Actions
  setConfigModalOpen: (val: boolean) => void
  setPendingDownload: (val: ProbeResult | null) => void
  openInterceptedDownload: (probe: ProbeResult) => void
  
  // Async Actions
  fetchTasks: () => Promise<void>
  addDownload: (url: string) => Promise<void>
  confirmDownload: (config: { filename: string; directory: string }) => Promise<void>
  togglePause: (task: DownloadTask) => Promise<void>
  pauseAll: () => Promise<void>
  resumeAll: () => Promise<void>
  clearCompleted: () => Promise<void>
  renameTask: (id: number, filename: string) => Promise<void>
  deleteTask: (id: number, deleteFile?: boolean) => Promise<void>
  initSSE: () => () => void
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  tasks: [],
  error: null,
  statusMessage: null,
  addModalOpen: false,
  newUrl: '',
  isProbing: false,
  searchQuery: '',
  detailedTaskId: null,
  configModalOpen: false,
  pendingDownload: null,

  setTasks: (tasks) => set({ tasks }),
  setError: (error) => set({ error }),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
  setAddModalOpen: (addModalOpen) => set({ addModalOpen, error: null, newUrl: addModalOpen ? get().newUrl : '' }),
  setNewUrl: (newUrl) => set({ newUrl }),
  setIsProbing: (isProbing) => set({ isProbing }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setDetailedTaskId: (detailedTaskId) => set({ detailedTaskId }),
  setConfigModalOpen: (configModalOpen) => set({ configModalOpen }),
  setPendingDownload: (pendingDownload) => set({ pendingDownload }),
  openInterceptedDownload: (probe) => set({ pendingDownload: probe, configModalOpen: true }),

  fetchTasks: async () => {
    try {
      const res = await fetch(`${API_BASE}/status`)
      if (res.ok) {
        const data = await res.json()
        set({ tasks: data, error: null })
      }
    } catch (err) {
      set({ error: 'Failed to fetch tasks' })
    }
  },

  addDownload: async (url: string) => {
    set({ isProbing: true, statusMessage: 'Probing URL...' })
    try {
      const probeRes = await fetch(`${API_BASE}/probe?url=${encodeURIComponent(url)}`)
      if (!probeRes.ok) throw new Error('Probe failed')
      const probe = (await probeRes.json()) as ProbeResult

      // Instead of adding immediately, open the modal
      set({ 
        pendingDownload: probe, 
        configModalOpen: true,
        addModalOpen: false,
        newUrl: '' 
      })
    } catch (err: any) {
      notifications.show({
        title: 'Probe failed',
        message: err.message,
        color: 'red',
      })
    } finally {
      set({ isProbing: false, statusMessage: null })
    }
  },

  confirmDownload: async (config) => {
    const { pendingDownload } = get()
    if (!pendingDownload) return

    try {
      const res = await fetch(`${API_BASE}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: pendingDownload.url,
          filename: config.filename,
          directory: config.directory,
          size: pendingDownload.size,
          isResumable: pendingDownload.isResumable,
        }),
      })

      if (res.ok) {
        set({ configModalOpen: false, pendingDownload: null })
        notifications.show({
          title: 'Download Added',
          message: `${config.filename} has been added to the queue.`,
          color: 'var(--mantine-primary-color-filled)',
        })
      } else {
        const data = await res.json()
        notifications.show({
          title: 'Add failed',
          message: data.message || 'Failed to add download',
          color: 'red',
        })
      }
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.message,
        color: 'red',
      })
    }
  },

  togglePause: async (task: DownloadTask) => {
    try {
      const endpoint = task.status === 'paused' ? '/resume' : '/pause'
      await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id }),
      })
    } catch (err) {
      set({ error: 'Action failed' })
    }
  },

  pauseAll: async () => {
    try {
      await fetch(`${API_BASE}/pause-all`, { method: 'POST' })
    } catch (err) {
      set({ error: 'Pause all failed' })
    }
  },

  resumeAll: async () => {
    try {
      await fetch(`${API_BASE}/resume-all`, { method: 'POST' })
    } catch (err) {
      set({ error: 'Resume all failed' })
    }
  },

  clearCompleted: async () => {
    try {
      await fetch(`${API_BASE}/clear-completed`, { method: 'POST' })
    } catch (err) {
      set({ error: 'Clear completed failed' })
    }
  },

  renameTask: async (id: number, filename: string) => {
    try {
      const res = await fetch(`${API_BASE}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, filename }),
      })
      if (!res.ok) {
        const data = await res.json()
        notifications.show({ title: 'Rename failed', message: data.message, color: 'red' })
      }
    } catch (err) {
      set({ error: 'Rename failed' })
    }
  },

  deleteTask: async (id: number, deleteFile = false) => {
    try {
      await fetch(`${API_BASE}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, deleteFile }),
      })
      notifications.show({
        title: 'Task deleted',
        message: 'The download task has been removed.',
        color: 'gray',
      })
    } catch (err) {
      set({ error: 'Delete failed' })
    }
  },

  initSSE: () => {
    const eventSource = new EventSource(`${API_BASE}/events`)
    const prevStatuses = new Map<number, DownloadTask['status']>()

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as DownloadTask[]
        set({ tasks: data, error: null })

        if (isTauri()) {
          import('@tauri-apps/plugin-notification').then(({ sendNotification }) => {
            for (const task of data) {
              const prev = prevStatuses.get(task.id)
              if (prev !== 'completed' && task.status === 'completed') {
                sendNotification({
                  title: 'Download Complete',
                  body: task.filename,
                })
              }
              prevStatuses.set(task.id, task.status)
            }
          })
        } else {
          for (const task of data) {
            prevStatuses.set(task.id, task.status)
          }
        }
      } catch (err) {
        console.error('SSE Parse Error', err)
      }
    }

    eventSource.onerror = () => {
      set({ error: 'Connection to daemon lost. Reconnecting...' })
    }

    return () => eventSource.close()
  }
}))
