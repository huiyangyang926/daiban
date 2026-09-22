import { useState } from 'react'
import { useTodoStats, useTodoStore, useVisibleTasks } from '../store/todoStore'

const priorityLabel = { low: '低优先级', medium: '中优先级', high: '高优先级' } as const

export function TodoList() {
  const tasks = useVisibleTasks()
  const categories = useTodoStore((state) => state.data.categories)
  const toggleTask = useTodoStore((state) => state.toggleTask)
  const deleteTask = useTodoStore((state) => state.deleteTask)
  const resetFilters = useTodoStore((state) => state.resetFilters)
  const { total } = useTodoStats()
  const [actionError, setActionError] = useState<string | null>(null)
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]))

  return (
    <section className="panel list-panel" aria-labelledby="list-heading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">当前任务</span>
          <h2 id="list-heading">待办清单</h2>
        </div>
      </div>

      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      {tasks.length === 0 ? (
        <div className="empty-state">
          {total === 0 ? (
            <p>还没有任务。从上方添加第一项待办吧。</p>
          ) : (
            <>
              <p>没有符合条件的任务。</p>
              <button className="text-button" type="button" onClick={resetFilters}>清除筛选</button>
            </>
          )}
        </div>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li className={`task-card${task.completed ? ' is-complete' : ''}`} key={task.id}>
              <div className="task-main">
                <input
                  className="task-check"
                  type="checkbox"
                  checked={task.completed}
                  aria-label={`${task.completed ? '恢复待办' : '标记完成'}：${task.title}`}
                  onChange={() => {
                    try {
                      toggleTask(task.id)
                      setActionError(null)
                    } catch {
                      setActionError('更新完成状态失败，当前修改未保存。')
                    }
                  }}
                />
                <div className="task-content">
                  <h3>{task.title}</h3>
                  {task.description && <p>{task.description}</p>}
                  <div className="task-meta">
                    <span className={`priority priority-${task.priority}`}>{priorityLabel[task.priority]}</span>
                    <span>{task.categoryId ? categoryNames.get(task.categoryId) : '未分类'}</span>
                    {task.dueDate && <span>截止 {task.dueDate}</span>}
                  </div>
                </div>
              </div>
              <button
                className="delete-button"
                type="button"
                aria-label={`删除：${task.title}`}
                onClick={() => {
                  if (!window.confirm(`确定删除“${task.title}”吗？`)) return
                  try {
                    deleteTask(task.id)
                    setActionError(null)
                  } catch {
                    setActionError('删除失败，任务仍保留。')
                  }
                }}
              >删除</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
