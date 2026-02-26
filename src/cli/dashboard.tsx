import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, render, useInput, useApp } from 'ink'
import { formatBytes, formatDuration } from '@/core/utils'
import type { DownloadTask } from '@/types'

const ProgressBar = ({ progress }: { progress: number }) => {
  const width = 15
  const completed = Math.floor((progress / 100) * width)
  const remaining = width - completed
  
  return (
    <Text>
      <Text color="green">{'█'.repeat(completed)}</Text>
      <Text color="gray">{'░'.repeat(remaining)}</Text>
    </Text>
  )
}

const Dashboard = () => {
  const [tasks, setTasks] = useState<DownloadTask[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { exit } = useApp()

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
    if (input === 'q') {
      exit()
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

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text bold color="cyan">pxdl Download Manager</Text>
          <Text italic color="gray"> (↑↓ to select, SPACE/P to pause/resume, X to delete, Q to exit)</Text>
        </Box>
        {error && <Text color="red">{error}</Text>}
      </Box>

      {tasks.length === 0 ? (
        <Box height={5} alignItems="center" justifyContent="center">
          <Text color="yellow">No downloads in queue.</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Box marginBottom={1} borderStyle="round" borderColor="gray" paddingX={1}>
            <Box width={3}></Box>
            <Box width={6}><Text bold>ID</Text></Box>
            <Box width={15}><Text bold>Status</Text></Box>
            <Box width={22}><Text bold>Progress</Text></Box>
            <Box width={15}><Text bold>Speed</Text></Box>
            <Box width={12}><Text bold>ETA</Text></Box>
            <Box flexGrow={1}><Text bold>Filename</Text></Box>
          </Box>
          
          {tasks.map((task, index) => {
            const isSelected = index === selectedIndex
            const progress = task.size > 0 
              ? Math.floor((task.downloadedBytes / task.size) * 100) 
              : 0

            return (
              <Box key={task.id} paddingX={1} marginBottom={0}>
                <Box width={3}>
                  {isSelected ? <Text color="cyan">❯</Text> : <Text> </Text>}
                </Box>
                {isSelected && isConfirmingDelete ? (
                   <Box flexGrow={1}>
                     <Text color="red" bold>Confirm delete file and task? (y/n)</Text>
                   </Box>
                ) : (
                  <>
                    <Box width={6}>
                      <Text color={isSelected ? 'cyan' : undefined}>{task.id}</Text>
                    </Box>
                    <Box width={15}>
                      <Text color={isSelected ? 'cyan' : (task.status === 'downloading' ? 'green' : 'white')}>
                        {task.status.toUpperCase()}
                      </Text>
                    </Box>
                    <Box width={22}>
                      <ProgressBar progress={progress} />
                      <Text color={isSelected ? 'cyan' : undefined}> {progress.toString().padStart(3)}%</Text>
                    </Box>
                    <Box width={15}>
                      <Text color={isSelected ? 'cyan' : 'blue'}>
                        {task.status === 'downloading' && task.speed ? `${formatBytes(task.speed)}/s` : '-'}
                      </Text>
                    </Box>
                    <Box width={12}>
                      <Text color={isSelected ? 'cyan' : 'yellow'}>
                        {task.status === 'downloading' && task.eta !== undefined ? formatDuration(task.eta) : '-'}
                      </Text>
                    </Box>
                    <Box flexGrow={1}>
                      <Text italic color={isSelected ? 'cyan' : 'gray'} wrap="truncate-end">
                        {task.filename}
                      </Text>
                    </Box>
                  </>
                )}
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}

export function startDashboard() {
  console.clear()
  render(<Dashboard />)
}
