import type { FC } from 'react'
import { useDownloadStore } from '../../store/use-download-store'
import { formatBytes } from '@pxdl/utils'
import styles from './summary-bar.module.css'

export const SummaryBar: FC = () => {
  const tasks = useDownloadStore((state) => state.tasks)
  
  const activeTasks = tasks.filter(t => t.status === 'downloading')
  const totalSpeed = activeTasks.reduce((acc, t) => acc + (t.speed || 0), 0)
  const totalSize = tasks.reduce((acc, t) => acc + (t.size || 0), 0)
  const totalDownloaded = tasks.reduce((acc, t) => acc + (t.downloadedBytes || 0), 0)
  const overallProgress = totalSize > 0 ? (totalDownloaded / totalSize) * 100 : 0

  if (tasks.length === 0) return null

  return (
    <div className={styles.summaryBar}>
      <div className={styles.stat}>
        <span className={styles.label}>Global Speed</span>
        <span className={styles.value}>{formatBytes(totalSpeed)}/s</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.label}>Overall Progress</span>
        <span className={styles.value}>{overallProgress.toFixed(1)}%</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.label}>Active</span>
        <span className={styles.value}>{activeTasks.length} / {tasks.length}</span>
      </div>
    </div>
  )
}
