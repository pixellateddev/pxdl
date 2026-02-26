import { Box, render, Text, useApp, useInput } from 'ink'
import React, { useEffect, useState } from 'react'
import { formatBytes } from '@/core/utils'
import type { DownloadTask } from '@/types'

const ProgressBar = ({ progress }: { progress: number }) => {
  const width = 20
  const completed = Math.floor((progress / 100) * width)
  const remaining = width - completed

  return (
    <Text>
      <Text color='green'>{'█'.repeat(completed)}</Text>
      <Text color='gray'>{'░'.repeat(remaining)}</Text>
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
    <Box flexDirection='column' padding={1}>
      <Box marginBottom={1}>
        <Text bold color='cyan'>
          pxdl Download Manager
        </Text>
        <Text italic color='gray'>
          {' '}
          (Press 'q' to exit)
        </Text>
      </Box>

      {tasks.length === 0 ? (
        <Text color='yellow'>No downloads in queue.</Text>
      ) : (
        <Box flexDirection='column'>
          <Box marginBottom={1}>
            <Text bold width={4}>
              ID
            </Text>
            <Text bold width={15}>
              Status
            </Text>
            <Text bold width={25}>
              Progress
            </Text>
            <Text bold>Filename</Text>
          </Box>

          {tasks.map((task) => {
            const progress =
              task.size > 0 ? Math.floor((task.downloadedBytes / task.size) * 100) : 0

            return (
              <Box key={task.id}>
                <Text width={4}>{task.id}</Text>
                <Text width={15} color={task.status === 'downloading' ? 'green' : 'white'}>
                  {task.status.toUpperCase()}
                </Text>
                <Box width={25}>
                  <ProgressBar progress={progress} />
                  <Text> {progress}%</Text>
                </Box>
                <Text italic color='gray'>
                  {task.filename} ({formatBytes(task.downloadedBytes)} / {formatBytes(task.size)})
                </Text>
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
