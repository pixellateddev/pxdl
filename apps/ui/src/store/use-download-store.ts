import { create } from 'zustand'
import type { DownloadTask, ProbeResult } from '@pxdl/types'
import { notifications } from '@mantine/notifications'

const API_BASE = 'http://localhost:18281'

interface DownloadState {
  tasks: DownloadTask[]
  error: string | null
  statusMessage: string | null
  addModalOpen: boolean
  newUrl: string
  isProbing: boolean
  searchQuery: string
  viewMode: 'table' | 'card'
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
  setViewMode: (mode: 'table' | 'card') => void
  setDetailedTaskId: (id: number | null) => void
  
  // New Modal Actions
  setConfigModalOpen: (val: boolean) => void
  setPendingDownload: (val: ProbeResult | null) => void
  
  // Async Actions
  fetchTasks: () => Promise<void>
  addDownload: (url: string) => Promise<void>
  confirmDownload: (config: { filename: string; directory: string }) => Promise<void>
  togglePause: (task: DownloadTask) => Promise<void>
  deleteTask: (id: number) => Promise<void>
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
  viewMode: 'table',
  detailedTaskId: null,
  configModalOpen: false,
  pendingDownload: null,

  setTasks: (tasks) => set({ tasks }),
  setError: (error) => set({ error }),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
  setAddModalOpen: (addModalOpen) => set({ addModalOpen, error: null }),
  setNewUrl: (newUrl) => set({ newUrl }),
  setIsProbing: (isProbing) => set({ isProbing }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setViewMode: (viewMode) => set({ viewMode }),
  setDetailedTaskId: (detailedTaskId) => set({ detailedTaskId }),
  setConfigModalOpen: (configModalOpen) => set({ configModalOpen }),
  setPendingDownload: (pendingDownload) => set({ pendingDownload }),

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
          color: 'teal',
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

  deleteTask: async (id: number) => {
    if (!window.confirm('Delete this task?')) return
    try {
      await fetch(`${API_BASE}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, deleteFile: false }),
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

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        set({ tasks: data, error: null })
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
