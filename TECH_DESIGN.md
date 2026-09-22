# 进阶待办事项应用 — 技术设计

- 状态：对应 [PRD.md](PRD.md) 的 v1 实现设计
- 项目根目录：`C:\Users\86166\Desktop\待办任务清单（进阶）`

## 1. 技术选型与运行方式

使用 Vite 的 `react-ts` 模板创建单页应用，采用 React、TypeScript、Zustand 和原生 CSS。React 负责界面，Zustand 集中管理任务、分类和临时筛选状态，TypeScript 为数据和操作定义明确类型；Vite 负责本地开发与静态构建。v1 无后端、路由和账号。

应用通过 Vite 开发服务器或正式静态网页地址访问。不要以 `file://` 直接打开构建文件来验证数据保存：浏览器对该方式的 `localStorage` 行为可能不同。数据仅属于当前网页来源和浏览器；换域名、端口、浏览器或设备都不会自动同步。

项目创建后提供 `npm run dev`、`npm run build`、`npm run typecheck`、`npm run test`。测试采用 Vitest 与 React Testing Library；构建和类型检查使用非改写命令。依赖版本由创建项目时的锁文件固定，不在本文硬编码版本号。

参考资料：[React](https://react.dev/learn)、[TypeScript](https://www.typescriptlang.org/docs/handbook/intro)、[Vite](https://vite.dev/guide/)、[Zustand](https://zustand.docs.pmnd.rs/learn/guides/beginner-typescript)、[MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)。

## 2. 模块与数据流

界面划分为 `AddTodo` 新增表单、任务列表、搜索筛选栏、统计卡片、分类管理，以及本地数据错误视图。`src/store/todoStore.ts` 中的 Zustand store 持有完整 `AppData`、临时搜索与筛选条件，以及读取/保存错误；表单未提交的输入由 `AddTodo` 自己管理。统计、可见任务列表和排序结果由纯函数选择器从完整任务集合计算，不单独持久化。

任务或分类操作采用 store 中的统一提交步骤：从当前数据生成下一份完整 `AppData` → 验证并序列化 → 写入 `localStorage` → 写入成功后更新 Zustand 状态。写入失败时保留旧数据、设置 `saveError` 并向调用方抛出错误。首次读取失败时设置 `loadError` 并禁止数据修改；`retryLoad` 重读，`clearLocalData` 只在界面取得用户确认后调用。搜索和筛选仅更新内存中的视图状态，不写入存储。

代码按 `components/`、`domain/`、`storage/`、`store/` 划分：组件处理交互，领域函数处理数据校验、筛选和统计，存储模块集中处理序列化与读写异常，Zustand store 提供增删改、完成切换、分类管理和筛选动作。组件不得直接调用 `localStorage`。

store 通过 `createTodoStore(storage?)` 创建，默认导出 `useTodoStore` 供 React 使用；可注入 `StorageLike` 以便测试。任务操作为 `addTask`、`updateTask`、`deleteTask`、`setTaskCompleted`、`toggleTask`；分类操作为 `addCategory`、`renameCategory`、`deleteCategory`。`setFilters` 与 `resetFilters` 只改变内存状态。`selectVisibleTasks` 和 `selectTodoStats` 分别计算列表与整体统计；React 组件使用 `useVisibleTasks`、`useTodoStats` 订阅稳定的派生结果。

`AddTodo` 对标题、描述长度、截止日期及所选分类进行表单校验；成功保存后清空表单，失败时保留输入。分类可在表单旁快速创建并选中。`TodoFilters` 的搜索、分类、优先级、状态控件分别更新同一份筛选条件，因此多个条件同时生效；`TodoList` 展示派生结果、空状态，并支持完成切换和确认删除。任务编辑及分类重命名/删除的界面留待后续模块接入已有 store 动作。

## 3. 数据模型与约束

```ts
type Priority = 'low' | 'medium' | 'high';

interface Task {
  id: string;                 // crypto.randomUUID()
  title: string;              // trim 后 1–120 字符
  description: string;        // 纯文本，最多 2000 字符
  dueDate: string | null;     // YYYY-MM-DD，本地日历日期
  priority: Priority;
  categoryId: string | null;  // null 表示未分类
  completed: boolean;
  createdAt: string;          // ISO 8601 时间戳
  updatedAt: string;          // ISO 8601 时间戳
  completedAt: string | null; // 完成时写入，恢复未完成时清空
}

interface Category {
  id: string;
  name: string;               // trim 后 1–40 字符，忽略大小写后唯一
  createdAt: string;          // ISO 8601 时间戳
}

interface AppData {
  version: 1;
  tasks: Task[];
  categories: Category[];
}
```

固定存储键为 `advanced-todo-app-data`。首次访问无该键时，在内存中使用 `{ version: 1, tasks: [], categories: [] }`；首次成功修改后才写入。所有写入均保存完整对象。`version` 用于未来迁移；遇到不支持的版本时停止写入并提示，不将未知数据当作空列表。

标题与分类名去除首尾空白后校验；描述保留用户输入，按纯文本渲染，禁止作为 HTML 注入。分类名唯一性按不区分大小写比较。截止日期需为真实的 `YYYY-MM-DD` 日历日期，不以 UTC 时间戳保存；排序按日期字符串比较，避免时区使日期偏移。允许过去日期。

完成切换时更新 `completed`、`completedAt`、`updatedAt`。编辑任务时更新 `updatedAt`，不改变 `createdAt`。重命名分类只修改分类名，任务继续引用同一 `categoryId`。删除分类时在**同一次完整数据写入**中删除分类并将关联任务的 `categoryId` 设为 `null`。删除任务直接移除对应记录。无有效分类引用的数据应在读取验证阶段报错，不静默丢弃任务。

## 4. 筛选、排序和统计

搜索词先去除首尾空白并转换为小写，匹配标题或描述的小写文本中的任意连续子串。分类、优先级、完成状态各有一个选择值；四个条件以逻辑“且”组合。分类可选全部、未分类或具体 `categoryId`。删除当前筛选分类后，视图重置为全部分类。

列表排序为：未完成优先；同状态下有截止日期者优先，日期升序；再按优先级高、中、低；再按 `createdAt` 降序；最后按 `id` 保证稳定顺序。统计只从 `AppData.tasks` 计算：`pending = !completed` 数量，`completed` 为已完成数量，`total = pending + completed`，`rate = total === 0 ? 0 : Math.round(completed / total * 100)`。筛选结果不得用于统计。

## 5. 本地存储与失败处理

- 启动时在 `try/catch` 中读取并解析存储值，校验根对象版本、数组、必需字段、字段范围及分类引用，再交给界面。解析或校验失败时保留原存储值，不自动覆盖。
- 读取失败或版本不受支持时显示错误视图并禁止修改数据；提供“重试读取”。对确认无法恢复的本地数据，可提供“清空本地数据”操作，必须再次确认影响范围。
- 保存时捕获容量不足、隐私设置限制等写入异常；显示“保存失败，当前修改未保存”，保留用户在表单中的输入，完整 `AppData` 与任务列表维持上一次成功保存的状态。
- 同一来源多个标签页同时编辑不提供冲突合并；v1 验收以单标签页为准。未来如支持多标签页协同，需另行设计冲突处理。清除浏览器网站数据后，本地任务无法自动恢复。

## 6. 测试与交付检查

领域单元测试覆盖字段校验、分类名重复、分类删除后任务转为未分类、组合筛选、排序，以及空列表和非空列表统计。存储测试覆盖首次空数据、刷新后重载、损坏 JSON、不支持的版本、无效分类引用和写入抛错时不提交状态。界面测试覆盖新增、编辑、完成切换、删除确认、搜索和分类操作。

实现后运行 `npm run typecheck`、`npm run test`、`npm run build`，并在浏览器手动检查桌面与手机布局、键盘操作和刷新恢复。验收结果以 [PRD.md](PRD.md) 的第 6 节为准。
