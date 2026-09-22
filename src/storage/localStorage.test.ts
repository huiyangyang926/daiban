import { describe, expect, it } from 'vitest'
import { createCategory, createEmptyAppData, createTask } from '../domain/todo'
import {
  clearTodoData,
  loadTodoData,
  saveTodoData,
  TODO_STORAGE_KEY,
  TodoStorageError,
  type StorageLike,
} from './localStorage'

class MemoryStorage implements StorageLike {
  private readonly entries = new Map<string, string>()

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value)
  }

  removeItem(key: string): void {
    this.entries.delete(key)
  }
}

const expectStorageCode = (action: () => unknown, code: string): void => {
  try {
    action()
    throw new Error('预期操作失败')
  } catch (error) {
    expect(error).toBeInstanceOf(TodoStorageError)
    expect((error as TodoStorageError).code).toBe(code)
  }
}

describe('LocalStorage 工具', () => {
  it('首次读取返回空数据，但不主动写入存储', () => {
    const storage = new MemoryStorage()

    expect(loadTodoData(storage)).toEqual(createEmptyAppData())
    expect(storage.getItem(TODO_STORAGE_KEY)).toBeNull()
  })

  it('完整保存并重新读取任务与分类', () => {
    const storage = new MemoryStorage()
    const category = createCategory('工作')
    const task = createTask({ title: '写周报', categoryId: category.id }, [category])
    const data = { version: 1 as const, tasks: [task], categories: [category] }

    saveTodoData(data, storage)
    expect(loadTodoData(storage)).toEqual(data)
    clearTodoData(storage)
    expect(storage.getItem(TODO_STORAGE_KEY)).toBeNull()
  })

  it('损坏 JSON、未知版本和失效引用不会被覆盖', () => {
    const storage = new MemoryStorage()
    for (const [raw, code] of [
      ['{invalid', 'invalid-json'],
      ['{"version":2,"tasks":[],"categories":[]}', 'unsupported-version'],
      [
        JSON.stringify({
          version: 1,
          categories: [],
          tasks: [createTask({ title: '任务', categoryId: null })].map((task) => ({
            ...task,
            categoryId: 'missing',
          })),
        }),
        'invalid-data',
      ],
    ] as const) {
      storage.setItem(TODO_STORAGE_KEY, raw)
      expectStorageCode(() => loadTodoData(storage), code)
      expect(storage.getItem(TODO_STORAGE_KEY)).toBe(raw)
    }
  })

  it('写入抛错时保留原数据，不提交候选数据', () => {
    const storage = new MemoryStorage()
    const original = createEmptyAppData()
    saveTodoData(original, storage)
    const raw = storage.getItem(TODO_STORAGE_KEY)
    const failingStorage: StorageLike = {
      getItem: (key) => storage.getItem(key),
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: (key) => storage.removeItem(key),
    }
    const next = { ...original, tasks: [createTask({ title: '新任务' })] }

    expectStorageCode(() => saveTodoData(next, failingStorage), 'write-failed')
    expect(storage.getItem(TODO_STORAGE_KEY)).toBe(raw)
    expect(original.tasks).toHaveLength(0)
  })

  it('存储读取失败时返回明确错误', () => {
    const failingStorage: StorageLike = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    }

    expectStorageCode(() => loadTodoData(failingStorage), 'read-failed')
  })
})
