import { type FC, type FormEvent, useState } from 'react'
import { Modal, TextInput, Button, Group, Text, Stack } from '@mantine/core'
import { useDownloadStore } from '../../store/use-download-store'
import { IconLink, IconDownload } from '@tabler/icons-react'

const isValidUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

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

  const [touched, setTouched] = useState(false)

  const urlError = touched && newUrl && !isValidUrl(newUrl) ? 'Please enter a valid http/https URL' : null

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (newUrl && isValidUrl(newUrl)) addDownload(newUrl)
  }

  const handleClose = () => {
    setAddModalOpen(false)
    setTouched(false)
  }

  return (
    <Modal
      opened={addModalOpen}
      onClose={handleClose}
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
            onChange={(e) => { setNewUrl(e.target.value); setTouched(false) }}
            onBlur={() => { if (newUrl) setTouched(true) }}
            error={urlError}
            disabled={isProbing}
            data-autofocus
          />

          {statusMessage && (
            <Text size="xs" c="var(--mantine-primary-color-filled)" fw={500}>
              {statusMessage}
            </Text>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="light" color="gray" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isProbing}
              leftSection={<IconDownload size={18} />}
              disabled={!newUrl || !!urlError}
            >
              Probe URL
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
