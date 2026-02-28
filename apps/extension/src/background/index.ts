import { probeUrl } from '../bridge/client'

chrome.downloads.onCreated.addListener(async (item) => {
  // Cancel and remove the native download immediately
  chrome.downloads.cancel(item.id)
  chrome.downloads.erase({ id: item.id })

  try {
    const probe = await probeUrl(item.url)
    await chrome.storage.session.set({ pendingDownload: probe })
    await chrome.action.openPopup()
  } catch {
    chrome.action.setBadgeText({ text: '!' })
    chrome.action.setBadgeBackgroundColor({ color: '#e03131' })
  }
})
