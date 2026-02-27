import type { FC } from 'react'
import { useDownloadStore } from '../../store/use-download-store'
import { formatBytes } from '@pxdl/utils'
import { Group, Text, Box, Divider, Badge, Tooltip } from '@mantine/core'
import { IconBolt, IconChartPie, IconHash, IconCircleFilled } from '@tabler/icons-react'

export const StatusBar: FC = () => {
  const tasks = useDownloadStore((state) => state.tasks)
  const error = useDownloadStore((state) => state.error)
  
  const activeTasks = tasks.filter(t => t.status === 'downloading')
  const totalSpeed = activeTasks.reduce((acc, t) => acc + (t.speed || 0), 0)
  const totalSize = tasks.reduce((acc, t) => acc + (t.size || 0), 0)
  const totalDownloaded = tasks.reduce((acc, t) => acc + (t.downloadedBytes || 0), 0)
  const overallProgress = totalSize > 0 ? (totalDownloaded / totalSize) * 100 : 0

  return (
    <Box 
      component="footer" 
      p="xs" 
      bg="var(--mantine-color-default)"
      style={{ 
        borderTop: '1px solid var(--mantine-color-default-border)',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100
      }}
    >
      <Group justify="space-between" px="md">
        <Group gap="lg">
          <Group gap={6}>
            <IconBolt size={14} color="var(--mantine-color-teal-filled)" />
            <Text size="xs" fw={600} ff="monospace">{formatBytes(totalSpeed)}/s</Text>
          </Group>
          
          <Divider orientation="vertical" />

          <Group gap={6}>
            <IconChartPie size={14} color="var(--mantine-color-teal-filled)" />
            <Text size="xs" fw={600} ff="monospace">{overallProgress.toFixed(1)}%</Text>
          </Group>

          <Divider orientation="vertical" />

          <Group gap={6}>
            <IconHash size={14} color="var(--mantine-color-teal-filled)" />
            <Text size="xs" fw={600} ff="monospace">{activeTasks.length} / {tasks.length} active</Text>
          </Group>
        </Group>

        <Group gap="xs">
          <Tooltip label={error ? 'Daemon connection lost' : 'Daemon connected and ready'}>
            <Badge 
              variant="light" 
              color={error ? 'red' : 'teal'}
              size="sm"
              leftSection={<IconCircleFilled size={8} />}
              px={8}
            >
              {error ? 'Offline' : 'Online'}
            </Badge>
          </Tooltip>
        </Group>
      </Group>
    </Box>
  )
}
