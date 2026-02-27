import { type FC } from 'react'
import type { DownloadTask } from '@pxdl/types'
import { formatBytes, formatDuration } from '@pxdl/utils'
import { useDownloadStore } from '../../store/use-download-store'
import { ProgressBar } from '../ui/progress-bar'
import styles from './task-card.module.css'

const STATUS_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  pending: { icon: '○', color: '#94a3b8', label: 'Pending' },
  downloading: { icon: '↓', color: '#10b981', label: 'Downloading' },
  paused: { icon: '⏸', color: '#f59e0b', label: 'Paused' },
  completed: { icon: '✓', color: '#3b82f6', label: 'Completed' },
  failed: { icon: '×', color: '#ef4444', label: 'Failed' },
}

interface TaskCardProps {
  task: DownloadTask
}

export const TaskCard: FC<TaskCardProps> = ({ task }) => {
  const { togglePause, deleteTask } = useDownloadStore()
  
  const progress = task.size > 0 ? (task.downloadedBytes / task.size) * 100 : 0
  const statusCfg = STATUS_ICONS[task.status] || STATUS_ICONS.pending

  return (
    <div className={`${styles.taskCard} ${styles[task.status]}`}>
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
              onClick={() => togglePause(task)}
              title={task.status === 'paused' ? 'Resume' : 'Pause'}
            >
              {task.status === 'paused' ? '▶' : '⏸'}
            </button>
          )}
          <button 
            className={`${styles.btnIcon} ${styles.btnDanger}`} 
            onClick={() => deleteTask(task.id)}
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
            <span className={styles.statValue} style={{ color: task.status === 'downloading' ? '#10b981' : 'inherit' }}>
              {task.status === 'downloading' ? `${formatBytes(task.speed || 0)}/s` : '—'}
            </span>
          </div>
          <div className={styles.statGroup}>
            <span className={styles.statLabel}>ETA</span>
            <span className={styles.statValue} style={{ color: task.status === 'downloading' ? '#f59e0b' : 'inherit' }}>
              {task.status === 'downloading' ? formatDuration(task.eta || 0) : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
