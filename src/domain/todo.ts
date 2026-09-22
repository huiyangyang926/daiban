export type Priority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  description: string
  dueDate: string | null
  priority: Priority
  categoryId: string | null
  completed: boolean
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface Category {
  id: string
  name: string
  createdAt: string
}

export interface AppData {
  version: 1
  tasks: Task[]
  categories: Category[]
}

export interface NewTaskInput {
  title: string
  description?: string
  dueDate?: string | null
  priority?: Priority
  categoryId?: string | null
}

export class TodoValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TodoValidationError'
  }
}

export class UnsupportedTodoDataVersionError extends TodoValidationError {
  constructor() {
    super('不支持的待办数据版本')
    this.name = 'UnsupportedTodoDataVersionError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const characterCount = (value: string): number => Array.from(value).length

const requireString = (value: unknown, field: string): string => {
  if (typeof value !== 'string') {
    throw new TodoValidationError(`${field}必须是文本`)
  }
  return value
}

const requireId = (value: unknown, field: string): string => {
  const id = requireString(value, field)
  if (id.trim().length === 0) {
    throw new TodoValidationError(`${field}不能为空`)
  }
  return id
}

const requireTrimmedName = (
  value: unknown,
  field: string,
  maxLength: number,
): string => {
  const name = requireString(value, field)
  if (name !== name.trim() || characterCount(name) < 1 || characterCount(name) > maxLength) {
    throw new TodoValidationError(`${field}必须去除首尾空白，且长度为 1–${maxLength} 个字符`)
  }
  return name
}

export const isValidDueDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12) return false

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day >= 1 && day <= daysInMonth[month - 1]
}

const requireDueDate = (value: unknown, field: string): string | null => {
  if (value === null) return null
  if (typeof value === 'string' && isValidDueDate(value)) return value
  throw new TodoValidationError(`${field}必须是有效的 YYYY-MM-DD 日期或 null`)
}

const requireIsoTimestamp = (value: unknown, field: string): string => {
  const timestamp = requireString(value, field)
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime()) || date.toISOString() !== timestamp) {
    throw new TodoValidationError(`${field}必须是有效的 ISO 8601 UTC 时间戳`)
  }
  return timestamp
}

const requireCategory = (value: unknown, index: number): Category => {
  if (!isRecord(value)) {
    throw new TodoValidationError(`categories[${index}]必须是对象`)
  }
  return {
    id: requireId(value.id, `categories[${index}].id`),
    name: requireTrimmedName(value.name, `categories[${index}].name`, 40),
    createdAt: requireIsoTimestamp(value.createdAt, `categories[${index}].createdAt`),
  }
}

const requireTask = (value: unknown, index: number): Task => {
  if (!isRecord(value)) {
    throw new TodoValidationError(`tasks[${index}]必须是对象`)
  }

  const description = requireString(value.description, `tasks[${index}].description`)
  if (characterCount(description) > 2000) {
    throw new TodoValidationError(`tasks[${index}].description不能超过 2000 个字符`)
  }
  const dueDate = requireDueDate(value.dueDate, `tasks[${index}].dueDate`)
  if (value.priority !== 'low' && value.priority !== 'medium' && value.priority !== 'high') {
    throw new TodoValidationError(`tasks[${index}].priority无效`)
  }
  if (value.categoryId !== null && (typeof value.categoryId !== 'string' || !value.categoryId.trim())) {
    throw new TodoValidationError(`tasks[${index}].categoryId无效`)
  }
  if (typeof value.completed !== 'boolean') {
    throw new TodoValidationError(`tasks[${index}].completed必须是布尔值`)
  }
  const completedAt = value.completedAt === null
    ? null
    : requireIsoTimestamp(value.completedAt, `tasks[${index}].completedAt`)
  if (value.completed !== (completedAt !== null)) {
    throw new TodoValidationError(`tasks[${index}]的完成状态与完成时间不一致`)
  }

  return {
    id: requireId(value.id, `tasks[${index}].id`),
    title: requireTrimmedName(value.title, `tasks[${index}].title`, 120),
    description,
    dueDate,
    priority: value.priority,
    categoryId: value.categoryId,
    completed: value.completed,
    createdAt: requireIsoTimestamp(value.createdAt, `tasks[${index}].createdAt`),
    updatedAt: requireIsoTimestamp(value.updatedAt, `tasks[${index}].updatedAt`),
    completedAt,
  }
}

export const createEmptyAppData = (): AppData => ({
  version: 1,
  tasks: [],
  categories: [],
})

export const validateAppData = (value: unknown): AppData => {
  if (!isRecord(value)) {
    throw new TodoValidationError('待办数据必须是对象')
  }
  if (typeof value.version !== 'number' || !Number.isInteger(value.version)) {
    throw new TodoValidationError('待办数据版本字段无效')
  }
  if (value.version !== 1) {
    throw new UnsupportedTodoDataVersionError()
  }
  if (!Array.isArray(value.tasks) || !Array.isArray(value.categories)) {
    throw new TodoValidationError('任务和分类必须是数组')
  }

  const categories = value.categories.map(requireCategory)
  const categoryIds = new Set<string>()
  const categoryNames = new Set<string>()
  for (const category of categories) {
    if (categoryIds.has(category.id) || categoryNames.has(category.name.toLowerCase())) {
      throw new TodoValidationError('分类 ID 或名称重复')
    }
    categoryIds.add(category.id)
    categoryNames.add(category.name.toLowerCase())
  }

  const tasks = value.tasks.map(requireTask)
  const taskIds = new Set<string>()
  for (const task of tasks) {
    if (taskIds.has(task.id)) {
      throw new TodoValidationError('任务 ID 重复')
    }
    if (task.categoryId !== null && !categoryIds.has(task.categoryId)) {
      throw new TodoValidationError(`任务 ${task.id} 引用了不存在的分类`)
    }
    taskIds.add(task.id)
  }

  return { version: 1, tasks, categories }
}

export const createCategory = (name: string, existing: readonly Category[] = []): Category => {
  const trimmedName = requireString(name, '分类名称').trim()
  requireTrimmedName(trimmedName, '分类名称', 40)
  if (existing.some((category) => category.name.toLowerCase() === trimmedName.toLowerCase())) {
    throw new TodoValidationError('分类名称已存在')
  }
  return { id: crypto.randomUUID(), name: trimmedName, createdAt: new Date().toISOString() }
}

export const createTask = (
  input: NewTaskInput,
  categories: readonly Category[] = [],
): Task => {
  const timestamp = new Date().toISOString()
  const task: Task = {
    id: crypto.randomUUID(),
    title: requireString(input.title, '任务标题').trim(),
    description: input.description ?? '',
    dueDate: input.dueDate ?? null,
    priority: input.priority ?? 'medium',
    categoryId: input.categoryId ?? null,
    completed: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  }
  return validateAppData({ version: 1, tasks: [task], categories }).tasks[0]
}
