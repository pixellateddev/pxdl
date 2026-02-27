import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import type { DownloadTask, NewDownload, SegmentTask } from '@/types'
import { CONFIG_DIR, DB_PATH } from '@/constants'

// Ensure config directory exists
mkdirSync(CONFIG_DIR, { recursive: true })

const db = new Database(DB_PATH)

// Enable WAL mode for high-concurrency performance
db.run('PRAGMA journal_mode = WAL;')
db.run('PRAGMA foreign_keys = ON;')

// Initialize the database schema
db.run(`
  CREATE TABLE IF NOT EXISTS downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    filename TEXT NOT NULL,
    directory TEXT NOT NULL,
    size INTEGER DEFAULT 0,
    downloaded_bytes INTEGER DEFAULT 0,
    speed REAL DEFAULT 0,
    eta INTEGER DEFAULT 0,
    is_resumable INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    download_id INTEGER NOT NULL,
    start_byte INTEGER NOT NULL,
    end_byte INTEGER NOT NULL,
    downloaded_bytes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (download_id) REFERENCES downloads(id) ON DELETE CASCADE
  )
`)

export const repository = {
  addDownload(task: NewDownload): DownloadTask {
    const result = db
      .prepare(
        'INSERT INTO downloads (url, filename, directory, size, is_resumable) VALUES (?, ?, ?, ?, ?)'
      )
      .run(task.url, task.filename, task.directory, task.size, task.isResumable ? 1 : 0)

    return this.getDownloadById(result.lastInsertRowid as number)!
  },

  deleteDownload(id: number): void {
    db.prepare('DELETE FROM downloads WHERE id = ?').run(id)
    db.prepare('DELETE FROM segments WHERE download_id = ?').run(id)
  },

  getDownloadById(id: number): DownloadTask | null {
    const row = db.prepare('SELECT * FROM downloads WHERE id = ?').get(id) as any
    if (!row) {
      return null
    }
    const task = this.mapRowToTask(row)
    task.segments = this.getSegments(id)
    return task
  },

  getByUrl(url: string): DownloadTask | null {
    const row = db.prepare('SELECT * FROM downloads WHERE url = ?').get(url) as any
    if (!row) {
      return null
    }
    return this.mapRowToTask(row)
  },

  getByFilename(filename: string): DownloadTask | null {
    const row = db.prepare('SELECT * FROM downloads WHERE filename = ?').get(filename) as any
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

  getSegments(downloadId: number): SegmentTask[] {
    const rows = db.prepare('SELECT * FROM segments WHERE download_id = ?').all(downloadId) as any[]
    return rows.map((row) => ({
      id: row.id,
      downloadId: row.download_id,
      startByte: row.start_byte,
      endByte: row.end_byte,
      downloadedBytes: row.downloaded_bytes,
      status: row.status,
    }))
  },

  createSegments(segments: Omit<SegmentTask, 'id' | 'status' | 'downloadedBytes'>[]): void {
    const insert = db.prepare(`
      INSERT INTO segments (download_id, start_byte, end_byte) 
      VALUES ($downloadId, $startByte, $endByte)
    `)

    db.transaction(() => {
      for (const s of segments) {
        insert.run({
          $downloadId: s.downloadId,
          $startByte: s.startByte,
          $endByte: s.endByte,
        })
      }
    })()
  },

  updateSegmentProgress(id: number, downloadedBytes: number, status: SegmentTask['status']): void {
    db.prepare('UPDATE segments SET downloaded_bytes = ?, status = ? WHERE id = ?').run(
      downloadedBytes,
      status,
      id
    )
  },

  mapRowToTask(row: any): DownloadTask {
    return {
      id: row.id,
      url: row.url,
      filename: row.filename,
      directory: row.directory,
      size: row.size,
      downloadedBytes: row.downloaded_bytes,
      status: row.status as DownloadTask['status'],
      isResumable: row.is_resumable === 1,
      createdAt: row.created_at,
      speed: row.speed,
      eta: row.eta,
    }
  },
}

export { db }
