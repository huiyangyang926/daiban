import type { Priority, Task } from './todo'

export type CompletionFilter = 'all' | 'pending' | 'completed'

export interface TodoFilters {
  search: string
  // undefined = 全部，null = 未分类，其余值 = 分类 ID。
  categoryId: string | null | undefined
  priority: Priority | 'all'
  status: CompletionFilter
}

export interface TodoStats {
  pending: number
  completed: number
  total: number
  completionRate: number
}

export const createDefaultFilters = (): TodoFilters => ({
  search: '',
  categoryId: undefined,
  priority: 'all',
  status: 'all',
})

const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

const compareTasks = (left: Task, right: Task): number => {
  if (left.completed !== right.completed) return left.completed ? 1 : -1
  if (left.dueDate === null && right.dueDate !== null) return 1
  if (left.dueDate !== null && right.dueDate === null) return -1
  if (left.dueDate !== right.dueDate) return left.dueDate! < right.dueDate! ? -1 : 1

  const priorityDifference = priorityRank[left.priority] - priorityRank[right.priority]
  if (priorityDifference !== 0) return priorityDifference
  if (left.createdAt !== right.createdAt) return left.createdAt > right.createdAt ? -1 : 1
  return left.id.localeCompare(right.id)
}

export const getVisibleTasks = (tasks: readonly Task[], filters: TodoFilters): Task[] => {
  const query = filters.search.trim().toLowerCase()
  return tasks
    .filter((task) => {
      if (
        query &&
        !task.title.toLowerCase().includes(query) &&
        !task.description.toLowerCase().includes(query)
      ) return false
      if (filters.categoryId !== undefined && task.categoryId !== filters.categoryId) return false
      if (filters.priority !== 'all' && task.priority !== filters.priority) return false
      if (filters.status === 'pending' && task.completed) return false
      if (filters.status === 'completed' && !task.completed) return false
      return true
    })
    .sort(compareTasks)
}

export const getTodoStats = (tasks: readonly Task[]): TodoStats => {
  const total = tasks.length
  const completed = tasks.filter((task) => task.completed).length
  return {
    pending: total - completed,
    completed,
    total,
    completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
}
