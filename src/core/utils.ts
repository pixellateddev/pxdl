export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) {
    return '0 B'
  }

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))}${sizes[i]}`
}

export const formatDuration = (seconds: number): string => {
  if (seconds === Number.POSITIVE_INFINITY || Number.isNaN(seconds)) {
    return 'Calculating...'
  }
  if (seconds < 1) {
    return '0s'
  }

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  const parts = []
  if (h > 0) {
    parts.push(`${h}h`)
  }
  if (m > 0) {
    parts.push(`${m}m`)
  }
  if (s > 0 || parts.length === 0) {
    parts.push(`${s}s`)
  }

  return parts.join(' ')
}
