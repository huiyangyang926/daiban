import { describe, expect, it } from 'vitest'
import { TodoValidationError } from '../domain/todo'
import { loadTodoData, TODO_STORAGE_KEY, TodoStorageError, type StorageLike } from '../storage/localStorage'
import { createTodoStore, selectTodoStats, selectVisibleTasks } from './todoStore'

class MemoryStorage implements StorageLike {
  private readonly entries = new Map<string, string>()
  failWrites = false

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('QuotaExceededError')
    this.entries.set(key, value)
  }

  removeItem(key: string): void {
    this.entries.delete(key)
  }
}

describe('Zustand 待办状态', () => {
  it('新增、更新、完成切换和删除均保存到 LocalStorage', () => {
    const storage = new MemoryStorage()
    const store = createTodoStore(storage)
    const category = store.getState().addCategory('工作')
    const task = store.getState().addTask({ title: '  写周报  ', categoryId: category.id })

    expect(loadTodoData(storage).tasks[0].title).toBe('写周报')
    expect(store.getState().updateTask(task.id, { description: '本周进展', priority: 'high' })?.description)
      .toBe('本周进展')
    expect(store.getState().setTaskCompleted(task.id, true)?.completedAt).not.toBeNull()
    expect(selectTodoStats(store.getState())).toEqual({
      pending: 0,
      completed: 1,
      total: 1,
      completionRate: 100,
    })
    expect(store.getState().toggleTask(task.id)?.completed).toBe(false)
    expect(loadTodoData(storage).tasks[0].completedAt).toBeNull()
    expect(store.getState().deleteTask(task.id)).toBe(true)
    expect(store.getState().deleteTask(task.id)).toBe(false)
    expect(loadTodoData(storage).tasks).toHaveLength(0)
  })

  it('搜索和三个筛选条件取交集，统计不受筛选影响', () => {
    const storage = new MemoryStorage()
    const store = createTodoStore(storage)
    const work = store.getState().addCategory('工作')
    store.getState().addTask({ title: '写报告', description: '季度总结', priority: 'high', categoryId: work.id })
    store.getState().addTask({ title: '买水果', priority: 'low' })
    const finished = store.getState().addTask({ title: '旧报告', priority: 'high', categoryId: work.id })
    store.getState().setTaskCompleted(finished.id, true)
    const saved = storage.getItem(TODO_STORAGE_KEY)

    store.getState().setFilters({ search: '季度', categoryId: work.id, priority: 'high', status: 'pending' })
    expect(selectVisibleTasks(store.getState()).map((task) => task.title)).toEqual(['写报告'])
    store.getState().setFilters({ search: '报告' })
    expect(selectVisibleTasks(store.getState()).map((task) => task.title)).toEqual(['写报告'])
    expect(selectTodoStats(store.getState())).toEqual({
      pending: 2,
      completed: 1,
      total: 3,
      completionRate: 33,
    })
    expect(storage.getItem(TODO_STORAGE_KEY)).toBe(saved)

    store.getState().setFilters({ search: '水果', categoryId: null, priority: 'all' })
    expect(selectVisibleTasks(store.getState()).map((task) => task.title)).toEqual(['买水果'])
    store.getState().resetFilters()
    expect(selectVisibleTasks(store.getState())).toHaveLength(3)
  })

  it('分类重命名保留关联；删除分类后任务转为未分类并清除对应筛选', () => {
    const storage = new MemoryStorage()
    const store = createTodoStore(storage)
    const category = store.getState().addCategory('Work')
    const task = store.getState().addTask({ title: '任务', categoryId: category.id })

    expect(store.getState().renameCategory(category.id, '  办公  ')?.name).toBe('办公')
    expect(store.getState().data.tasks[0].categoryId).toBe(category.id)
    expect(() => store.getState().addCategory('办公')).toThrow('分类名称已存在')
    store.getState().setFilters({ categoryId: category.id })
    expect(store.getState().deleteCategory(category.id)).toBe(true)
    expect(store.getState().data.tasks[0].id).toBe(task.id)
    expect(store.getState().data.tasks[0].categoryId).toBeNull()
    expect(store.getState().filters.categoryId).toBeUndefined()
    expect(loadTodoData(storage).tasks[0].categoryId).toBeNull()
  })

  it('写入失败时保留已保存的数据和筛选状态', () => {
    const storage = new MemoryStorage()
    const store = createTodoStore(storage)
    const task = store.getState().addTask({ title: '原任务' })
    store.getState().setFilters({ search: '原' })
    const saved = storage.getItem(TODO_STORAGE_KEY)
    storage.failWrites = true

    expect(() => store.getState().updateTask(task.id, { title: '新任务' })).toThrow(TodoStorageError)
    expect(store.getState().data.tasks[0].title).toBe('原任务')
    expect(store.getState().filters.search).toBe('原')
    expect(storage.getItem(TODO_STORAGE_KEY)).toBe(saved)
    expect(store.getState().saveError?.code).toBe('write-failed')
  })

  it('无效编辑在写入前被拒绝，原数据保持不变', () => {
    const storage = new MemoryStorage()
    const store = createTodoStore(storage)
    const category = store.getState().addCategory('工作')
    const task = store.getState().addTask({ title: '原任务', categoryId: category.id })
    const saved = storage.getItem(TODO_STORAGE_KEY)

    expect(() => store.getState().updateTask(task.id, { title: '   ' })).toThrow(TodoValidationError)
    expect(() => store.getState().renameCategory(category.id, '')).toThrow(TodoValidationError)
    expect(store.getState().data.tasks[0].title).toBe('原任务')
    expect(storage.getItem(TODO_STORAGE_KEY)).toBe(saved)
    expect(store.getState().saveError).toBeNull()
  })

  it('读取损坏数据时禁止修改，并支持修复后重试与确认后的清空动作', () => {
    const storage = new MemoryStorage()
    storage.setItem(TODO_STORAGE_KEY, '{bad json')
    const store = createTodoStore(storage)

    expect(store.getState().loadError?.code).toBe('invalid-json')
    expect(() => store.getState().addTask({ title: '不能写入' })).toThrow(TodoStorageError)
    expect(storage.getItem(TODO_STORAGE_KEY)).toBe('{bad json')
    expect(store.getState().retryLoad()).toBe(false)

    storage.setItem(TODO_STORAGE_KEY, JSON.stringify({ version: 1, tasks: [], categories: [] }))
    expect(store.getState().retryLoad()).toBe(true)
    expect(store.getState().loadError).toBeNull()
    store.getState().addTask({ title: '可写入' })
    store.getState().clearLocalData()
    expect(storage.getItem(TODO_STORAGE_KEY)).toBeNull()
    expect(store.getState().data.tasks).toHaveLength(0)
  })

  it('按未完成、截止日期和优先级排序', () => {
    const store = createTodoStore(new MemoryStorage())
    const later = store.getState().addTask({ title: '较晚', dueDate: '2026-10-20', priority: 'high' })
    const low = store.getState().addTask({ title: '较早低', dueDate: '2026-10-01', priority: 'low' })
    const high = store.getState().addTask({ title: '较早高', dueDate: '2026-10-01', priority: 'high' })
    const noDate = store.getState().addTask({ title: '无日期' })
    store.getState().setTaskCompleted(high.id, true)

    expect(selectVisibleTasks(store.getState()).map((task) => task.id)).toEqual([
      low.id,
      later.id,
      noDate.id,
      high.id,
    ])
  })
})
