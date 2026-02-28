import type { FC } from 'react'
import { useDownloadStore } from '../../store/use-download-store'
import { ProgressBar } from '../ui/progress-bar'
import { TaskCard } from './task-card'
import { formatBytes, formatDuration } from '@pxdl/utils'
import { 
  Table, 
  Text, 
  Center, 
  Paper, 
  ActionIcon, 
  Group, 
  Box,
  SimpleGrid,
  Tooltip
} from '@mantine/core'
import { 
  IconSearchOff, 
  IconInbox, 
  IconPlayerPause, 
  IconPlayerPlay, 
  IconTrash,
  IconCircle,
  IconDownload,
  IconCheck,
  IconAlertCircle,
  IconInfoCircle
} from '@tabler/icons-react'
import styles from './task-list.module.css'

const STATUS_CONFIG: Record<string, { icon: any; color: string }> = {
  pending: { icon: IconCircle, color: 'var(--mantine-color-gray-filled)' },
  downloading: { icon: IconDownload, color: 'var(--mantine-color-green-filled)' },
  paused: { icon: IconPlayerPause, color: 'var(--mantine-color-yellow-filled)' },
  completed: { icon: IconCheck, color: 'var(--mantine-primary-color-filled)' },
  failed: { icon: IconAlertCircle, color: 'var(--mantine-color-red-filled)' },
}

export const TaskList: FC = () => {
  const { tasks, searchQuery, togglePause, deleteTask, viewMode, setDetailedTaskId } = useDownloadStore()

  const filteredTasks = tasks.filter(task => 
    task.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.url.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (tasks.length === 0) {
    return (
      <Paper p="xl" withBorder style={{ borderStyle: 'dashed' }} bg="transparent">
        <Center style={{ flexDirection: 'column' }}>
          <IconInbox size={48} c="dimmed" />
          <Text fw={600} mt="md">No downloads yet.</Text>
          <Text size="sm" c="dimmed">Add a URL to get started.</Text>
        </Center>
      </Paper>
    )
  }

  if (filteredTasks.length === 0) {
    return (
      <Paper p="xl" withBorder bg="transparent">
        <Center style={{ flexDirection: 'column' }}>
          <IconSearchOff size={48} c="dimmed" />
          <Text fw={600} mt="md">No tasks match your filter.</Text>
        </Center>
      </Paper>
    )
  }

  if (viewMode === 'card') {
    return (
      <SimpleGrid cols={1} gap="md">
        {filteredTasks.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}
      </SimpleGrid>
    )
  }

  const rows = filteredTasks.map((task) => {
    const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending
    const StatusIcon = statusCfg.icon

    return (
      <Table.Tr key={task.id} className={styles.row}>
        <Table.Td style={{ width: 40 }}>
          <StatusIcon size={16} color={statusCfg.color} />
        </Table.Td>
        
        <Table.Td>
          <Text size="sm" fw={700} truncate="end" style={{ maxWidth: 300 }}>{task.filename}</Text>
        </Table.Td>
        
        <Table.Td style={{ minWidth: 250 }}>
          <Box mt={4}>
            <ProgressBar task={task} color={statusCfg.color} />
          </Box>
        </Table.Td>

        <Table.Td style={{ width: 100 }}>
          <Text size="xs" fw={600} ff="monospace" ta="right" c={task.status === 'downloading' ? 'var(--mantine-primary-color-filled)' : 'dimmed'} style={{ whiteSpace: 'nowrap' }}>
            {task.status === 'downloading' ? `${formatBytes(task.speed || 0)}/s` : '—'}
          </Text>
        </Table.Td>

        <Table.Td style={{ width: 100 }}>
          <Text size="xs" fw={600} ff="monospace" ta="right" c={task.status === 'downloading' ? 'yellow' : 'dimmed'} style={{ whiteSpace: 'nowrap' }}>
            {task.status === 'downloading' ? formatDuration(task.eta || 0) : '—'}
          </Text>
        </Table.Td>

        <Table.Td style={{ width: 120 }}>
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <Tooltip label="View details" openDelay={500}>
              <ActionIcon 
                variant="subtle" 
                color="gray"
                onClick={() => setDetailedTaskId(task.id)}
                size="sm"
              >
                <IconInfoCircle size={14} />
              </ActionIcon>
            </Tooltip>

            {task.status !== 'completed' && (
              <ActionIcon 
                variant="subtle" 
                color={task.status === 'paused' ? 'var(--mantine-primary-color-filled)' : 'yellow'}
                onClick={() => togglePause(task)}
                size="sm"
              >
                {task.status === 'paused' ? <IconPlayerPlay size={14} /> : <IconPlayerPause size={14} />}
              </ActionIcon>
            )}
            <ActionIcon 
              variant="subtle" 
              color="red" 
              onClick={() => deleteTask(task.id)}
              size="sm"
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        </Table.Td>
      </Table.Tr>
    )
  })

  return (
    <Paper withBorder p={0} radius="md" bg="transparent" style={{ overflowX: 'auto' }}>
      <Table verticalSpacing="xs" horizontalSpacing="sm" highlightOnHover striped>
        <Table.Thead bg="var(--mantine-color-default)">
          <Table.Tr>
            <Table.Th style={{ width: 40 }} />
            <Table.Th><Text size="xs" fw={800} c="dimmed" style={{ textTransform: 'uppercase' }}>File</Text></Table.Th>
            <Table.Th><Text size="xs" fw={800} c="dimmed" style={{ textTransform: 'uppercase' }}>Progress</Text></Table.Th>
            <Table.Th style={{ width: 100 }}><Text size="xs" fw={800} c="dimmed" style={{ textTransform: 'uppercase' }} ta="right">Speed</Text></Table.Th>
            <Table.Th style={{ width: 100 }}><Text size="xs" fw={800} c="dimmed" style={{ textTransform: 'uppercase' }} ta="right">ETA</Text></Table.Th>
            <Table.Th style={{ width: 120 }} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
    </Paper>
  )
}
