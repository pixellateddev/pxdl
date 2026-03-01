import { type FC, useEffect, useState } from 'react'
import { Modal, Button, TextInput, Stack, Group, Text, Box, Input } from '@mantine/core'
import { useDownloadStore } from '../../store/use-download-store'
import { IconFolder, IconFileText, IconCheck, IconChevronRight } from '@tabler/icons-react'
import { formatBytes } from '@pxdl/utils'

const isTauri = () => '__TAURI_INTERNALS__' in window

const splitExt = (name: string) => {
  const dot = name.lastIndexOf('.')
  return dot > 0
    ? { base: name.slice(0, dot), ext: name.slice(dot) }
    : { base: name, ext: '' }
}

const decodeFilename = (name: string) => {
  try { return decodeURIComponent(name) } catch { return name }
}

const validateBasename = (name: string) => {
  if (!name.trim()) return 'Filename cannot be empty'
  if (/[/\\:*?"<>|]/.test(name)) return 'Filename contains invalid characters: / \\ : * ? " < > |'
  return null
}

export const DownloadConfigModal: FC = () => {
  const {
    downloadModalOpen,
    setDownloadModalOpen,
    pendingDownload,
    confirmDownload,
    config,
  } = useDownloadStore()

  const [basename, setBasename] = useState('')
  const [ext, setExt] = useState('')
  const [directory, setDirectory] = useState('')

  useEffect(() => {
    if (pendingDownload) {
      const { base, ext } = splitExt(decodeFilename(pendingDownload.filename))
      setBasename(base)
      setExt(ext)
      setDirectory(config?.defaultDownloadDir ?? '')
    }
  }, [pendingDownload, config])

  const handleBrowse = async () => {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true, multiple: false, defaultPath: directory })
    if (typeof selected === 'string') setDirectory(selected)
  }

  const filenameError = validateBasename(basename)

  const handleConfirm = () => {
    if (filenameError) return
    confirmDownload({ filename: basename + ext, directory })
  }

  return (
    <Modal
      opened={downloadModalOpen}
      onClose={() => setDownloadModalOpen(false)}
      title={<Text fw={700}>Download Configuration</Text>}
      centered
      size="md"
      overlayProps={{ backgroundOpacity: 0.6 }}
    >
      <Stack gap="md">
        <Box p="sm" bg="var(--mantine-color-default)" style={{ borderRadius: '8px', border: '1px solid var(--mantine-color-default-border)' }}>
          <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase' }} mb={4}>
            Source URL
          </Text>
          <Text size="sm" truncate="end" fw={500}>{pendingDownload?.url}</Text>
          <Group mt="xs" gap="lg">
            <Text size="xs" c="dimmed">Size: <Text span fw={600}>{formatBytes(pendingDownload?.size || 0)}</Text></Text>
            <Text size="xs" c="dimmed">Resumable: <Text span c={pendingDownload?.isResumable ? "green" : "red"} fw={600}>{pendingDownload?.isResumable ? "Yes" : "No"}</Text></Text>
          </Group>
        </Box>

        <TextInput
          label="File Name"
          placeholder="Enter filename..."
          value={basename}
          onChange={(e) => setBasename(e.target.value)}
          leftSection={<IconFileText size={16} />}
          error={filenameError}
          rightSection={
            ext ? (
              <Text size="sm" c="dimmed" ff="monospace" pr={4}>{ext}</Text>
            ) : undefined
          }
          rightSectionWidth={ext ? ext.length * 9 + 16 : undefined}
        />

        {isTauri() ? (
          <Input.Wrapper label="Download Folder">
            <Input
              component="button"
              type="button"
              pointer
              onClick={handleBrowse}
              leftSection={<IconFolder size={16} />}
              rightSection={<IconChevronRight size={14} />}
              styles={{ input: { textAlign: 'left', cursor: 'pointer' } }}
            >
              <Text size="sm" truncate="end">{directory}</Text>
            </Input>
          </Input.Wrapper>
        ) : (
          <TextInput
            label="Download Folder"
            value={directory}
            onChange={(e) => setDirectory(e.target.value)}
            leftSection={<IconFolder size={16} />}
          />
        )}

        <Group justify="flex-end" mt="xl">
          <Button variant="light" color="gray" onClick={() => setDownloadModalOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            leftSection={<IconCheck size={18} />}
            disabled={!!filenameError}
          >
            Start Download
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
