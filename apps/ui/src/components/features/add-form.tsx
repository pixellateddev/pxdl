import { type FC, type FormEvent } from 'react'
import { useDownloadStore } from '../../store/use-download-store'
import styles from './add-form.module.css'

export const AddForm: FC = () => {
  const { 
    isAdding, 
    newUrl, 
    setNewUrl, 
    addDownload, 
    isProbing,
    statusMessage
  } = useDownloadStore()

  if (!isAdding) return null

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (newUrl) addDownload(newUrl)
  }

  return (
    <div className={styles.wrapper}>
      <form className={styles.addForm} onSubmit={handleSubmit}>
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
      {statusMessage && <div className={styles.status}>{statusMessage}</div>}
    </div>
  )
}
