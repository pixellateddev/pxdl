import { type FC, useEffect } from 'react'
import { useDownloadStore } from '../../store/use-download-store'
import { GlobalHeader } from '../layout/global-header'
import { SummaryBar } from '../features/summary-bar'
import { AddForm } from '../features/add-form'
import { SearchBar } from '../features/search-bar'
import { TaskList } from '../features/task-list'
import styles from './dashboard.module.css'

const STATUS_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  pending: { icon: '○', color: '#94a3b8', label: 'Pending' },
  downloading: { icon: '↓', color: '#10b981', label: 'Downloading' },
  paused: { icon: '⏸', color: '#f59e0b', label: 'Paused' },
  completed: { icon: '✓', color: '#3b82f6', label: 'Completed' },
  failed: { icon: '×', color: '#ef4444', label: 'Failed' },
}

export const Dashboard: FC = () => {
  const { initSSE, error } = useDownloadStore()

  useEffect(() => {
    return initSSE()
  }, [initSSE])

  return (
    <div className={styles.container}>
      <GlobalHeader />
      
      {error && <div className={`${styles.alert} ${styles.alertError}`}>{error}</div>}
      
      <main className={styles.main}>
        <SummaryBar />
        <AddForm />
        <SearchBar />
        <TaskList />
      </main>

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
