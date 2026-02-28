import type { FC } from 'react'
import { useDownloadStore } from '../../store/use-download-store'
import { Group, Paper, Tooltip, ActionIcon, Divider } from '@mantine/core'
import {
  IconPlus,
  IconPlayerPause,
  IconPlayerPlay,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react'

export const Toolbar: FC = () => {
  const { setAddModalOpen, pauseAll, resumeAll, clearCompleted } = useDownloadStore()

  return (
    <Paper p="xs" withBorder mb="lg" bg="var(--mantine-color-default)">
      <Group justify="space-between">
        <Group gap="sm">
          <Tooltip label="New Download" openDelay={500}>
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => setAddModalOpen(true)}
            >
              <IconPlus size={22} />
            </ActionIcon>
          </Tooltip>

          <Divider orientation="vertical" mx={4} />

          <Tooltip label="Pause All" openDelay={500}>
            <ActionIcon variant="subtle" color="yellow" size="lg" onClick={pauseAll}>
              <IconPlayerPause size={22} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Resume All" openDelay={500}>
            <ActionIcon variant="subtle" color="green" size="lg" onClick={resumeAll}>
              <IconPlayerPlay size={22} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Clear Completed" openDelay={500}>
            <ActionIcon variant="subtle" color="red" size="lg" onClick={clearCompleted}>
              <IconTrash size={22} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Tooltip label="Settings" openDelay={500}>
          <ActionIcon variant="subtle" color="gray" size="lg">
            <IconSettings size={22} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Paper>
  )
}
