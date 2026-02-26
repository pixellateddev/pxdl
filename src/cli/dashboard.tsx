import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, render, useInput, useApp, useStdout } from 'ink'
import { formatBytes, formatDuration } from '@/core/utils'
import { probeUrl } from '@/core/probe'
import type { DownloadTask, NewDownload, SegmentTask } from '@/types'

const ProgressBar = ({ progress, width, color = "green" }: { progress: number; width: number; color?: string }) => {
  const completed = Math.floor((progress / 100) * width)
  const remaining = Math.max(0, width - completed)
  
  return (
    <Text>
      <Text color={color} bold>{'━'.repeat(completed)}</Text>
      <Text color="gray" dimColor>{'─'.repeat(remaining)}</Text>
    </Text>
  )
}

const STATUS_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  pending: { icon: '○', color: 'gray', label: 'Pending' },
  downloading: { icon: '↓', color: 'green', label: 'Downloading' },
  paused: { icon: '⏸', color: 'yellow', label: 'Paused' },
  completed: { icon: '✓', color: 'blue', label: 'Completed' },
  failed: { icon: '×', color: 'red', label: 'Failed' },
}

const Dashboard = () => {
  const [tasks, setTasks] = useState<DownloadTask[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isConfirmingFileDelete, setIsConfirmingFileDelete] = useState(false)
  const [isConfirmingDuplicate, setIsConfirmingDuplicate] = useState(false)
  const [duplicateTask, setDuplicateTask] = useState<NewDownload | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [detailedTaskId, setDetailedTaskId] = useState<number | null>(null)
  const [newUrl, setNewUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  
  const { exit } = useApp()
  const { stdout } = useStdout()
  const [columns, setColumns] = useState(stdout?.columns || 80)

  useEffect(() => {
    if (!stdout) return
    const onResize = () => setColumns(stdout.columns)
    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
    }
  }, [stdout])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8000/status')
      if (res.ok) {
        const data = (await res.json()) as DownloadTask[]
        setTasks(data)
        if (selectedIndex >= data.length && data.length > 0) {
          setSelectedIndex(data.length - 1)
        }
      }
    } catch (err) {
      setError('Could not connect to daemon')
    }
  }, [selectedIndex])

  useEffect(() => {
    const timer = setInterval(fetchStatus, 1000)
    fetchStatus()
    return () => clearInterval(timer)
  }, [fetchStatus])

  const handleDelete = async (id: number, deleteFile: boolean) => {
    try {
      await fetch(`http://localhost:8000/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, deleteFile })
      })
      setTasks(prev => prev.filter(t => t.id !== id))
      if (detailedTaskId === id) setDetailedTaskId(null)
      setIsConfirmingDelete(false)
      setIsConfirmingFileDelete(false)
      setStatusMessage(null)
      fetchStatus()
    } catch (err) {
      setError('Delete failed')
    }
  }

  const handleAddDownload = async (data: NewDownload, force = false) => {
    try {
      const res = await fetch('http://localhost:8000/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, force })
      })

      if (res.status === 409) {
        setDuplicateTask(data)
        setIsConfirmingDuplicate(true)
        setStatusMessage(null)
        return
      }

      if (res.ok) {
        setStatusMessage(`Added ${data.filename}`)
        setNewUrl(''); setIsAdding(false); fetchStatus()
        setTimeout(() => setStatusMessage(null), 2000)
      } else {
        setError('Failed to add to daemon')
      }
    } catch (err) {
      setError('Connection failed')
    }
  }

  useInput(async (input, key) => {
    const activeTask = detailedTaskId !== null 
      ? tasks.find(t => t.id === detailedTaskId) 
      : tasks[selectedIndex]

    if (isAdding) {
      if (key.escape) { setIsAdding(false); setNewUrl(''); return }
      if (key.return && newUrl) {
        try {
          setStatusMessage('Probing URL...')
          const probe = await probeUrl(newUrl)
          await handleAddDownload({ 
            url: probe.url, 
            filename: probe.filename, 
            size: probe.size, 
            isResumable: probe.isResumable,
            directory: '' // Use daemon default
          })
        } catch (err: any) { 
          setError(`Probe failed: ${err.message}`) 
          setStatusMessage(null)
          setTimeout(() => setError(null), 3000)
        }
        return
      }
      if (key.backspace || key.delete) { setNewUrl(prev => prev.slice(0, -1)); return }
      if (!key.ctrl && !key.meta && input) { setNewUrl(prev => prev + input) }
      return
    }

    if (isConfirmingDuplicate && duplicateTask) {
      if (input.toLowerCase() === 'y') {
        await handleAddDownload(duplicateTask, true)
      }
      setIsConfirmingDuplicate(false)
      setDuplicateTask(null)
      return
    }

    if (isConfirmingDelete || isConfirmingFileDelete) {
      if (input.toLowerCase() === 'y') {
        if (activeTask) {
          if (activeTask.status === 'completed' && !isConfirmingFileDelete) {
            setIsConfirmingDelete(false)
            setIsConfirmingFileDelete(true)
            return
          }
          await handleDelete(activeTask.id, isConfirmingFileDelete)
        }
      } else if (input.toLowerCase() === 'n') {
        if (isConfirmingFileDelete && activeTask) {
          await handleDelete(activeTask.id, false)
        } else {
          setIsConfirmingDelete(false)
          setIsConfirmingFileDelete(false)
        }
      } else {
        setIsConfirmingDelete(false)
        setIsConfirmingFileDelete(false)
      }
      return
    }

    if (input === 'q') exit()
    if (input === 'n') { setIsAdding(true); setError(null); setStatusMessage(null); return }

    if (!activeTask) return

    if (detailedTaskId !== null) {
      if (key.escape || key.return) { setDetailedTaskId(null); return }
    } else {
      if (key.upArrow) setSelectedIndex(prev => Math.max(0, prev - 1))
      if (key.downArrow) setSelectedIndex(prev => Math.min(tasks.length - 1, prev + 1))
      if (key.return) { setDetailedTaskId(activeTask.id); return }
    }

    if (input === 'p' || input === ' ') {
      try {
        const endpoint = activeTask.status === 'paused' ? '/resume' : '/pause'
        await fetch(`http://localhost:8000${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: activeTask.id })
        })
        fetchStatus()
      } catch (err) { setError('Action failed') }
    }

    if (key.delete || key.backspace || input === 'x') {
      setIsConfirmingDelete(true)
    }
  })

  // Render helpers
  const renderTask = (task: DownloadTask, isSelected: boolean) => {
    const progress = task.size > 0 ? Math.floor((task.downloadedBytes / task.size) * 100) : 0
    const statusCfg = STATUS_ICONS[task.status] || STATUS_ICONS['pending']!
    const indicatorWidth = 3; const statusIconWidth = 2; const progressPercentWidth = 6; const gap = 1
    const showStats = columns > 100; const sizeWidth = 16; const speedWidth = 12; const etaWidth = 8
    const fixedTotal = indicatorWidth + statusIconWidth + progressPercentWidth + (showStats ? (sizeWidth + speedWidth + etaWidth) : sizeWidth) + (gap * 6)
    const leftover = columns - fixedTotal - 4
    const filenameWidth = Math.max(30, Math.floor(leftover * 0.5))
    const barWidth = Math.max(5, leftover - filenameWidth)

    if (isSelected && (isConfirmingDelete || isConfirmingFileDelete)) {
      return (
        <Box paddingX={1} marginBottom={0} key={task.id}>
          <Box width={indicatorWidth}><Text color="cyan">❯</Text></Box>
          <Box flexGrow={1}>
            {isConfirmingFileDelete ? (
              <Text color="red" bold>Download complete. Also delete file from disk? (y/n)</Text>
            ) : (
              <Text color="red" bold>Confirm delete task {task.status !== 'completed' ? 'and partial file' : ''}? (y/n)</Text>
            )}
          </Box>
        </Box>
      )
    }

    return (
      <Box key={task.id} paddingX={1} marginBottom={0}>
        <Box width={indicatorWidth} flexShrink={0}>{isSelected ? <Text color="cyan">❯</Text> : <Text> </Text>}</Box>
        <Box width={filenameWidth} paddingRight={2} flexShrink={0}><Text color={isSelected ? 'cyan' : 'white'} wrap="truncate-end">{task.filename}</Text></Box>
        <Box width={statusIconWidth} flexShrink={0} marginRight={gap}><Text color={isSelected ? 'cyan' : statusCfg.color}>{statusCfg.icon}</Text></Box>
        <Box width={barWidth + progressPercentWidth + gap} flexShrink={1} marginRight={gap}><ProgressBar progress={progress} width={barWidth} /><Text color={isSelected ? 'cyan' : undefined}> {progress.toString().padStart(3)}%</Text></Box>
        <Box width={sizeWidth} flexShrink={0} marginRight={gap}><Text color={isSelected ? 'cyan' : 'white'}>{formatBytes(task.downloadedBytes)}/{formatBytes(task.size)}</Text></Box>
        {showStats && (
          <>
            <Box width={speedWidth} flexShrink={0} marginRight={gap}><Text color={isSelected ? 'cyan' : 'blue'}>{task.status === 'downloading' && task.speed ? `${formatBytes(task.speed)}/s` : '-'}</Text></Box>
            <Box width={etaWidth} flexShrink={0}><Text color={isSelected ? 'cyan' : 'yellow'}>{task.status === 'downloading' && task.eta !== undefined ? formatDuration(task.eta) : '-'}</Text></Box>
          </>
        )}
      </Box>
    )
  }

  if (detailedTaskId !== null) {
    const task = tasks.find(t => t.id === detailedTaskId)
    if (!task) return null
    const isConfirming = isConfirmingDelete || isConfirmingFileDelete

    return (
      <Box flexDirection="column" padding={1} height="100%">
        <Box marginBottom={1} borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column">
          {isConfirming ? (
             <Box paddingY={1}>
                {isConfirmingFileDelete ? (
                  <Text color="red" bold>Download complete. Also delete file from disk? (y/n)</Text>
                ) : (
                  <Text color="red" bold>Confirm delete task {task.status !== 'completed' ? 'and partial file' : ''}? (y/n)</Text>
                )}
             </Box>
          ) : (
            <>
              <Box justifyContent="space-between"><Text bold color="cyan">{task.filename}</Text><Text color={STATUS_ICONS[task.status]?.color}>{task.status.toUpperCase()}</Text></Box>
              <Box marginTop={1}>
                <Box marginRight={4}><Text bold>Progress: </Text><Text>{formatBytes(task.downloadedBytes)} / {formatBytes(task.size)}</Text></Box>
                <Box marginRight={4}><Text bold>Speed: </Text><Text color="blue">{task.status === 'downloading' ? `${formatBytes(task.speed || 0)}/s` : '-'}</Text></Box>
                <Box><Text bold>ETA: </Text><Text color="yellow">{task.status === 'downloading' ? formatDuration(task.eta || 0) : '-'}</Text></Box>
              </Box>
              <Box marginTop={1}><Text dimColor>URL: {task.url}</Text></Box>
            </>
          )}
        </Box>

        <Box flexDirection="column" marginBottom={1} flexGrow={1}>
          <Text bold color="white" marginBottom={1}>Segments ({task.segments?.length || 0})</Text>
          {task.segments?.map((s, idx) => {
            const progress = Math.floor((s.downloadedBytes / (s.endByte - s.startByte + 1)) * 100)
            const statusCfg = STATUS_ICONS[s.status] || STATUS_ICONS['pending']!
            return (
              <Box key={s.id} marginBottom={0} paddingX={1}>
                <Box width={4}><Text color="gray">#{idx + 1}</Text></Box>
                <Box width={4}><Text color={statusCfg.color}>{statusCfg.icon}</Text></Box>
                <Box width={35}><ProgressBar progress={progress} width={25} color={statusCfg.color} /><Text> {progress.toString().padStart(3)}%</Text></Box>
                <Box width={15}><Text color="blue">{s.status === 'downloading' && s.speed ? `${formatBytes(s.speed)}/s` : '-'}</Text></Box>
              </Box>
            )
          })}
        </Box>
        <Text dimColor color="white"> (SPACE pause/resume, X delete, ESC return)</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" padding={1} height="100%">
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text bold color="cyan">pxdl</Text>
          <Text dimColor color="white"> (N new, ENTER detail, SPACE pause, X delete, Q exit)</Text>
        </Box>
        <Box>{statusMessage && <Text color="green">{statusMessage} </Text>}{error && <Text color="red">{error}</Text>}</Box>
      </Box>

      {isAdding && (
        <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1} flexDirection="column">
          <Text bold color="cyan">Add New Download</Text>
          {isConfirmingDuplicate ? (
            <Text color="yellow" bold>URL already in queue. Add anyway? (y/n)</Text>
          ) : (
            <Box><Text>URL: </Text><Text>{newUrl}</Text><Text color="cyan">█</Text></Box>
          )}
          <Text dimColor color="white">(Press ESC cancel, ENTER add)</Text>
        </Box>
      )}

      {tasks.length === 0 && !isAdding ? (
        <Box height={5} alignItems="center" justifyContent="center"><Text color="yellow">No downloads in queue.</Text></Box>
      ) : (
        <Box flexDirection="column" marginTop={1} flexGrow={1}>
          {tasks.map((task, index) => renderTask(task, index === selectedIndex && !isAdding))}
        </Box>
      )}

      <Box marginTop={1} borderStyle="classic" borderColor="gray" paddingX={1}>
        {Object.entries(STATUS_ICONS).map(([key, cfg]) => (
          <Box key={key} marginRight={3}><Text color={cfg.color}>{cfg.icon}</Text><Text color="white"> {cfg.label}</Text></Box>
        ))}
      </Box>
    </Box>
  )
}

export function startDashboard() {
  console.clear()
  render(<Dashboard />)
}
