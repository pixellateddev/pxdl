import type { FC } from 'react'
import { Group, Title, Text, Box } from '@mantine/core'
import { IconDownload } from '@tabler/icons-react'

export const GlobalHeader: FC = () => {
  return (
    <Box mb="md" pb="xs">
      <Group align="baseline" gap="xs">
        <IconDownload size={24} color="var(--mantine-primary-color-filled)" />
        <Title order={2} style={{ letterSpacing: '-0.04em', fontSize: '1.25rem' }}>
          Pixel Downloader
        </Title>
        <Text size="xs" fw={500} c="var(--mantine-primary-color-filled)" style={{ letterSpacing: '0.05em', opacity: 0.8 }}>
          V1.0
        </Text>
      </Group>
    </Box>
  )
}
