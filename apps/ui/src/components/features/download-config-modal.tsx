import { type FC, useEffect, useState } from 'react'
import { Modal, Button, TextInput, Stack, Group, Text, Box } from '@mantine/core'
import { useDownloadStore } from '../../store/use-download-store'
import { IconFolder, IconFileText, IconCheck } from '@tabler/icons-react'
import { formatBytes } from '@pxdl/utils'

export const DownloadConfigModal: FC = () => {
  const { 
    configModalOpen, 
    setConfigModalOpen, 
    pendingDownload, 
    confirmDownload 
  } = useDownloadStore()

  const [filename, setFilename] = useState('')
  const [directory, setDirectory] = useState('')

  useEffect(() => {
    if (pendingDownload) {
      setFilename(pendingDownload.filename)
      setDirectory('') // Empty means use daemon default, or we can hardcode a common one
    }
  }, [pendingDownload])

  const handleConfirm = () => {
    confirmDownload({ filename, directory })
  }

  return (
    <Modal
      opened={configModalOpen}
      onClose={() => setConfigModalOpen(false)}
      title={<Text fw={700}>Download Configuration</Text>}
      centered
      size="md"
      overlayProps={{
        backgroundOpacity: 0.55,
        blur: 3,
      }}
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
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          leftSection={<IconFileText size={16} />}
        />

        <TextInput
          label="Download Folder"
          placeholder="Default Downloads folder"
          value={directory}
          onChange={(e) => setDirectory(e.target.value)}
          leftSection={<IconFolder size={16} />}
          description="Leave empty to use system default"
        />

        <Group justify="flex-end" mt="xl">
          <Button variant="light" color="gray" onClick={() => setConfigModalOpen(false)}>
            Cancel
          </Button>
          <Button 
            color="teal" 
            onClick={handleConfirm}
            leftSection={<IconCheck size={18} />}
          >
            Start Download
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
