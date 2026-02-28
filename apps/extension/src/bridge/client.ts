import { HOST_NAME } from '../constants'
import type { ProbeResult } from '@pxdl/types'

type BridgeResponse<T> = { success: true; data: T } | { success: false; error: string }

export const probeUrl = (url: string): Promise<ProbeResult> =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(
      HOST_NAME,
      { type: 'PROBE', url },
      (res: BridgeResponse<ProbeResult>) => {
        if (chrome.runtime.lastError)
          return reject(new Error(chrome.runtime.lastError.message))
        if (!res.success) return reject(new Error(res.error))
        resolve(res.data)
      },
    )
  })

export const addDownload = (payload: {
  url: string
  filename: string
  directory: string
  size: number
  isResumable: boolean
}): Promise<void> =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(
      HOST_NAME,
      { type: 'ADD', payload },
      (res: BridgeResponse<unknown>) => {
        if (chrome.runtime.lastError)
          return reject(new Error(chrome.runtime.lastError.message))
        if (!res.success) return reject(new Error(res.error))
        resolve()
      },
    )
  })
