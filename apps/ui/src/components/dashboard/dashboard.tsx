import { type FC, useCallback, useEffect, useState } from 'react'
import { formatBytes, formatDuration } from '@pxdl/utils'
import type { DownloadTask } from '@pxdl/types'
import styles from './dashboard.module.css'

// TODO: Use environment variable or config for this
const API_BASE = 'http://localhost:18281'

const probeUrl = async (url: string) => {
  const res = await fetch(`${API_BASE}/probe?url=${encodeURIComponent(url)}`)
  if (!res.ok) throw new Error('Failed to probe URL')
  return await res.json()
}

const STATUS_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  pending: { icon: '○', color: '#94a3b8', label: 'Pending' },
  downloading: { icon: '↓', color: '#10b981', label: 'Downloading' },
  paused: { icon: '⏸', color: '#f59e0b', label: 'Paused' },
  completed: { icon: '✓', color: '#3b82f6', label: 'Completed' },
  failed: { icon: '×', color: '#ef4444', label: 'Failed' },
}

interface ProgressBarProps {
  task: DownloadTask
  color: string
}

const ProgressBar: FC<ProgressBarProps> = ({ task, color }) => {
  const { segments, size, downloadedBytes } = task
  const totalProgress = size > 0 ? (downloadedBytes / size) * 100 : 0

  if (segments && segments.length > 0 && size > 0) {
    return (
      <div className={styles.progressBarBg}>
        {segments.map((segment) => {
          const segmentSize = segment.endByte - segment.startByte + 1
          const left = (segment.startByte / size) * 100
          const width = (segmentSize / size) * 100
          const segmentProgress = (segment.downloadedBytes / segmentSize) * 100

          return (
            <div
              key={segment.id}
              className={styles.segmentSlot}
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              <div
                className={`${styles.segmentFill} ${segment.status === 'downloading' ? styles.active : ''}`}
                style={{
                  width: `${segmentProgress}%`,
                  backgroundColor: color,
                  color: color, // For shadow in pulse animation
                }}
              />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={styles.progressBarBg}>
      <div
        className={styles.progressBarFill}
        style={{ width: `${totalProgress}%`, backgroundColor: color }}
      />
    </div>
  )
}

export const Dashboard: FC = () => {
  const [tasks, setTasks] = useState<DownloadTask[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isProbing, setIsProbing] = useState(false)

  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/events`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as DownloadTask[]
        setTasks(data)
        setError(null)
      } catch (err) {
        console.error('SSE data parse error:', err)
      }
    }

    eventSource.onerror = () => {
      setError('Connection to daemon lost. Reconnecting...')
    }

    return () => {
      eventSource.close()
    }
  }, [])

  const handleTogglePause = async (task: DownloadTask) => {
    try {
      const endpoint = task.status === 'paused' ? '/resume' : '/pause'
      await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id }),
      })
    } catch (err) {
      setError('Action failed')
    }
  }

  const handleDelete = async (id: number) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this task?')
    if (!confirmDelete) return

    try {
      await fetch(`${API_BASE}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, deleteFile: false }),
      })
    } catch (err) {
      setError('Delete failed')
    }
  }

  const handleAddDownload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUrl) return

    setIsProbing(true)
    setStatusMessage('Probing URL...')
    
    try {
      const probe = await probeUrl(newUrl)
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
        setNewUrl('')
        setIsAdding(false)
        setStatusMessage(null)
      } else if (res.status === 409) {
        setError('URL already in queue')
      } else {
        setError('Failed to add download')
      }
    } catch (err: any) {
      setError(`Probe failed: ${err.message}`)
    } finally {
      setIsProbing(false)
      setStatusMessage(null)
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            pxdl <span className={styles.version}>v1.0</span>
          </h1>
        </div>
        <div className={styles.headerRight}>
          <button 
            className={isAdding ? styles.btnIcon : styles.btnPrimary} 
            onClick={() => {
              setIsAdding(!isAdding)
              setError(null)
            }}
          >
            {isAdding ? '✕' : '+ New Download'}
          </button>
        </div>
      </header>

      {error && <div className={`${styles.alert} ${styles.alertError}`}>{error}</div>}
      {statusMessage && <div className={`${styles.alert} ${styles.alertInfo}`}>{statusMessage}</div>}

      {isAdding && (
        <form className={styles.addForm} onSubmit={handleAddDownload}>
          <input 
            type="text" 
            placeholder="Paste download URL here..." 
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            autoFocus
            disabled={isProbing}
          />
          <button type="submit" className={styles.btnSuccess} disabled={isProbing || !newUrl}>
            {isProbing ? 'Probing...' : 'Download'}
          </button>
        </form>
      )}

      <div className={styles.taskList}>
        {tasks.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No downloads yet.</p>
            <small>Add a URL to get started.</small>
          </div>
        ) : (
          tasks.map(task => {
            const progress = task.size > 0 ? (task.downloadedBytes / task.size) * 100 : 0
            const statusCfg = STATUS_ICONS[task.status] || STATUS_ICONS.pending
            
            return (
              <div key={task.id} className={`${styles.taskCard} ${styles[task.status]}`}>
                <div className={styles.taskHeader}>
                  <div className={styles.taskTitleGroup}>
                    <div className={styles.statusIcon} style={{ color: statusCfg.color }}>
                      {statusCfg.icon}
                    </div>
                    <span className={styles.filename} title={task.filename}>
                      {task.filename}
                    </span>
                  </div>
                  <div className={styles.taskActions}>
                    {task.status !== 'completed' && (
                      <button 
                        className={styles.btnIcon} 
                        onClick={() => handleTogglePause(task)}
                        title={task.status === 'paused' ? 'Resume' : 'Pause'}
                      >
                        {task.status === 'paused' ? '▶' : '⏸'}
                      </button>
                    )}
                    <button 
                      className={`${styles.btnIcon} ${styles.btnDanger}`} 
                      onClick={() => handleDelete(task.id)}
                      title="Delete Task"
                    >
                      🗑
                    </button>
                  </div>
                </div>

                <div className={styles.taskBody}>
                  <ProgressBar task={task} color={statusCfg.color} />
                  
                  <div className={styles.taskStats}>
                    <div className={styles.statGroup}>
                      <span className={styles.statLabel}>Progress</span>
                      <span className={styles.statValue}>{progress.toFixed(1)}%</span>
                    </div>
                    <div className={styles.statGroup}>
                      <span className={styles.statLabel}>Size</span>
                      <span className={styles.statValue}>
                        {formatBytes(task.downloadedBytes)} / {formatBytes(task.size)}
                      </span>
                    </div>
                    <div className={styles.statGroup}>
                      <span className={styles.statLabel}>Speed</span>
                      <span className={styles.statValue} style={{ color: task.status === 'downloading' ? 'var(--success)' : 'inherit' }}>
                        {task.status === 'downloading' ? `${formatBytes(task.speed || 0)}/s` : '—'}
                      </span>
                    </div>
                    <div className={styles.statGroup}>
                      <span className={styles.statLabel}>ETA</span>
                      <span className={styles.statValue} style={{ color: task.status === 'downloading' ? 'var(--warning)' : 'inherit' }}>
                        {task.status === 'downloading' ? formatDuration(task.eta || 0) : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <footer className={styles.footer}>
        <div className={styles.statusLegend}>
          {Object.entries(STATUS_ICONS).map(([key, cfg]) => (
            <div key={key} className={styles.legendItem}>
              <span style={{ color: cfg.color }}>{cfg.icon}</span>
              <span>{cfg.label}</span>
            </div>
          ))}
        </div>
      </footer>
    </div>
  )
}
