import { create } from 'zustand'
import type { DownloadTask } from '@pxdl/types'

const API_BASE = 'http://localhost:18281'

interface DownloadState {
  tasks: DownloadTask[]
  error: string | null
  statusMessage: string | null
  isAdding: boolean
  newUrl: string
  isProbing: boolean
  searchQuery: string
  
  // Actions
  setTasks: (tasks: DownloadTask[]) => void
  setError: (error: string | null) => void
  setStatusMessage: (msg: string | null) => void
  setIsAdding: (val: boolean) => void
  setNewUrl: (url: string) => void
  setIsProbing: (val: boolean) => void
  setSearchQuery: (query: string) => void
  
  // Async Actions
  fetchTasks: () => Promise<void>
  addDownload: (url: string) => Promise<void>
  togglePause: (task: DownloadTask) => Promise<void>
  deleteTask: (id: number) => Promise<void>
  initSSE: () => () => void
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  tasks: [],
  error: null,
  statusMessage: null,
  isAdding: false,
  newUrl: '',
  isProbing: false,
  searchQuery: '',

  setTasks: (tasks) => set({ tasks }),
  setError: (error) => set({ error }),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
  setIsAdding: (isAdding) => set({ isAdding, error: null }),
  setNewUrl: (newUrl) => set({ newUrl }),
  setIsProbing: (isProbing) => set({ isProbing }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

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
      const probe = await probeRes.json()

      const res = await fetch(`${API_BASE}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: probe.url,
          filename: probe.filename,
          size: probe.size,
          isResumable: probe.isResumable,
        }),
      })

      if (res.ok) {
        set({ newUrl: '', isAdding: false, statusMessage: null })
      } else if (res.status === 409) {
        set({ error: 'URL already in queue' })
      } else {
        set({ error: 'Failed to add download' })
      }
    } catch (err: any) {
      set({ error: `Add failed: ${err.message}` })
    } finally {
      set({ isProbing: false, statusMessage: null })
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
