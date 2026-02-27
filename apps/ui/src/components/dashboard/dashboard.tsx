import { type FC, useCallback, useEffect, useState } from 'react'
import { formatBytes, formatDuration } from '@pxdl/utils'
import type { DownloadTask } from '@pxdl/types'
import styles from './dashboard.module.css'

// TODO: Use environment variable or config for this
const API_BASE = 'http://localhost:18281'

// Mock probeUrl for now until we have a browser-safe version or API endpoint
const probeUrl = async (url: string) => {
  const res = await fetch(`${API_BASE}/probe?url=${encodeURIComponent(url)}`)
  if (!res.ok) throw new Error('Failed to probe URL')
  return await res.json()
}

const STATUS_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  pending: { icon: '○', color: '#9ca3af', label: 'Pending' },
  downloading: { icon: '↓', color: '#10b981', label: 'Downloading' },
  paused: { icon: '⏸', color: '#f59e0b', label: 'Paused' },
  completed: { icon: '✓', color: '#3b82f6', label: 'Completed' },
  failed: { icon: '×', color: '#ef4444', label: 'Failed' },
}

interface ProgressBarProps {
  progress: number
  color: string
}

const ProgressBar: FC<ProgressBarProps> = ({ progress, color }) => {
  return (
    <div className={styles.progressBarBg}>
      <div 
        className={styles.progressBarFill} 
        style={{ width: `${progress}%`, backgroundColor: color }}
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
          <h1 className={styles.title}>pxdl <span className={styles.version}>v1.0</span></h1>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.btnPrimary} onClick={() => setIsAdding(!isAdding)}>
            {isAdding ? 'Cancel' : '+ New Download'}
          </button>
        </div>
      </header>

      {error && <div className={`${styles.alert} ${styles.alertError}`}>{error}</div>}
      {statusMessage && <div className={`${styles.alert} ${styles.alertInfo}`}>{statusMessage}</div>}

      {isAdding && (
        <form className={styles.addForm} onSubmit={handleAddDownload}>
          <input 
            type="text" 
            placeholder="Enter URL to download..." 
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            autoFocus
            disabled={isProbing}
          />
          <button type="submit" className={styles.btnSuccess} disabled={isProbing || !newUrl}>
            {isProbing ? 'Probing...' : 'Add to Queue'}
          </button>
        </form>
      )}

      <div className={styles.taskList}>
        {tasks.length === 0 ? (
          <div className={styles.emptyState}>No downloads in queue</div>
        ) : (
          tasks.map(task => {
            const progress = task.size > 0 ? (task.downloadedBytes / task.size) * 100 : 0
            const statusCfg = STATUS_ICONS[task.status] || STATUS_ICONS.pending
            
            return (
              <div key={task.id} className={`${styles.taskCard} ${styles[task.status]}`}>
                <div className={styles.taskHeader}>
                  <div className={styles.taskTitleGroup}>
                    <span className={styles.statusIcon} style={{ color: statusCfg.color }}>
                      {statusCfg.icon}
                    </span>
                    <span className={styles.filename}>{task.filename}</span>
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
                      title="Delete"
                    >
                      🗑
                    </button>
                  </div>
                </div>

                <div className={styles.taskBody}>
                  <ProgressBar progress={progress} color={statusCfg.color} />
                  
                  <div className={styles.taskStats}>
                    <div className={styles.statGroup}>
                      <span className={styles.statLabel}>Progress</span>
                      <span className={styles.statValue}>{progress.toFixed(1)}%</span>
                    </div>
                    <div className={styles.statGroup}>
                      <span className={styles.statLabel}>Size</span>
                      <span className={styles.statValue}>{formatBytes(task.downloadedBytes)} / {formatBytes(task.size)}</span>
                    </div>
                    {task.status === 'downloading' && (
                      <>
                        <div className={styles.statGroup}>
                          <span className={styles.statLabel}>Speed</span>
                          <span className={styles.statValue} style={{ color: 'var(--accent)' }}>{formatBytes(task.speed || 0)}/s</span>
                        </div>
                        <div className={styles.statGroup}>
                          <span className={styles.statLabel}>ETA</span>
                          <span className={styles.statValue} style={{ color: 'var(--warning)' }}>{formatDuration(task.eta || 0)}</span>
                        </div>
                      </>
                    )}
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
