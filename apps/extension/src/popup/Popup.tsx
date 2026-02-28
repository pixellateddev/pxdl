import { useEffect, useState } from 'react'
import { Badge, Box, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { IconDownload, IconFile, IconFolder } from '@tabler/icons-react'
import type { ProbeResult } from '@pxdl/types'
import { formatBytes } from '@pxdl/utils'
import { addDownload } from '../bridge/client'
import { DEFAULT_DOWNLOAD_DIR } from '../constants'

function splitFilename(filename: string): [stem: string, ext: string] {
  const dot = filename.lastIndexOf('.')
  if (dot <= 0) return [filename, '']
  return [filename.slice(0, dot), filename.slice(dot)]
}

export function Popup() {
  const [probe, setProbe] = useState<ProbeResult | null>(null)
  const [stem, setStem] = useState('')
  const [ext, setExt] = useState('')
  const [directory, setDirectory] = useState(DEFAULT_DOWNLOAD_DIR)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    chrome.storage.session.get('pendingDownload', (result) => {
      const data = result['pendingDownload'] as ProbeResult | undefined
      if (data) {
        setProbe(data)
        const [s, e] = splitFilename(data.filename)
        setStem(s)
        setExt(e)
      }
    })
  }, [])

  const handleDownload = async () => {
    if (!probe) return
    setLoading(true)
    setError(null)
    try {
      await addDownload({
        url: probe.url,
        filename: stem + ext,
        directory,
        size: probe.size,
        isResumable: probe.isResumable,
      })
      setDone(true)
      setTimeout(() => window.close(), 600)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setLoading(false)
    }
  }

  if (done) {
    return (
      <Box p="md" style={{ minWidth: 320 }}>
        <Text c="teal" fw={600} ta="center" size="sm">
          Added to queue
        </Text>
      </Box>
    )
  }

  if (!probe) {
    return (
      <Box p="md" style={{ minWidth: 320 }}>
        <Text c="dimmed" size="sm" ta="center">
          No pending download
        </Text>
      </Box>
    )
  }

  return (
    <Box p="md" style={{ minWidth: 320 }}>
      <Stack gap="sm">
        <Text fw={700} size="sm">
          New Download
        </Text>

        <TextInput
          label="Filename"
          size="sm"
          value={stem}
          onChange={(e) => setStem(e.target.value)}
          leftSection={<IconFile size={14} />}
          rightSection={
            ext ? (
              <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', paddingRight: 8 }}>
                {ext}
              </Text>
            ) : undefined
          }
          rightSectionWidth={ext ? Math.max(ext.length * 7 + 16, 40) : undefined}
        />

        <TextInput
          label="Save to"
          size="sm"
          value={directory}
          onChange={(e) => setDirectory(e.target.value)}
          leftSection={<IconFolder size={14} />}
        />

        <Group gap="xs" align="center">
          <Text size="xs" c="dimmed">
            Size:
          </Text>
          <Text size="xs">{probe.size > 0 ? formatBytes(probe.size) : 'Unknown'}</Text>
          {probe.isResumable && (
            <Badge size="xs" variant="light" color="teal">
              Resumable
            </Badge>
          )}
        </Group>

        {error && (
          <Text size="xs" c="red">
            {error}
          </Text>
        )}

        <Group justify="flex-end" gap="xs" mt="xs">
          <Button variant="subtle" color="gray" size="xs" onClick={() => window.close()}>
            Cancel
          </Button>
          <Button
            size="xs"
            leftSection={<IconDownload size={14} />}
            onClick={handleDownload}
            loading={loading}
            disabled={!stem}
          >
            Download
          </Button>
        </Group>
      </Stack>
    </Box>
  )
}
