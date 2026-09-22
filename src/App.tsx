import { useState } from 'react'
import { AddTodo } from './components/AddTodo'
import { TodoFilters } from './components/TodoFilters'
import { TodoList } from './components/TodoList'
import { useTodoStats, useTodoStore } from './store/todoStore'
import './App.css'

function App() {
  const { pending, completed, total, completionRate } = useTodoStats()
  const loadError = useTodoStore((state) => state.loadError)
  const saveError = useTodoStore((state) => state.saveError)
  const retryLoad = useTodoStore((state) => state.retryLoad)
  const clearLocalData = useTodoStore((state) => state.clearLocalData)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">✓</div>
        <div>
          <span className="eyebrow">轻松安排每一天</span>
          <h1>进阶待办事项</h1>
          <p>记录重要任务，专注眼前的下一步。</p>
        </div>
      </header>

      {loadError ? (
        <section className="panel recovery-panel" aria-labelledby="recovery-heading">
          <h2 id="recovery-heading">无法读取本地任务</h2>
          <p role="alert">{loadError.message}。原有数据未被覆盖。</p>
          {recoveryError && <p className="form-error" role="alert">{recoveryError}</p>}
          <div className="recovery-actions">
            <button className="primary-button" type="button" onClick={() => { setRecoveryError(null); retryLoad() }}>重试读取</button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                if (!window.confirm('清空此网站保存的全部待办数据？此操作无法撤销。')) return
                try {
                  clearLocalData()
                  setRecoveryError(null)
                } catch {
                  setRecoveryError('清空失败，请检查浏览器存储设置后重试。')
                }
              }}
            >确认后清空数据</button>
          </div>
        </section>
      ) : (
        <>
          <section className="stats-grid" aria-label="全部任务统计">
            <div className="stat-card"><span>待办</span><strong>{pending}</strong><small>尚待完成</small></div>
            <div className="stat-card"><span>已完成</span><strong>{completed}</strong><small>已处理的任务</small></div>
            <div className="stat-card"><span>总任务</span><strong>{total}</strong><small>全部记录</small></div>
            <div className="stat-card accent-stat"><span>完成率</span><strong>{completionRate}%</strong><small>继续保持节奏</small></div>
          </section>

          {saveError && <p className="global-error" role="alert">{saveError.message}。当前修改未保存。</p>}

          <div className="workspace-grid">
            <AddTodo />
            <div className="task-column">
              <TodoFilters />
              <TodoList />
            </div>
          </div>
        </>
      )}
    </main>
  )
}

export default App
