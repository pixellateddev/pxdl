export interface ProbeResult {
  url: string
  filename: string
  size: number
  isResumable: boolean
  contentType: string
}

export interface DownloadTask {
  id: number
  url: string
  filename: string
  size: number
  downloadedBytes: number
  status: 'pending' | 'downloading' | 'completed' | 'failed'
  createdAt: string
  speed?: number
  eta?: number
}

export type NewDownload = Pick<DownloadTask, 'url' | 'filename' | 'size'>
