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
    speed REAL DEFAULT 0,
    eta INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// Migration: If the table was created without 'paused' support, we remove the CHECK constraint
// SQLite doesn't easily allow dropping constraints, so we just remove it from the CREATE statement
// and future runs won't have it.

export const repository = {
  addDownload(task: NewDownload): DownloadTask {
    const result = db
      .prepare('INSERT INTO downloads (url, filename, size) VALUES (?, ?, ?)')
      .run(task.url, task.filename, task.size)

    return this.getDownloadById(result.lastInsertRowid as number)!
  },

  deleteDownload(id: number): void {
    db.prepare('DELETE FROM downloads WHERE id = ?').run(id)
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
    db.prepare('UPDATE downloads SET status = ?, speed = 0, eta = 0 WHERE id = ?').run(status, id)
  },

  updateProgress(id: number, downloadedBytes: number): void {
    db.prepare('UPDATE downloads SET downloaded_bytes = ? WHERE id = ?').run(downloadedBytes, id)
  },

  markCompleted(id: number, downloadedBytes: number): void {
    db.prepare(
      "UPDATE downloads SET status = 'completed', downloaded_bytes = ?, speed = 0, eta = 0 WHERE id = ?"
    ).run(downloadedBytes, id)
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
