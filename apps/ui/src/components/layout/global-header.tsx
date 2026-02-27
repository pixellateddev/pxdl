import type { FC } from 'react'
import { useDownloadStore } from '../../store/use-download-store'
import styles from './global-header.module.css'

export const GlobalHeader: FC = () => {
  const { isAdding, setIsAdding, setError } = useDownloadStore()

  return (
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
  )
}
