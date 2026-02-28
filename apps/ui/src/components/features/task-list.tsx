import type { FC } from 'react'
import { useDownloadStore } from '../../store/use-download-store'
import { ProgressBar } from '../ui/progress-bar'
import { formatBytes, formatDuration } from '@pxdl/utils'
import {
  Table,
  Text,
  Center,
  Paper,
  ActionIcon,
  Group,
  Tooltip
} from '@mantine/core'
import { modals } from '@mantine/modals'
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
  const { tasks, searchQuery, togglePause, deleteTask, setDetailedTaskId } = useDownloadStore()

  const filteredTasks = tasks.filter(task =>
    task.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.url.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (tasks.length === 0) {
    return (
      <Paper p="xl" withBorder style={{ borderStyle: 'dashed' }} bg="transparent">
        <Center style={{ flexDirection: 'column' }}>
          <IconInbox size={48} color="var(--mantine-color-dimmed)" />
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
          <IconSearchOff size={48} color="var(--mantine-color-dimmed)" />
          <Text fw={600} mt="md">No tasks match your filter.</Text>
        </Center>
      </Paper>
    )
  }

  const rows = filteredTasks.map((task) => {
    const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending
    const StatusIcon = statusCfg.icon

    return (
      <Table.Tr key={task.id} className={styles.row}>
        <Table.Td style={{ width: 40, verticalAlign: 'middle' }}>
          <StatusIcon size={16} color={statusCfg.color} style={{ display: 'block' }} />
        </Table.Td>

        <Table.Td style={{ verticalAlign: 'middle' }}>
          <Text size="sm" fw={700} truncate="end" style={{ maxWidth: 300 }}>{task.filename}</Text>
        </Table.Td>

        <Table.Td style={{ minWidth: 250, verticalAlign: 'middle' }}>
          <ProgressBar task={task} color={statusCfg.color} />
        </Table.Td>

        <Table.Td style={{ width: 100, verticalAlign: 'middle' }}>
          <Text size="xs" fw={600} ff="monospace" ta="right" c={task.status === 'downloading' ? 'var(--mantine-primary-color-filled)' : 'dimmed'} style={{ whiteSpace: 'nowrap' }}>
            {task.status === 'downloading' ? `${formatBytes(task.speed || 0)}/s` : '—'}
          </Text>
        </Table.Td>

        <Table.Td style={{ width: 100, verticalAlign: 'middle' }}>
          <Text size="xs" fw={600} ff="monospace" ta="right" c={task.status === 'downloading' ? 'yellow' : 'dimmed'} style={{ whiteSpace: 'nowrap' }}>
            {task.status === 'downloading' ? formatDuration(task.eta || 0) : '—'}
          </Text>
        </Table.Td>

        <Table.Td style={{ width: 120, verticalAlign: 'middle' }}>
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
              onClick={() => modals.openConfirmModal({
                title: 'Delete task',
                centered: true,
                children: (
                  <Text size="sm">
                    {task.status !== 'completed'
                      ? 'This will also delete the partial download file. Are you sure?'
                      : 'Remove this task from the list?'}
                  </Text>
                ),
                labels: { confirm: 'Delete', cancel: 'Cancel' },
                confirmProps: { color: 'red' },
                onConfirm: () => deleteTask(task.id),
              })}
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
