import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, render, useInput, useApp, useStdout } from 'ink'
import { formatBytes, formatDuration } from '@/core/utils'
import { probeUrl } from '@/core/probe'
import type { DownloadTask, NewDownload } from '@/types'

const ProgressBar = ({ progress, width }: { progress: number; width: number }) => {
  const completed = Math.floor((progress / 100) * width)
  const remaining = Math.max(0, width - completed)
  
  return (
    <Text>
      <Text color="green" bold>{'━'.repeat(completed)}</Text>
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
  const [isAdding, setIsAdding] = useState(false)
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

  useInput(async (input, key) => {
    if (isAdding) {
      if (key.escape) {
        setIsAdding(false)
        setNewUrl('')
        return
      }

      if (key.return) {
        if (newUrl) {
          try {
            setStatusMessage('Probing URL...')
            const probe = await probeUrl(newUrl)
            
            const res = await fetch('http://localhost:8000/add', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: probe.url,
                filename: probe.filename,
                size: probe.size
              } as NewDownload)
            })

            if (res.ok) {
              setStatusMessage(`Added ${probe.filename}`)
              setNewUrl('')
              setIsAdding(false)
              fetchStatus()
            } else {
              setError('Failed to add to daemon')
            }
          } catch (err: any) {
            setError(`Probe failed: ${err.message}`)
          }
        }
        return
      }

      if (key.backspace || key.delete) {
        setNewUrl(prev => prev.slice(0, -1))
        return
      }

      if (!key.ctrl && !key.meta && input) {
        setNewUrl(prev => prev + input)
      }
      return
    }

    if (input === 'q') {
      exit()
    }

    if (input === 'n') {
      setIsAdding(true)
      setError(null)
      setStatusMessage(null)
      return
    }

    if (tasks.length === 0) return

    if (isConfirmingDelete) {
      if (input.toLowerCase() === 'y') {
        const selectedTask = tasks[selectedIndex]
        if (selectedTask) {
          try {
            await fetch(`http://localhost:8000/delete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: selectedTask.id })
            })
            setTasks(prev => prev.filter(t => t.id !== selectedTask.id))
            setSelectedIndex(prev => Math.max(0, prev - 1))
          } catch (err) {
            setError('Delete failed')
          }
        }
      }
      setIsConfirmingDelete(false)
      return
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1))
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(tasks.length - 1, prev + 1))
    }

    const selectedTask = tasks[selectedIndex]
    if (!selectedTask) return

    if (input === 'p' || input === ' ') {
      try {
        const endpoint = selectedTask.status === 'paused' ? '/resume' : '/pause'
        await fetch(`http://localhost:8000${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedTask.id })
        })
        await fetchStatus()
      } catch (err) {
        setError('Action failed')
      }
    }

    if (key.delete || key.backspace || input === 'x') {
      setIsConfirmingDelete(true)
    }
  })

  // Fixed narrow widths
  const indicatorWidth = 3
  const statusIconWidth = 2
  const progressPercentWidth = 6
  const gap = 1
  
  // Hiding logic
  const showStats = columns > 100
  const sizeWidth = 16
  const speedWidth = 12
  const etaWidth = 8

  // Calculate widths to prioritize Filename
  // Total of other elements (excluding filename and progressBar)
  const fixedTotal = indicatorWidth + statusIconWidth + progressPercentWidth + (showStats ? (sizeWidth + speedWidth + etaWidth) : sizeWidth) + (gap * 6)
  const leftover = columns - fixedTotal - 4
  
  // filename gets 50% of leftover space or at least 30 chars
  const filenameWidth = Math.max(30, Math.floor(leftover * 0.5))
  // progressBar gets the rest
  const barWidth = Math.max(5, leftover - filenameWidth)

  return (
    <Box flexDirection="column" padding={1} height="100%">
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text bold color="cyan">pxdl</Text>
          <Text dimColor color="white"> (N new, SPACE pause/resume, X delete, Q exit)</Text>
        </Box>
        <Box>
          {statusMessage && <Text color="green">{statusMessage} </Text>}
          {error && <Text color="red">{error}</Text>}
        </Box>
      </Box>

      {isAdding && (
        <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1} flexDirection="column">
          <Text bold color="cyan">Add New Download</Text>
          <Box>
            <Text>URL: </Text>
            <Text>{newUrl}</Text>
            <Text color="cyan">█</Text>
          </Box>
          <Text dimColor color="white">(Press ESC to cancel, ENTER to add)</Text>
        </Box>
      )}

      {tasks.length === 0 && !isAdding ? (
        <Box height={5} alignItems="center" justifyContent="center">
          <Text color="yellow">No downloads in queue.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1} flexGrow={1}>
          {tasks.map((task, index) => {
            const isSelected = index === selectedIndex && !isAdding
            const progress = task.size > 0 
              ? Math.floor((task.downloadedBytes / task.size) * 100) 
              : 0
            const statusCfg = STATUS_ICONS[task.status] || STATUS_ICONS.pending

            return (
              <Box key={task.id} paddingX={1} marginBottom={0}>
                <Box width={indicatorWidth} flexShrink={0}>
                  {isSelected ? <Text color="cyan">❯</Text> : <Text> </Text>}
                </Box>
                {isSelected && isConfirmingDelete ? (
                   <Box flexGrow={1}>
                     <Text color="red" bold>Confirm delete file and task? (y/n)</Text>
                   </Box>
                ) : (
                  <>
                    <Box width={filenameWidth} paddingRight={2} flexShrink={0}>
                      <Text color={isSelected ? 'cyan' : 'white'} wrap="truncate-end">
                        {task.filename}
                      </Text>
                    </Box>
                    <Box width={statusIconWidth} flexShrink={0} marginRight={gap}>
                      <Text color={isSelected ? 'cyan' : statusCfg.color}>
                        {statusCfg.icon}
                      </Text>
                    </Box>
                    <Box width={barWidth + progressPercentWidth + gap} flexShrink={1} marginRight={gap}>
                      <ProgressBar progress={progress} width={barWidth} />
                      <Text color={isSelected ? 'cyan' : undefined}> {progress.toString().padStart(3)}%</Text>
                    </Box>
                    <Box width={sizeWidth} flexShrink={0} marginRight={gap}>
                      <Text color={isSelected ? 'cyan' : 'white'} wrap="truncate-end">
                         {formatBytes(task.downloadedBytes)}/{formatBytes(task.size)}
                      </Text>
                    </Box>
                    {showStats && (
                      <>
                        <Box width={speedWidth} flexShrink={0} marginRight={gap}>
                          <Text color={isSelected ? 'cyan' : 'blue'}>
                            {task.status === 'downloading' && task.speed ? `${formatBytes(task.speed)}/s` : '-'}
                          </Text>
                        </Box>
                        <Box width={etaWidth} flexShrink={0}>
                          <Text color={isSelected ? 'cyan' : 'yellow'}>
                            {task.status === 'downloading' && task.eta !== undefined ? formatDuration(task.eta) : '-'}
                          </Text>
                        </Box>
                      </>
                    )}
                  </>
                )}
              </Box>
            )
          })}
        </Box>
      )}

      <Box marginTop={1} borderStyle="classic" borderColor="gray" paddingX={1} dimColor>
        {Object.entries(STATUS_ICONS).map(([key, cfg], idx) => (
          <Box key={key} marginRight={3}>
            <Text color={cfg.color}>{cfg.icon}</Text>
            <Text color="white"> {cfg.label}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export function startDashboard() {
  console.clear()
  render(<Dashboard />)
}
