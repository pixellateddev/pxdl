import { type FC } from 'react'
import type { DownloadTask } from '@pxdl/types'
import { formatBytes } from '@pxdl/utils'
import { useDownloadStore } from '../../store/use-download-store'
import { ProgressBar } from '../ui/progress-bar'
import { 
  Group, 
  Text, 
  ActionIcon, 
  Stack, 
  Box, 
  Tooltip, 
  Paper
} from '@mantine/core'
import { 
  IconPlayerPause, 
  IconPlayerPlay, 
  IconTrash, 
  IconCheck, 
  IconDownload, 
  IconCircle, 
  IconAlertCircle,
  IconInfoCircle
} from '@tabler/icons-react'
import styles from './task-card.module.css'

const STATUS_CONFIG: Record<string, { icon: any; color: string }> = {
  pending: { icon: IconCircle, color: 'gray' },
  downloading: { icon: IconDownload, color: 'green' },
  paused: { icon: IconPlayerPause, color: 'yellow' },
  completed: { icon: IconCheck, color: 'teal' },
  failed: { icon: IconAlertCircle, color: 'red' },
}

interface TaskCardProps {
  task: DownloadTask
}

export const TaskCard: FC<TaskCardProps> = ({ task }) => {
  const { togglePause, deleteTask, setDetailedTaskId } = useDownloadStore()
  
  const progress = task.size > 0 ? (task.downloadedBytes / task.size) * 100 : 0
  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending
  const StatusIcon = statusCfg.icon

  return (
    <Paper 
      withBorder 
      p="sm" 
      radius="md" 
      className={styles.card}
    >
      <div 
        className={styles.statusLine} 
        style={{ backgroundColor: `var(--mantine-color-${statusCfg.color}-filled)` }} 
      />
      
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
            <StatusIcon size={16} color={`var(--mantine-color-${statusCfg.color}-filled)`} />
            <Text size="sm" fw={700} truncate="end">{task.filename}</Text>
          </Group>

          <Group gap={4} wrap="nowrap">
            <Tooltip label="View details" openDelay={500}>
              <ActionIcon 
                variant="subtle" 
                color="gray"
                onClick={() => setDetailedTaskId(task.id)}
                size="sm"
              >
                <IconInfoCircle size={16} />
              </ActionIcon>
            </Tooltip>

            {task.status !== 'completed' && (
              <ActionIcon 
                variant="subtle" 
                color={task.status === 'paused' ? 'teal' : 'yellow'}
                onClick={() => togglePause(task)}
                size="sm"
              >
                {task.status === 'paused' ? <IconPlayerPlay size={16} /> : <IconPlayerPause size={16} />}
              </ActionIcon>
            )}
            <ActionIcon 
              variant="subtle" 
              color="red" 
              onClick={() => deleteTask(task.id)}
              size="sm"
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Group>

        <Box>
          <ProgressBar task={task} color={`var(--mantine-color-${statusCfg.color}-filled)`} />
          <Group justify="space-between" mt={4}>
            <Text size="xs" ff="monospace" fw={700}>{progress.toFixed(1)}%</Text>
            <Text size="xs" c="dimmed" ff="monospace">
              {task.status === 'downloading' ? `${formatBytes(task.speed || 0)}/s` : task.status}
            </Text>
          </Group>
        </Box>
      </Stack>
    </Paper>
  )
}
