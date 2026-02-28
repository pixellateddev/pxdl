import { type FC, useEffect } from 'react'
import { useDownloadStore } from '../../store/use-download-store'
import { GlobalHeader } from '../layout/global-header'
import { Toolbar } from '../layout/toolbar'
import { StatusBar } from '../layout/status-bar'
import { AddDownloadModal } from '../features/add-download-modal'
import { SearchBar } from '../features/search-bar'
import { TaskList } from '../features/task-list'
import { DownloadConfigModal } from '../features/download-config-modal'
import { TaskDetailsModal } from '../features/task-details-modal'
import { Container, Box } from '@mantine/core'
import type { ProbeResult } from '@pxdl/types'

export const Dashboard: FC = () => {
  const { initSSE } = useDownloadStore()

  useEffect(() => {
    return initSSE()
  }, [initSSE])

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return

    let unlisten: (() => void) | undefined

    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<ProbeResult>('download:intercept', (e) => {
        useDownloadStore.getState().openInterceptedDownload(e.payload)
      }).then((fn) => {
        unlisten = fn
      })
    })

    return () => {
      unlisten?.()
    }
  }, [])

  return (
    <Box pb={60}> {/* Space for fixed StatusBar */}
      <Container size="md" py="md">
        <GlobalHeader />
        <Toolbar />

        <Box component="main">
          <SearchBar />
          <TaskList />
        </Box>

        <AddDownloadModal />
        <DownloadConfigModal />
        <TaskDetailsModal />
      </Container>

      <StatusBar />
    </Box>
  )
}
