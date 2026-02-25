import { Database } from 'bun:sqlite'
import type { DownloadTask, NewDownload } from '@/types'

const db = new Database('pxdl.db')

// Initialize the database schema
db.run(`
  CREATE TABLE IF NOT EXISTS downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    filename TEXT NOT NULL,
    size INTEGER DEFAULT 0,
    downloaded_bytes INTEGER DEFAULT 0,
    status TEXT CHECK(status IN ('pending', 'downloading', 'completed', 'failed')) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

export const repository = {
  addDownload(task: NewDownload): DownloadTask {
    const result = db
      .prepare('INSERT INTO downloads (url, filename, size) VALUES (?, ?, ?)')
      .run(task.url, task.filename, task.size)

    return this.getDownloadById(result.lastInsertRowid as number)!
  },

  getDownloadById(id: number): DownloadTask | null {
    const row = db.prepare('SELECT * FROM downloads WHERE id = ?').get(id) as any
    if (!row) {
      return null
    }
    return this.mapRowToTask(row)
  },

  getPendingTask(): DownloadTask | null {
    const row = db.prepare("SELECT * FROM downloads WHERE status = 'pending' LIMIT 1").get() as any
    if (!row) {
      return null
    }
    return this.mapRowToTask(row)
  },

  getAllDownloads(): DownloadTask[] {
    const rows = db.prepare('SELECT * FROM downloads ORDER BY created_at DESC').all() as any[]
    return rows.map((row) => {
      return this.mapRowToTask(row)
    })
  },

  updateStatus(id: number, status: DownloadTask['status']): void {
    db.prepare('UPDATE downloads SET status = ? WHERE id = ?').run(status, id)
  },

  updateProgress(id: number, downloadedBytes: number): void {
    db.prepare('UPDATE downloads SET downloaded_bytes = ? WHERE id = ?').run(downloadedBytes, id)
  },

  markCompleted(id: number, downloadedBytes: number): void {
    db.prepare("UPDATE downloads SET status = 'completed', downloaded_bytes = ? WHERE id = ?").run(
      downloadedBytes,
      id
    )
  },

  mapRowToTask(row: any): DownloadTask {
    return {
      id: row.id,
      url: row.url,
      filename: row.filename,
      size: row.size,
      downloadedBytes: row.downloaded_bytes,
      status: row.status as DownloadTask['status'],
      createdAt: row.created_at,
    }
  },
}

export { db }
