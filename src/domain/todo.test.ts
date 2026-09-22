import { describe, expect, it } from 'vitest'
import {
  createCategory,
  createEmptyAppData,
  createTask,
  isValidDueDate,
  TodoValidationError,
  UnsupportedTodoDataVersionError,
  validateAppData,
} from './todo'

describe('Todo 数据模型', () => {
  it('为新任务设置默认值并规范化标题', () => {
    const task = createTask({ title: '  准备周报  ' })

    expect(task.title).toBe('准备周报')
    expect(task.description).toBe('')
    expect(task.dueDate).toBeNull()
    expect(task.priority).toBe('medium')
    expect(task.categoryId).toBeNull()
    expect(task.completed).toBe(false)
    expect(task.completedAt).toBeNull()
    expect(task.id).toBeTruthy()
  })

  it('校验真实日历日期和字段长度', () => {
    expect(isValidDueDate('2024-02-29')).toBe(true)
    expect(isValidDueDate('2025-02-29')).toBe(false)
    expect(isValidDueDate('2026-13-01')).toBe(false)
    expect(() => createTask({ title: '   ' })).toThrow(TodoValidationError)
    expect(() => createTask({ title: 'x'.repeat(121) })).toThrow(TodoValidationError)
    expect(() => createTask({ title: '任务', description: 'x'.repeat(2001) })).toThrow(
      TodoValidationError,
    )
    expect(() => createTask({ title: '任务', dueDate: '2025-02-29' })).toThrow(
      TodoValidationError,
    )
  })

  it('分类名忽略首尾空白，并拒绝大小写不同的重复名称', () => {
    const category = createCategory('  Work  ')

    expect(category.name).toBe('Work')
    expect(() => createCategory('work', [category])).toThrow('分类名称已存在')
    expect(() => createCategory('  ')).toThrow(TodoValidationError)
    expect(createTask({ title: '任务', categoryId: category.id }, [category]).categoryId).toBe(
      category.id,
    )
    expect(() => createTask({ title: '任务', categoryId: 'missing' }, [category])).toThrow(
      TodoValidationError,
    )
  })

  it('拒绝未知版本、重复 ID 和失效的分类引用', () => {
    expect(() => validateAppData({ version: 2, tasks: [], categories: [] })).toThrow(
      UnsupportedTodoDataVersionError,
    )

    const category = createCategory('工作')
    const task = createTask({ title: '任务', categoryId: category.id }, [category])
    expect(() =>
      validateAppData({ version: 1, categories: [category], tasks: [task, task] }),
    ).toThrow('任务 ID 重复')
    expect(() => validateAppData({ version: 1, categories: [], tasks: [task] })).toThrow(
      '引用了不存在的分类',
    )
    expect(validateAppData(createEmptyAppData())).toEqual(createEmptyAppData())
  })
})
