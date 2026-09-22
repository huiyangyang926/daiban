import {
  createEmptyAppData,
  TodoValidationError,
  UnsupportedTodoDataVersionError,
  validateAppData,
  type AppData,
} from '../domain/todo'

export const TODO_STORAGE_KEY = 'advanced-todo-app-data'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type TodoStorageErrorCode =
  | 'unavailable'
  | 'read-failed'
  | 'invalid-json'
  | 'invalid-data'
  | 'unsupported-version'
  | 'write-failed'
  | 'clear-failed'

export class TodoStorageError extends Error {
  readonly code: TodoStorageErrorCode

  constructor(code: TodoStorageErrorCode, message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'TodoStorageError'
    this.code = code
  }
}

const getStorage = (storage?: StorageLike): StorageLike => {
  if (storage) return storage
  try {
    return window.localStorage
  } catch (cause) {
    throw new TodoStorageError('unavailable', '无法访问浏览器本地存储', cause)
  }
}

export const loadTodoData = (storage?: StorageLike): AppData => {
  let raw: string | null
  try {
    raw = getStorage(storage).getItem(TODO_STORAGE_KEY)
  } catch (cause) {
    if (cause instanceof TodoStorageError) throw cause
    throw new TodoStorageError('read-failed', '读取待办数据失败', cause)
  }
  if (raw === null) return createEmptyAppData()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (cause) {
    throw new TodoStorageError('invalid-json', '本地待办数据不是有效的 JSON', cause)
  }

  try {
    return validateAppData(parsed)
  } catch (cause) {
    if (cause instanceof UnsupportedTodoDataVersionError) {
      throw new TodoStorageError('unsupported-version', '本地待办数据版本不受支持', cause)
    }
    throw new TodoStorageError('invalid-data', '本地待办数据格式无效', cause)
  }
}

export const saveTodoData = (data: AppData, storage?: StorageLike): void => {
  let serialized: string
  try {
    serialized = JSON.stringify(validateAppData(data))
  } catch (cause) {
    if (cause instanceof UnsupportedTodoDataVersionError) {
      throw new TodoStorageError('unsupported-version', '待保存的数据版本不受支持', cause)
    }
    if (cause instanceof TodoValidationError) {
      throw new TodoStorageError('invalid-data', '待保存的数据格式无效', cause)
    }
    throw new TodoStorageError('write-failed', '序列化待办数据失败', cause)
  }

  try {
    getStorage(storage).setItem(TODO_STORAGE_KEY, serialized)
  } catch (cause) {
    if (cause instanceof TodoStorageError) throw cause
    throw new TodoStorageError('write-failed', '保存待办数据失败', cause)
  }
}

// 界面必须在用户明确确认清空后才能调用此函数。
export const clearTodoData = (storage?: StorageLike): void => {
  try {
    getStorage(storage).removeItem(TODO_STORAGE_KEY)
  } catch (cause) {
    if (cause instanceof TodoStorageError) throw cause
    throw new TodoStorageError('clear-failed', '清空本地待办数据失败', cause)
  }
}
