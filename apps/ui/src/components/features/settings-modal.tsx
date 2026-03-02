import { type FC, useEffect, useState } from 'react'
import { Modal, Button, Stack, Group, Text, Input, SegmentedControl } from '@mantine/core'
import { useMantineColorScheme } from '@mantine/core'
import { IconFolder, IconChevronRight, IconCheck, IconSun, IconMoon, IconDeviceDesktop } from '@tabler/icons-react'
import { useDownloadStore } from '../../store/use-download-store'

const isTauri = () => '__TAURI_INTERNALS__' in window

export const SettingsModal: FC = () => {
  const { settingsModalOpen, setSettingsModalOpen, config, saveConfig } = useDownloadStore()
  const { colorScheme, setColorScheme } = useMantineColorScheme()

  const [downloadDir, setDownloadDir] = useState('')

  useEffect(() => {
    if (settingsModalOpen) {
      setDownloadDir(config?.defaultDownloadDir ?? '')
    }
  }, [settingsModalOpen, config])

  const handleBrowse = async () => {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true, multiple: false, defaultPath: downloadDir })
    if (typeof selected === 'string') setDownloadDir(selected)
  }

  const handleSave = async () => {
    await saveConfig({ defaultDownloadDir: downloadDir })
    setSettingsModalOpen(false)
  }

  return (
    <Modal
      opened={settingsModalOpen}
      onClose={() => setSettingsModalOpen(false)}
      title={<Text fw={700}>Settings</Text>}
      centered
      size="md"
      overlayProps={{ backgroundOpacity: 0.6 }}
    >
      <Stack gap="md">
        <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase' }}>
          Download Behaviour
        </Text>

        <Input.Wrapper label="Default Download Folder">
          {isTauri() ? (
            <Input
              component="button"
              type="button"
              pointer
              onClick={handleBrowse}
              leftSection={<IconFolder size={16} />}
              rightSection={<IconChevronRight size={14} />}
              styles={{ input: { textAlign: 'left', cursor: 'pointer' } }}
            >
              <Text size="sm" truncate="end">{downloadDir}</Text>
            </Input>
          ) : (
            <Input
              value={downloadDir}
              onChange={(e) => setDownloadDir(e.currentTarget.value)}
              leftSection={<IconFolder size={16} />}
            />
          )}
        </Input.Wrapper>

        <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase' }}>
          Appearance
        </Text>

        <Input.Wrapper label="Theme">
          <SegmentedControl
            fullWidth
            value={colorScheme}
            onChange={(v) => setColorScheme(v as 'light' | 'dark' | 'auto')}
            data={[
              { value: 'light', label: <Group gap={6} justify="center"><IconSun size={14} /><span>Light</span></Group> },
              { value: 'dark', label: <Group gap={6} justify="center"><IconMoon size={14} /><span>Dark</span></Group> },
              { value: 'auto', label: <Group gap={6} justify="center"><IconDeviceDesktop size={14} /><span>System</span></Group> },
            ]}
          />
        </Input.Wrapper>

        <Group justify="flex-end" mt="md">
          <Button variant="light" color="gray" onClick={() => setSettingsModalOpen(false)}>
            Cancel
          </Button>
          <Button leftSection={<IconCheck size={16} />} onClick={handleSave}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
