import { interceptDownload } from '../bridge/client'

chrome.downloads.onCreated.addListener(async (item) => {
  // Cancel and remove the native download immediately
  chrome.downloads.cancel(item.id)
  chrome.downloads.erase({ id: item.id })

  try {
    await interceptDownload(item.url)
  } catch {
    chrome.action.setBadgeText({ text: '!' })
    chrome.action.setBadgeBackgroundColor({ color: '#e03131' })
  }
})
