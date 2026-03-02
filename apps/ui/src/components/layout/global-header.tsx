import type { FC } from 'react'
import { Group, Title, Box } from '@mantine/core'
import { IconDownload } from '@tabler/icons-react'

export const GlobalHeader: FC = () => {
  return (
    <Box mb="md" pb="xs">
      <Group align="baseline" gap="xs">
        <IconDownload size={24} color="var(--mantine-primary-color-filled)" />
        <Title order={2} fw={600} style={{ letterSpacing: '0.01em', fontSize: '1.25rem' }}>
          Pixel Downloader
        </Title>
      </Group>
    </Box>
  )
}
