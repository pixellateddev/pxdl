import type { FC } from 'react'
import { Modal, Stack, Group, Text, Box, Divider, Tooltip } from '@mantine/core'
import { useDownloadStore } from '../../store/use-download-store'
import { formatBytes, formatDuration } from '@pxdl/utils'
import { ProgressBar } from '../ui/progress-bar'

export const TaskDetailsModal: FC = () => {
  const { tasks, detailedTaskId, setDetailedTaskId } = useDownloadStore()
  
  const task = tasks.find(t => t.id === detailedTaskId)

  return (
    <Modal
      opened={!!detailedTaskId}
      onClose={() => setDetailedTaskId(null)}
      title={<Text fw={700}>{task?.filename || 'Download Details'}</Text>}
      centered
      size="lg"
    >
      {task && (
        <Stack gap="md">
          <Box p="sm" bg="var(--mantine-color-default)" style={{ borderRadius: '8px', border: '1px solid var(--mantine-color-default-border)' }}>
            <Text size="xs" c="dimmed" fw={800} mb={4} style={{ textTransform: 'uppercase' }}>Source URL</Text>
            <Text size="xs" ff="monospace" c="var(--mantine-primary-color-filled)" truncate="end">{task.url}</Text>
          </Box>

          <Box>
            <Text size="xs" fw={800} c="dimmed" mb={8} style={{ textTransform: 'uppercase' }}>Overall Progress</Text>
            <ProgressBar task={task} color="var(--mantine-primary-color-filled)" />
            <Group justify="space-between" mt={4}>
              <Text size="xs" ff="monospace" fw={700}>{(task.size > 0 ? (task.downloadedBytes / task.size) * 100 : 0).toFixed(1)}%</Text>
              <Text size="xs" ff="monospace" c="dimmed">{formatBytes(task.downloadedBytes)} / {formatBytes(task.size)}</Text>
            </Group>
          </Box>

          <Divider variant="dashed" />

          <Group grow>
            <Stack gap={2}>
              <Text size="xs" fw={800} c="dimmed" style={{ textTransform: 'uppercase' }}>Status</Text>
              <Text size="sm" fw={600} c="var(--mantine-primary-color-filled)" style={{ textTransform: 'capitalize' }}>{task.status}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" fw={800} c="dimmed" style={{ textTransform: 'uppercase' }}>Speed</Text>
              <Text size="sm" fw={600} ff="monospace">{task.status === 'downloading' ? `${formatBytes(task.speed || 0)}/s` : '—'}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" fw={800} c="dimmed" style={{ textTransform: 'uppercase' }}>ETA</Text>
              <Text size="sm" fw={600} ff="monospace">{task.status === 'downloading' ? formatDuration(task.eta || 0) : '—'}</Text>
            </Stack>
          </Group>

          {task.segments && task.segments.length > 0 && (
            <Box mt="md">
              <Text size="xs" fw={800} c="dimmed" mb={12} style={{ textTransform: 'uppercase' }}>
                Segment Map ({task.segments.length} chunks)
              </Text>
              <Group gap={4} wrap="wrap">
                {task.segments.map((s, i) => {
                  const sSize = s.endByte - s.startByte + 1
                  const sProgress = s.downloadedBytes / sSize
                  
                  return (
                    <Tooltip 
                      key={s.id} 
                      label={`Chunk #${i+1}: ${(sProgress * 100).toFixed(1)}%`}
                      openDelay={300}
                    >
                      <Box 
                        w={14} 
                        h={14} 
                        style={{ 
                          borderRadius: '2px', 
                          backgroundColor: s.status === 'downloading' 
                            ? 'var(--mantine-color-green-filled)' 
                            : 'var(--mantine-primary-color-filled)',
                          // Progress as opacity (minimum 0.1 for visibility)
                          opacity: Math.max(0.1, sProgress),
                          outline: s.status === 'downloading' ? '1px solid var(--mantine-color-green-filled)' : 'none',
                          outlineOffset: '1px'
                        }} 
                      />
                    </Tooltip>
                  )
                })}
              </Group>
            </Box>
          )}
        </Stack>
      )}
    </Modal>
  )
}
