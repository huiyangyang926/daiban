// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '../App'
import { createEmptyAppData } from '../domain/todo'
import { createDefaultFilters } from '../domain/todoSelectors'
import { TODO_STORAGE_KEY } from '../storage/localStorage'
import { useTodoStore } from '../store/todoStore'

beforeEach(() => {
  window.localStorage.clear()
  useTodoStore.setState({
    data: createEmptyAppData(),
    filters: createDefaultFilters(),
    loadError: null,
    saveError: null,
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('新增任务与筛选界面', () => {
  it('显示字段错误，成功添加包含描述、日期、优先级和分类的任务', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '添加任务' }))
    expect(screen.getByText('请输入任务标题。')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('没有合适的分类？新建一个'), { target: { value: '工作' } })
    fireEvent.click(screen.getByRole('button', { name: '创建并选中' }))
    fireEvent.change(screen.getByLabelText(/标题/), { target: { value: '  写周报  ' } })
    fireEvent.change(screen.getByLabelText(/描述/), { target: { value: '整理本周进展' } })
    fireEvent.change(screen.getByLabelText('截止日期'), { target: { value: '2026-10-05' } })
    fireEvent.change(screen.getByLabelText('优先级'), { target: { value: 'high' } })
    fireEvent.click(screen.getByRole('button', { name: '添加任务' }))

    const task = useTodoStore.getState().data.tasks[0]
    expect(task).toMatchObject({
      title: '写周报',
      description: '整理本周进展',
      dueDate: '2026-10-05',
      priority: 'high',
      categoryId: useTodoStore.getState().data.categories[0].id,
    })
    expect(screen.getByRole('heading', { name: '写周报' })).toBeTruthy()
    expect((screen.getByLabelText(/标题/) as HTMLInputElement).value).toBe('')
    expect(JSON.parse(window.localStorage.getItem(TODO_STORAGE_KEY)!).tasks).toHaveLength(1)
  })

  it('分类、优先级、状态与描述关键词同时筛选，统计仍显示全部任务', () => {
    const store = useTodoStore.getState()
    const work = store.addCategory('工作')
    store.addTask({ title: '工作报告', description: '季度复盘', priority: 'high', categoryId: work.id })
    store.addTask({ title: '工作例会', description: '季度计划', priority: 'low', categoryId: work.id })
    store.addTask({ title: '个人报告', description: '季度复盘', priority: 'high' })
    render(<App />)

    fireEvent.change(screen.getByLabelText('按分类筛选'), { target: { value: `category:${work.id}` } })
    fireEvent.change(screen.getByLabelText('按优先级筛选'), { target: { value: 'high' } })
    fireEvent.change(screen.getByLabelText('搜索任务'), { target: { value: '季度' } })
    fireEvent.change(screen.getByLabelText('按状态筛选'), { target: { value: 'pending' } })

    expect(screen.getByRole('heading', { name: '工作报告' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '工作例会' })).toBeNull()
    expect(screen.queryByRole('heading', { name: '个人报告' })).toBeNull()
    expect(screen.getByText('显示 1 / 3 项')).toBeTruthy()

    fireEvent.click(screen.getByRole('checkbox', { name: '标记完成：工作报告' }))
    expect(screen.getByText('没有符合条件的任务。')).toBeTruthy()
    expect(screen.getByText('显示 0 / 3 项')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('按状态筛选'), { target: { value: 'completed' } })
    expect(screen.getByRole('heading', { name: '工作报告' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('搜索任务'), { target: { value: '报告' } })
    expect(screen.getByRole('heading', { name: '工作报告' })).toBeTruthy()
  })

  it('保存失败时保留表单输入和原有任务', () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText(/标题/), { target: { value: '不能丢失的输入' } })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    fireEvent.click(screen.getByRole('button', { name: '添加任务' }))

    expect((screen.getByLabelText(/标题/) as HTMLInputElement).value).toBe('不能丢失的输入')
    expect(useTodoStore.getState().data.tasks).toHaveLength(0)
    expect(screen.getByText('保存失败，当前修改未保存。请检查浏览器存储设置或空间。')).toBeTruthy()
  })

  it('删除任务需要确认，取消时保留任务', () => {
    useTodoStore.getState().addTask({ title: '待删除任务' })
    render(<App />)
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)

    fireEvent.click(screen.getByRole('button', { name: '删除：待删除任务' }))
    expect(screen.getByRole('heading', { name: '待删除任务' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '删除：待删除任务' }))
    expect(screen.queryByRole('heading', { name: '待删除任务' })).toBeNull()
  })
})
