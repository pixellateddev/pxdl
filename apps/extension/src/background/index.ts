import { interceptDownload } from '../bridge/client'

// Headers we want to forward to the daemon for authenticated downloads
const FORWARDED_HEADERS = ['cookie', 'authorization', 'referer', 'origin', 'x-requested-with']

// Capture request headers before the download fires, keyed by URL
const pendingHeaders = new Map<string, Record<string, string>>()

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (details.requestHeaders) {
      const captured: Record<string, string> = {}
      for (const h of details.requestHeaders) {
        if (FORWARDED_HEADERS.includes(h.name.toLowerCase())) {
          captured[h.name] = h.value ?? ''
        }
      }
      if (Object.keys(captured).length > 0) {
        pendingHeaders.set(details.url, captured)
      }
    }
  },
  { urls: ['<all_urls>'], types: ['xmlhttprequest', 'other'] },
  ['requestHeaders']
)

chrome.downloads.onCreated.addListener(async (item) => {
  // Cancel and remove the native download immediately
  chrome.downloads.cancel(item.id)
  chrome.downloads.erase({ id: item.id })

  const headers = pendingHeaders.get(item.url) ?? {}
  pendingHeaders.delete(item.url)

  try {
    await interceptDownload(item.url, headers)
  } catch {
    chrome.action.setBadgeText({ text: '!' })
    chrome.action.setBadgeBackgroundColor({ color: '#e03131' })
  }
})
