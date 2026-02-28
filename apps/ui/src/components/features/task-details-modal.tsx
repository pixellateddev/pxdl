import type { FC } from 'react'
import { useState } from 'react'
import { Modal, Stack, Group, Text, Box, Tooltip, ActionIcon, TextInput } from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { useDownloadStore } from '../../store/use-download-store'
import { formatBytes, formatDuration } from '@pxdl/utils'
import { ProgressBar } from '../ui/progress-bar'
import { IconCopy, IconCheck, IconPencil, IconX, IconPlayerPause, IconPlayerPlay, IconTrash } from '@tabler/icons-react'

const splitFilename = (filename: string): { stem: string; ext: string } => {
  const dot = filename.lastIndexOf('.')
  if (dot <= 0) return { stem: filename, ext: '' }
  return { stem: filename.slice(0, dot), ext: filename.slice(dot) }
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'var(--mantine-color-gray-filled)',
  downloading: 'var(--mantine-color-green-filled)',
  paused: 'var(--mantine-color-yellow-filled)',
  completed: 'var(--mantine-primary-color-filled)',
  failed: 'var(--mantine-color-red-filled)',
}

export const TaskDetailsModal: FC = () => {
  const { tasks, detailedTaskId, setDetailedTaskId, renameTask, togglePause, deleteTask } = useDownloadStore()

  const task = tasks.find(t => t.id === detailedTaskId)
  const statusColor = task ? (STATUS_COLOR[task.status] ?? STATUS_COLOR.pending) : STATUS_COLOR.pending
  const clipboard = useClipboard({ timeout: 2000 })
  const [renaming, setRenaming] = useState(false)
  const [newFilename, setNewFilename] = useState('')

  const startRename = () => {
    const { stem } = splitFilename(task?.filename ?? '')
    setNewFilename(stem)
    setRenaming(true)
  }

  const cancelRename = () => {
    setRenaming(false)
    setNewFilename('')
  }

  const confirmRename = async () => {
    if (!task || !newFilename.trim()) {
      cancelRename()
      return
    }
    const { ext } = splitFilename(task.filename)
    const fullName = newFilename.trim() + ext
    if (fullName === task.filename) {
      cancelRename()
      return
    }
    await renameTask(task.id, fullName)
    setRenaming(false)
  }

  const handleDelete = () => {
    if (!task) return
    if (task.status === 'completed') {
      modals.openConfirmModal({
        title: 'Delete download',
        centered: true,
        children: <Text size="sm">Would you like to also delete the downloaded file from disk?</Text>,
        labels: { confirm: 'Delete file too', cancel: 'Keep file' },
        confirmProps: { color: 'red' },
        onConfirm: () => { deleteTask(task.id, true); setDetailedTaskId(null) },
        onCancel: () => { deleteTask(task.id, false); setDetailedTaskId(null) },
      })
    } else {
      modals.openConfirmModal({
        title: 'Delete download',
        centered: true,
        children: <Text size="sm">This will also delete the partial download file. Are you sure?</Text>,
        labels: { confirm: 'Delete', cancel: 'Cancel' },
        confirmProps: { color: 'red' },
        onConfirm: () => { deleteTask(task.id); setDetailedTaskId(null) },
      })
    }
  }

  return (
    <Modal
      opened={!!detailedTaskId}
      onClose={() => { setDetailedTaskId(null); cancelRename() }}
      title={
        renaming ? (
          <Group gap="xs" wrap="nowrap">
            <TextInput
              value={newFilename}
              onChange={(e) => setNewFilename(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') cancelRename() }}
              size="xs"
              style={{ width: 260 }}
              data-autofocus
            />
            <Text size="xs" c="dimmed" ff="monospace">{splitFilename(task?.filename ?? '').ext}</Text>
            <ActionIcon variant="subtle" color="green" size="sm" onClick={confirmRename}>
              <IconCheck size={14} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={cancelRename}>
              <IconX size={14} />
            </ActionIcon>
          </Group>
        ) : (
          <Group gap="xs" wrap="nowrap">
            <Text fw={700} truncate="end" style={{ maxWidth: 340 }}>{task?.filename || 'Download Details'}</Text>
            {task && (
              <>
                <Tooltip label="Rename file" openDelay={300}>
                  <ActionIcon variant="subtle" color="gray" size="sm" onClick={startRename}>
                    <IconPencil size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Delete" openDelay={300}>
                  <ActionIcon variant="subtle" color="red" size="sm" onClick={handleDelete}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              </>
            )}
          </Group>
        )
      }
      centered
      size="xl"
    >
      {task && (
        <Stack gap="md">
          <Box>
            <Text size="xs" c="dimmed" fw={800} mb={4} style={{ textTransform: 'uppercase' }}>Source URL</Text>
            <Group gap="xs" wrap="nowrap">
              <Text size="xs" ff="monospace" c="dimmed" truncate="end" style={{ flex: 1 }}>{task.url}</Text>
              <Tooltip label={clipboard.copied ? 'Copied!' : 'Copy URL'} openDelay={300}>
                <ActionIcon
                  variant="subtle"
                  color={clipboard.copied ? 'green' : 'gray'}
                  size="sm"
                  onClick={() => clipboard.copy(task.url)}
                >
                  {clipboard.copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                </ActionIcon>
              </Tooltip>
            </Group>
          </Box>

          <Box>
            <Group justify="space-between" mb={6}>
              <Text size="xs" fw={800} c="dimmed" style={{ textTransform: 'uppercase' }}>Overall Progress</Text>
              <Group gap="xs">
                <Text size="xs" ff="monospace" fw={700} c={statusColor}>
                  {(task.size > 0 ? (task.downloadedBytes / task.size) * 100 : 0).toFixed(1)}%
                </Text>
                <Text size="xs" ff="monospace" c="dimmed">{formatBytes(task.downloadedBytes)} / {formatBytes(task.size)}</Text>
              </Group>
            </Group>
            <Group gap="xs" align="center" wrap="nowrap">
              <Box style={{ flex: 1 }}>
                <ProgressBar task={task} color={statusColor} />
              </Box>
              {(task.status === 'downloading' || task.status === 'paused' || task.status === 'pending') && (
                <Tooltip label={task.status === 'paused' ? 'Resume' : 'Pause'} openDelay={300}>
                  <ActionIcon
                    variant="subtle"
                    color={task.status === 'paused' ? 'green' : 'yellow'}
                    size="md"
                    onClick={() => togglePause(task)}
                  >
                    {task.status === 'paused' ? <IconPlayerPlay size={18} /> : <IconPlayerPause size={18} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Box>

          <Group grow align="flex-start">
            <Box>
              <Text size="xs" fw={800} c="dimmed" style={{ textTransform: 'uppercase' }}>Status</Text>
              <Text size="sm" fw={600} c={statusColor} style={{ textTransform: 'capitalize' }}>{task.status}</Text>
            </Box>
            <Box>
              <Text size="xs" fw={800} c="dimmed" style={{ textTransform: 'uppercase' }}>Speed</Text>
              <Text size="sm" fw={600} ff="monospace">{task.status === 'downloading' ? `${formatBytes(task.speed || 0)}/s` : '—'}</Text>
            </Box>
            <Box>
              <Text size="xs" fw={800} c="dimmed" style={{ textTransform: 'uppercase' }}>ETA</Text>
              <Text size="sm" fw={600} ff="monospace">{task.status === 'downloading' ? formatDuration(task.eta || 0) : '—'}</Text>
            </Box>
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
                          backgroundColor: statusColor,
                          opacity: Math.max(0.1, sProgress),
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
