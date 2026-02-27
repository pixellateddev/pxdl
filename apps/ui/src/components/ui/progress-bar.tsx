import type { FC } from 'react'
import type { DownloadTask } from '@pxdl/types'
import styles from './progress-bar.module.css'

interface ProgressBarProps {
  task: DownloadTask
  color: string
}

export const ProgressBar: FC<ProgressBarProps> = ({ task, color }) => {
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
                  color: color,
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
