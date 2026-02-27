import type { FC } from 'react'
import { useDownloadStore } from '../../store/use-download-store'
import { Group, Paper, Tooltip, ActionIcon, SegmentedControl, Center, Divider } from '@mantine/core'
import { 
  IconPlus, 
  IconPlayerPause, 
  IconPlayerPlay, 
  IconSettings, 
  IconLayoutList, 
  IconLayoutGrid,
  IconTrash,
  IconX
} from '@tabler/icons-react'

export const Toolbar: FC = () => {
  const { addModalOpen, setAddModalOpen, viewMode, setViewMode } = useDownloadStore()

  return (
    <Paper p="xs" withBorder mb="lg" bg="var(--mantine-color-default)">
      <Group justify="space-between">
        <Group gap="sm">
          <Tooltip label="New Download" openDelay={500}>
            <ActionIcon 
              variant="subtle"
              color="teal"
              size="lg"
              onClick={() => setAddModalOpen(true)}
            >
              <IconPlus size={22} />
            </ActionIcon>
          </Tooltip>

          <Divider orientation="vertical" mx={4} />
          
          <Tooltip label="Pause All" openDelay={500}>
            <ActionIcon variant="subtle" color="gray" size="lg">
              <IconPlayerPause size={22} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Resume All" openDelay={500}>
            <ActionIcon variant="subtle" color="gray" size="lg">
              <IconPlayerPlay size={22} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Clear Completed" openDelay={500}>
            <ActionIcon variant="subtle" color="gray" size="lg">
              <IconTrash size={22} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Group gap="lg">
          <SegmentedControl
            size="sm"
            variant="default"
            value={viewMode}
            onChange={(value) => setViewMode(value as 'table' | 'card')}
            data={[
              {
                value: 'table',
                label: (
                  <Center>
                    <IconLayoutList size={18} />
                  </Center>
                ),
              },
              {
                value: 'card',
                label: (
                  <Center>
                    <IconLayoutGrid size={18} />
                  </Center>
                ),
              },
            ]}
          />

          <Tooltip label="Settings" openDelay={500}>
            <ActionIcon variant="subtle" color="gray" size="lg">
              <IconSettings size={22} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  )
}
