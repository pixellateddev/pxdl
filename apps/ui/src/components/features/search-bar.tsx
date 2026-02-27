import type { FC } from 'react'
import { useDownloadStore } from '../../store/use-download-store'
import { TextInput, ActionIcon, Box } from '@mantine/core'
import { IconSearch, IconX } from '@tabler/icons-react'

export const SearchBar: FC = () => {
  const { searchQuery, setSearchQuery, tasks } = useDownloadStore()

  if (tasks.length === 0) return null

  return (
    <Box mb="md">
      <TextInput
        placeholder="Filter tasks by name or URL..."
        leftSection={<IconSearch size={16} style={{ opacity: 0.5 }} />}
        rightSection={
          searchQuery ? (
            <ActionIcon variant="transparent" color="gray" onClick={() => setSearchQuery('')}>
              <IconX size={14} />
            </ActionIcon>
          ) : null
        }
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        variant="filled"
        size="sm"
      />
    </Box>
  )
}
