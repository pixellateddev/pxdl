import type { FC } from 'react'
import { useDownloadStore } from '../../store/use-download-store'
import styles from './search-bar.module.css'

export const SearchBar: FC = () => {
  const { searchQuery, setSearchQuery, tasks } = useDownloadStore()

  if (tasks.length === 0) return null

  return (
    <div className={styles.searchWrapper}>
      <div className={styles.icon}>🔍</div>
      <input
        type="text"
        className={styles.searchInput}
        placeholder="Filter tasks by name or URL..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      {searchQuery && (
        <button 
          className={styles.clearBtn}
          onClick={() => setSearchQuery('')}
        >
          ✕
        </button>
      )}
    </div>
  )
}
