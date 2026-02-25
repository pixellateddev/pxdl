import { basename } from 'node:path'
import type { ProbeResult } from './types'

export async function probeUrl(url: string): Promise<ProbeResult> {
  const response = await fetch(url, {
    method: 'HEAD',
    headers: {
      'Accept-Encoding': 'identity',
    },
  })

  // Some servers don't support HEAD or return 405/403, fall back to a Range GET
  if (!response.ok) {
    const getResponse = await fetch(url, {
      headers: {
        Range: 'bytes=0-0',
        'Accept-Encoding': 'identity',
      },
    })

    if (!getResponse.ok) {
      throw new Error(`Failed to probe URL: ${getResponse.statusText} (${getResponse.status})`)
    }

    return parseResponse(url, getResponse)
  }

  return parseResponse(url, response)
}

function parseResponse(url: string, response: Response): ProbeResult {
  const headers = response.headers
  const acceptRanges = headers.get('accept-ranges')
  const contentRange = headers.get('content-range')
  const contentLength = headers.get('content-length')
  
  // A file is resumable if 'accept-ranges' is 'bytes' OR if we got a 206 Partial Content
  const isResumable = acceptRanges === 'bytes' || response.status === 206 || contentRange !== null

  // Determine total size
  let size = 0
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)$/)
    if (match) {
      size = Number.parseInt(match[1] as string, 10)
    }
  } else if (contentLength) {
    size = Number.parseInt(contentLength, 10)
  }

  // Determine filename
  const contentDisposition = headers.get('content-disposition')
  let filename = ''
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/)
    if (match) {
      filename = match[1] as string
    }
  }

  if (!filename) {
    try {
      filename = basename(new URL(url).pathname)
    } catch {
      filename = 'download'
    }
  }

  return {
    url,
    filename: filename || 'download',
    size,
    isResumable,
    contentType: headers.get('content-type') || 'application/octet-stream',
  }
}
