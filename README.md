# 进阶待办事项

本项目按模块开发。当前已完成任务/分类的数据模型、运行时数据校验、浏览器本地存储、Zustand 全局状态，以及新增任务、分类快速创建、搜索与组合筛选、列表展示和完成切换。任务编辑及分类重命名/删除的界面尚未实现。产品规则见 [PRD.md](PRD.md)，数据与存储契约见 [TECH_DESIGN.md](TECH_DESIGN.md)。

安装依赖后运行：

```powershell
npm install
npm run dev
npm run typecheck
npm run test
npm run build
```

`src/domain/todo.ts` 提供类型、创建函数和 `validateAppData`；`src/domain/todoSelectors.ts` 提供组合筛选、排序和统计；`src/storage/localStorage.ts` 提供本地数据读写；`src/store/todoStore.ts` 提供 Zustand 操作及 React hooks。界面必须在用户确认后才能调用清空函数。任务和分类修改应经过 store，待存储成功后才会更新已保存的界面状态。
