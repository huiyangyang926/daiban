import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import {
  createCategory,
  createEmptyAppData,
  createTask,
  TodoValidationError,
  validateAppData,
  type AppData,
  type Category,
  type NewTaskInput,
  type Task,
} from '../domain/todo'
import {
  createDefaultFilters,
  getTodoStats,
  getVisibleTasks,
  type TodoFilters,
} from '../domain/todoSelectors'
import {
  clearTodoData,
  loadTodoData,
  saveTodoData,
  TodoStorageError,
  type StorageLike,
} from '../storage/localStorage'

export type TaskChanges = Partial<
  Pick<Task, 'title' | 'description' | 'dueDate' | 'priority' | 'categoryId'>
>

export interface TodoStore {
  data: AppData
  filters: TodoFilters
  loadError: TodoStorageError | null
  saveError: TodoStorageError | null
  addTask(input: NewTaskInput): Task
  updateTask(id: string, changes: TaskChanges): Task | null
  deleteTask(id: string): boolean
  setTaskCompleted(id: string, completed: boolean): Task | null
  toggleTask(id: string): Task | null
  addCategory(name: string): Category
  renameCategory(id: string, name: string): Category | null
  deleteCategory(id: string): boolean
  setFilters(changes: Partial<TodoFilters>): void
  resetFilters(): void
  retryLoad(): boolean
  // 调用方必须先取得用户对清空本地数据的明确确认。
  clearLocalData(): void
}

const readInitialData = (storage?: StorageLike): Pick<TodoStore, 'data' | 'loadError'> => {
  try {
    return { data: loadTodoData(storage), loadError: null }
  } catch (error) {
    if (!(error instanceof TodoStorageError)) throw error
    return { data: createEmptyAppData(), loadError: error }
  }
}

const validateFilters = (filters: TodoFilters, data: AppData): void => {
  if (typeof filters.search !== 'string') throw new TodoValidationError('搜索词必须是文本')
  if (
    filters.priority !== 'all' &&
    filters.priority !== 'low' &&
    filters.priority !== 'medium' &&
    filters.priority !== 'high'
  ) {
    throw new TodoValidationError('优先级筛选条件无效')
  }
  if (filters.status !== 'all' && filters.status !== 'pending' && filters.status !== 'completed') {
    throw new TodoValidationError('完成状态筛选条件无效')
  }
  if (
    filters.categoryId !== undefined &&
    filters.categoryId !== null &&
    !data.categories.some((category) => category.id === filters.categoryId)
  ) {
    throw new TodoValidationError('分类筛选条件无效')
  }
}

export const createTodoStore = (storage?: StorageLike) => {
  const initial = readInitialData(storage)

  return create<TodoStore>()((set, get) => {
    const ensureLoaded = (): void => {
      const { loadError } = get()
      if (loadError) throw loadError
    }

    const commit = (data: AppData, filters?: TodoFilters): void => {
      ensureLoaded()
      const validatedData = validateAppData(data)
      try {
        saveTodoData(validatedData, storage)
      } catch (error) {
        if (error instanceof TodoStorageError) set({ saveError: error })
        throw error
      }
      set({ data: validatedData, filters: filters ?? get().filters, saveError: null })
    }

    return {
      ...initial,
      filters: createDefaultFilters(),
      saveError: null,

      addTask: (input) => {
        ensureLoaded()
        const { data } = get()
        const task = createTask(input, data.categories)
        commit({ ...data, tasks: [...data.tasks, task] })
        return task
      },

      updateTask: (id, changes) => {
        ensureLoaded()
        const { data } = get()
        const task = data.tasks.find((item) => item.id === id)
        if (!task) return null
        const updated: Task = {
          ...task,
          ...changes,
          title: changes.title === undefined ? task.title : changes.title.trim(),
          updatedAt: new Date().toISOString(),
        }
        commit({ ...data, tasks: data.tasks.map((item) => (item.id === id ? updated : item)) })
        return updated
      },

      deleteTask: (id) => {
        ensureLoaded()
        const { data } = get()
        if (!data.tasks.some((task) => task.id === id)) return false
        commit({ ...data, tasks: data.tasks.filter((task) => task.id !== id) })
        return true
      },

      setTaskCompleted: (id, completed) => {
        ensureLoaded()
        const { data } = get()
        const task = data.tasks.find((item) => item.id === id)
        if (!task) return null
        if (task.completed === completed) return task
        const timestamp = new Date().toISOString()
        const updated: Task = {
          ...task,
          completed,
          completedAt: completed ? timestamp : null,
          updatedAt: timestamp,
        }
        commit({ ...data, tasks: data.tasks.map((item) => (item.id === id ? updated : item)) })
        return updated
      },

      toggleTask: (id) => {
        const task = get().data.tasks.find((item) => item.id === id)
        return task ? get().setTaskCompleted(id, !task.completed) : null
      },

      addCategory: (name) => {
        ensureLoaded()
        const { data } = get()
        const category = createCategory(name, data.categories)
        commit({ ...data, categories: [...data.categories, category] })
        return category
      },

      renameCategory: (id, name) => {
        ensureLoaded()
        const { data } = get()
        const category = data.categories.find((item) => item.id === id)
        if (!category) return null
        const renamed = { ...category, name: name.trim() }
        commit({
          ...data,
          categories: data.categories.map((item) => (item.id === id ? renamed : item)),
        })
        return renamed
      },

      deleteCategory: (id) => {
        ensureLoaded()
        const { data, filters } = get()
        if (!data.categories.some((category) => category.id === id)) return false
        const timestamp = new Date().toISOString()
        const nextData: AppData = {
          ...data,
          categories: data.categories.filter((category) => category.id !== id),
          tasks: data.tasks.map((task) =>
            task.categoryId === id ? { ...task, categoryId: null, updatedAt: timestamp } : task,
          ),
        }
        const nextFilters = filters.categoryId === id
          ? { ...filters, categoryId: undefined }
          : filters
        commit(nextData, nextFilters)
        return true
      },

      setFilters: (changes) => {
        const nextFilters = { ...get().filters, ...changes }
        validateFilters(nextFilters, get().data)
        set({ filters: nextFilters })
      },

      resetFilters: () => set({ filters: createDefaultFilters() }),

      retryLoad: () => {
        try {
          const data = loadTodoData(storage)
          const currentFilters = get().filters
          const filters = data.categories.some((category) => category.id === currentFilters.categoryId)
            || currentFilters.categoryId === null
            || currentFilters.categoryId === undefined
            ? currentFilters
            : { ...currentFilters, categoryId: undefined }
          set({ data, filters, loadError: null, saveError: null })
          return true
        } catch (error) {
          if (!(error instanceof TodoStorageError)) throw error
          set({ loadError: error })
          return false
        }
      },

      clearLocalData: () => {
        try {
          clearTodoData(storage)
        } catch (error) {
          if (error instanceof TodoStorageError) set({ saveError: error })
          throw error
        }
        set({
          data: createEmptyAppData(),
          filters: createDefaultFilters(),
          loadError: null,
          saveError: null,
        })
      },
    }
  })
}

export const useTodoStore = createTodoStore()

export const selectVisibleTasks = (state: TodoStore): Task[] =>
  getVisibleTasks(state.data.tasks, state.filters)

export const selectTodoStats = (state: TodoStore) => getTodoStats(state.data.tasks)

// useShallow 保持相同结果的引用稳定，供 React 组件直接订阅。
export const useVisibleTasks = () => useTodoStore(useShallow(selectVisibleTasks))
export const useTodoStats = () => useTodoStore(useShallow(selectTodoStats))
