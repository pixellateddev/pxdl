import type { FC } from 'react'
import { useDownloadStore } from '../../store/use-download-store'
import { TaskCard } from './task-card'
import styles from './task-list.module.css'

export const TaskList: FC = () => {
  const { tasks, searchQuery } = useDownloadStore()

  const filteredTasks = tasks.filter(task => 
    task.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.url.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (tasks.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No downloads yet.</p>
        <small>Add a URL to get started.</small>
      </div>
    )
  }

  if (filteredTasks.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No tasks match your filter.</p>
      </div>
    )
  }

  return (
    <div className={styles.taskList}>
      {filteredTasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  )
}
