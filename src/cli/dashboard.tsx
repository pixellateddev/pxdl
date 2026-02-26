import React, { useState, useEffect } from 'react'
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
  const { exit } = useApp()

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('http://localhost:8000/status')
        if (res.ok) {
          setTasks(await res.json())
        }
      } catch (err) {
        // Silently fail if daemon is down
      }
    }

    const timer = setInterval(fetchStatus, 1000)
    fetchStatus()
    return () => clearInterval(timer)
  }, [])

  useInput((input) => {
    if (input === 'q') {
      exit()
    }
  })

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">pxdl Download Manager</Text>
        <Text italic color="gray"> (Press 'q' to exit)</Text>
      </Box>

      {tasks.length === 0 ? (
        <Text color="yellow">No downloads in queue.</Text>
      ) : (
        <Box flexDirection="column">
          <Box marginBottom={1} borderStyle="round" borderColor="gray" paddingX={1}>
            <Box width={6}><Text bold>ID</Text></Box>
            <Box width={15}><Text bold>Status</Text></Box>
            <Box width={25}><Text bold>Progress</Text></Box>
            <Box width={15}><Text bold>Speed</Text></Box>
            <Box width={12}><Text bold>ETA</Text></Box>
            <Box><Text bold>Filename</Text></Box>
          </Box>
          
          {tasks.map((task) => {
            const progress = task.size > 0 
              ? Math.floor((task.downloadedBytes / task.size) * 100) 
              : 0

            return (
              <Box key={task.id} paddingX={1} marginBottom={1}>
                <Box width={6}>
                  <Text>{task.id}</Text>
                </Box>
                <Box width={15}>
                  <Text color={task.status === 'downloading' ? 'green' : 'white'}>
                    {task.status.toUpperCase()}
                  </Text>
                </Box>
                <Box width={25}>
                  <ProgressBar progress={progress} />
                  <Text> {progress.toString().padStart(3)}%</Text>
                </Box>
                <Box width={15}>
                  <Text color="blue">
                    {task.status === 'downloading' && task.speed ? `${formatBytes(task.speed)}/s` : '-'}
                  </Text>
                </Box>
                <Box width={12}>
                  <Text color="yellow">
                    {task.status === 'downloading' && task.eta !== undefined ? formatDuration(task.eta) : '-'}
                  </Text>
                </Box>
                <Box>
                  <Text italic color="gray" wrap="truncate-end">
                    {task.filename}
                  </Text>
                </Box>
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}

export function startDashboard() {
  render(<Dashboard />)
}
