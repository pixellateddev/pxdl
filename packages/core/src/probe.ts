import { basename } from 'node:path'
import type { ProbeResult } from '@pxdl/types'

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export const probeUrl = async (url: string): Promise<ProbeResult> => {
  const response = await fetch(url, {
    method: 'HEAD',
    headers: {
      'Accept-Encoding': 'identity',
      'User-Agent': USER_AGENT,
    },
  })

  // Some servers don't support HEAD or return 405/403, fall back to a Range GET
  if (!response.ok) {
    const getResponse = await fetch(url, {
      headers: {
        Range: 'bytes=0-0',
        'Accept-Encoding': 'identity',
        'User-Agent': USER_AGENT,
      },
    })

    if (!getResponse.ok) {
      throw new Error(`Failed to probe URL: ${getResponse.statusText} (${getResponse.status})`)
    }

    return parseResponse(url, getResponse)
  }

  return parseResponse(url, response)
}

const parseResponse = (url: string, response: Response): ProbeResult => {
  const headers = response.headers
  const acceptRanges = headers.get('accept-ranges')
  const contentRange = headers.get('content-range')
  const contentLength = headers.get('content-length')

  const isResumable = acceptRanges === 'bytes' || response.status === 206 || contentRange !== null

  let size = 0
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)$/)
    if (match) {
      size = Number.parseInt(match[1] as string, 10)
    }
  } else if (contentLength) {
    size = Number.parseInt(contentLength, 10)
  }

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
      // Use response.url to get the final filename after redirects
      const finalUrl = response.url || url
      filename = basename(new URL(finalUrl).pathname)
    } catch {
      filename = 'download'
    }
  }

  return {
    url: response.url || url,
    filename: filename || 'download',
    size,
    isResumable,
    contentType: headers.get('content-type') || 'application/octet-stream',
  }
}
