import { useState, type FormEvent } from 'react'
import { isValidDueDate, TodoValidationError, type Priority } from '../domain/todo'
import { TodoStorageError } from '../storage/localStorage'
import { useTodoStore } from '../store/todoStore'

interface Draft {
  title: string
  description: string
  dueDate: string
  priority: Priority
  categoryId: string
}

type FieldErrors = Partial<Record<keyof Draft, string>>

const emptyDraft = (): Draft => ({
  title: '',
  description: '',
  dueDate: '',
  priority: 'medium',
  categoryId: '',
})

const countCharacters = (value: string): number => Array.from(value).length

const validateDraft = (draft: Draft, categoryIds: readonly string[]): FieldErrors => {
  const errors: FieldErrors = {}
  const titleLength = countCharacters(draft.title.trim())
  if (titleLength === 0) errors.title = '请输入任务标题。'
  else if (titleLength > 120) errors.title = '标题不能超过 120 个字符。'
  if (countCharacters(draft.description) > 2000) errors.description = '描述不能超过 2000 个字符。'
  if (draft.dueDate && !isValidDueDate(draft.dueDate)) errors.dueDate = '请选择有效的截止日期。'
  if (draft.categoryId && !categoryIds.includes(draft.categoryId)) errors.categoryId = '所选分类已不存在。'
  return errors
}

const errorMessage = (error: unknown): string => {
  if (error instanceof TodoValidationError) return error.message
  if (error instanceof TodoStorageError) return '保存失败，当前修改未保存。请检查浏览器存储设置或空间。'
  return '操作失败，请重试。'
}

export function AddTodo() {
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const categories = useTodoStore((state) => state.data.categories)
  const addTask = useTodoStore((state) => state.addTask)
  const addCategory = useTodoStore((state) => state.addCategory)

  const setField = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateDraft(draft, categories.map((category) => category.id))
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    try {
      addTask({
        title: draft.title,
        description: draft.description,
        dueDate: draft.dueDate || null,
        priority: draft.priority,
        categoryId: draft.categoryId || null,
      })
      setDraft(emptyDraft())
      setFormError(null)
    } catch (error) {
      setFormError(errorMessage(error))
    }
  }

  const handleAddCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCategoryError(null)
    try {
      const category = addCategory(categoryName)
      setCategoryName('')
      setField('categoryId', category.id)
    } catch (error) {
      setCategoryError(errorMessage(error))
    }
  }

  return (
    <section className="panel add-panel" aria-labelledby="add-heading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">记录新任务</span>
          <h2 id="add-heading">添加待办</h2>
        </div>
        <span className="panel-hint">仅标题必填</span>
      </div>

      <form className="todo-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="todo-title">标题 <span aria-hidden="true">*</span></label>
          <input
            id="todo-title"
            type="text"
            value={draft.title}
            onChange={(event) => setField('title', event.target.value)}
            placeholder="例如：准备本周工作汇报"
            maxLength={120}
            required
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'todo-title-error' : undefined}
          />
          {errors.title && <small className="field-error" id="todo-title-error" role="alert">{errors.title}</small>}
        </div>

        <div className="field">
          <label htmlFor="todo-description">描述 <span className="optional">选填</span></label>
          <textarea
            id="todo-description"
            value={draft.description}
            onChange={(event) => setField('description', event.target.value)}
            placeholder="补充任务的具体内容"
            rows={3}
            maxLength={2000}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'todo-description-error' : undefined}
          />
          {errors.description && <small className="field-error" id="todo-description-error" role="alert">{errors.description}</small>}
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="todo-date">截止日期</label>
            <input
              id="todo-date"
              type="date"
              value={draft.dueDate}
              onChange={(event) => setField('dueDate', event.target.value)}
              aria-invalid={Boolean(errors.dueDate)}
              aria-describedby={errors.dueDate ? 'todo-date-error' : undefined}
            />
            {errors.dueDate && <small className="field-error" id="todo-date-error" role="alert">{errors.dueDate}</small>}
          </div>
          <div className="field">
            <label htmlFor="todo-priority">优先级</label>
            <select
              id="todo-priority"
              value={draft.priority}
              onChange={(event) => setField('priority', event.target.value as Priority)}
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="todo-category">分类</label>
            <select
              id="todo-category"
              value={draft.categoryId}
              onChange={(event) => setField('categoryId', event.target.value)}
              aria-invalid={Boolean(errors.categoryId)}
              aria-describedby={errors.categoryId ? 'todo-category-error' : undefined}
            >
              <option value="">未分类</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            {errors.categoryId && <small className="field-error" id="todo-category-error" role="alert">{errors.categoryId}</small>}
          </div>
        </div>

        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button className="primary-button" type="submit">添加任务</button>
      </form>

      <form className="category-create" onSubmit={handleAddCategory} noValidate>
        <label htmlFor="new-category">没有合适的分类？新建一个</label>
        <div className="inline-field">
          <input
            id="new-category"
            type="text"
            value={categoryName}
            onChange={(event) => { setCategoryName(event.target.value); setCategoryError(null) }}
            placeholder="输入分类名称"
            maxLength={40}
            aria-invalid={Boolean(categoryError)}
            aria-describedby={categoryError ? 'new-category-error' : undefined}
          />
          <button className="secondary-button" type="submit">创建并选中</button>
        </div>
        {categoryError && <small className="field-error" id="new-category-error" role="alert">{categoryError}</small>}
      </form>
    </section>
  )
}
