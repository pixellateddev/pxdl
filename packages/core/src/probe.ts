import { basename } from 'node:path'
import type { ProbeResult } from '@pxdl/types'

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export const probeUrl = async (url: string, extraHeaders?: Record<string, string>): Promise<ProbeResult> => {
  const baseHeaders: Record<string, string> = {
    'Accept-Encoding': 'identity',
    'User-Agent': USER_AGENT,
    ...extraHeaders,
  }

  const response = await fetch(url, {
    method: 'HEAD',
    headers: baseHeaders,
  })

  // Some servers don't support HEAD or return 405/403, fall back to a Range GET
  if (!response.ok) {
    const getResponse = await fetch(url, {
      headers: {
        ...baseHeaders,
        Range: 'bytes=0-0',
      },
    })

    if (!getResponse.ok) {
      throw new Error(`Failed to probe URL: ${getResponse.statusText} (${getResponse.status})`)
    }

    return parseResponse(url, getResponse, extraHeaders)
  }

  return parseResponse(url, response, extraHeaders)
}

const parseResponse = (url: string, response: Response, extraHeaders?: Record<string, string>): ProbeResult => {
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
    // RFC 5987 encoded filename takes priority: filename*=UTF-8''encoded-value
    const rfc5987Match = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/i)
    if (rfc5987Match) {
      try {
        filename = decodeURIComponent(rfc5987Match[1] as string)
      } catch {
        filename = rfc5987Match[1] as string
      }
    } else {
      // Fall back to plain filename= (quoted or unquoted)
      const match = contentDisposition.match(/filename="([^"]+)"|filename=([^;\s]+)/)
      if (match) {
        filename = (match[1] ?? match[2]) as string
      }
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
    ...(extraHeaders && Object.keys(extraHeaders).length > 0 ? { headers: extraHeaders } : {}),
  }
}
