import { type FC, type FormEvent } from 'react'
import { Modal, TextInput, Button, Group, Text, Stack } from '@mantine/core'
import { useDownloadStore } from '../../store/use-download-store'
import { IconLink, IconDownload } from '@tabler/icons-react'

export const AddDownloadModal: FC = () => {
  const { 
    addModalOpen, 
    setAddModalOpen, 
    newUrl, 
    setNewUrl, 
    addDownload, 
    isProbing,
    statusMessage
  } = useDownloadStore()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (newUrl) addDownload(newUrl)
  }

  return (
    <Modal
      opened={addModalOpen}
      onClose={() => setAddModalOpen(false)}
      title={<Text fw={700}>Add New Download</Text>}
      centered
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            placeholder="https://example.com/file.zip"
            label="Download URL"
            description="Enter the direct link to the file"
            leftSection={<IconLink size={16} />}
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            disabled={isProbing}
            autoFocus
          />
          
          {statusMessage && (
            <Text size="xs" c="var(--mantine-primary-color-filled)" fw={500}>
              {statusMessage}
            </Text>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="light" color="gray" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isProbing}
              leftSection={<IconDownload size={18} />}
              disabled={!newUrl}
            >
              Probe URL
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
