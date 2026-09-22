import { useTodoStats, useTodoStore, useVisibleTasks } from '../store/todoStore'
import type { Priority } from '../domain/todo'
import type { CompletionFilter } from '../domain/todoSelectors'

export function TodoFilters() {
  const filters = useTodoStore((state) => state.filters)
  const categories = useTodoStore((state) => state.data.categories)
  const setFilters = useTodoStore((state) => state.setFilters)
  const resetFilters = useTodoStore((state) => state.resetFilters)
  const visibleCount = useVisibleTasks().length
  const { total } = useTodoStats()
  const categoryValue = filters.categoryId === undefined
    ? 'all'
    : filters.categoryId === null ? 'uncategorized' : `category:${filters.categoryId}`
  const hasFilters = Boolean(filters.search.trim()) || filters.categoryId !== undefined
    || filters.priority !== 'all' || filters.status !== 'all'

  return (
    <section className="panel filters-panel" aria-labelledby="filters-heading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">找到需要处理的事</span>
          <h2 id="filters-heading">搜索与筛选</h2>
        </div>
        <span className="result-count">显示 {visibleCount} / {total} 项</span>
      </div>

      <div className="field search-field">
        <label htmlFor="task-search">搜索任务</label>
        <input
          id="task-search"
          type="search"
          value={filters.search}
          onChange={(event) => setFilters({ search: event.target.value })}
          placeholder="输入标题或描述中的关键词"
        />
      </div>

      <div className="filter-row">
        <div className="field">
          <label htmlFor="filter-category">按分类筛选</label>
          <select
            id="filter-category"
            value={categoryValue}
            onChange={(event) => {
              const value = event.target.value
              setFilters({ categoryId: value === 'all' ? undefined : value === 'uncategorized' ? null : value.slice(9) })
            }}
          >
            <option value="all">全部分类</option>
            <option value="uncategorized">未分类</option>
            {categories.map((category) => (
              <option key={category.id} value={`category:${category.id}`}>{category.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-priority">按优先级筛选</label>
          <select
            id="filter-priority"
            value={filters.priority}
            onChange={(event) => setFilters({ priority: event.target.value as Priority | 'all' })}
          >
            <option value="all">全部优先级</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-status">按状态筛选</label>
          <select
            id="filter-status"
            value={filters.status}
            onChange={(event) => setFilters({ status: event.target.value as CompletionFilter })}
          >
            <option value="all">全部状态</option>
            <option value="pending">待办</option>
            <option value="completed">已完成</option>
          </select>
        </div>
      </div>

      {hasFilters && <button className="text-button" type="button" onClick={resetFilters}>清除筛选</button>}
    </section>
  )
}
