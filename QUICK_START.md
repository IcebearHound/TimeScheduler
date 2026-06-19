# 快速开始指南 - 大学生时间规划器

## 🚀 安装步骤

### 1. 进入项目目录
```bash
cd d:\CodeProjects\TimeScheduler
```

### 2. 安装依赖（首次安装）
```bash
npm install
```

这将安装所有必要的包，包括 React、Vite、Tailwind CSS 等。

**安装时间**: 通常需要 5-15 分钟，取决于网络速度。

### 3. 启动开发服务器
```bash
npm run dev
```

输出示例：
```
> vite

  VITE v4.4.0  ready in 123 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

### 4. 打开浏览器
自动打开 `http://localhost:5173/` 或手动访问此地址。

## 📁 项目架构速览

```
src/
├── components/              # React 组件
│   ├── TimeTable/          # 日历视图组件
│   │   ├── WeekView.tsx    # ⭐ 周视图（主要）
│   │   ├── MonthView.tsx   # 月视图
│   │   ├── DayView.tsx     # 日视图
│   │   ├── DayColumn.tsx   # 单天列
│   │   └── EventBlockItem.tsx # 事件块
│   ├── EventForm/          # 事件编辑
│   │   ├── EventForm.tsx   # 完整表单
│   │   └── ReminderSelector.tsx # 提醒选择
│   ├── Header.tsx          # 顶部导航
│   ├── LeftSidebar.tsx     # 左侧边栏
│   └── ...
├── stores/                 # Zustand 状态管理
│   ├── eventStore.ts       # 🔧 事件数据
│   ├── uiStore.ts          # 🎨 UI 状态
│   └── eventGroupStore.ts  # 📦 事件组
├── types/                  # TypeScript 类型
├── utils/                  # 工具函数
│   ├── eventUtils.ts       # 事件处理（冲突检测等）
│   ├── dateUtils.ts        # 日期计算
│   ├── courseImporter.ts   # 课程表解析
│   ├── notificationManager.ts # 通知
│   └── fileManager.ts      # 文件 I/O
└── App.tsx                 # 主应用
```

## 🔧 常用命令

| 命令 | 功能 | 用途 |
|------|------|------|
| `npm run dev` | 启动开发服务器 | 日常开发 |
| `npm run build` | 构建生产版本 | 生成dist文件夹 |
| `npm run preview` | 预览生产版本 | 在本地预览打包后的效果 |
| `npm run type-check` | 类型检查 | 检查 TypeScript 错误 |

## 💡 开发流程

### 添加新事件类型
编辑 `src/stores/eventStore.ts` 中的 `loadDefaultData()` 方法：

```typescript
const defaultTypes = [
  { id: 'type-course', name: '课程', emoji: '📚', category: 'course', color: '#3B82F6' },
  // 添加新的类型...
]
```

### 修改样式
所有样式使用 Tailwind CSS。编辑 `src/components/` 中的文件或 `src/index.css` 中的全局样式。

### 添加新视图
1. 在 `src/components/TimeTable/` 创建新文件（如 `AgendaView.tsx`）
2. 导入到 `src/components/TimeTable.tsx`
3. 在 UI Store 中添加新的视图模式

## 🐛 常见问题排查

### 问题1: 端口 5173 已被占用
```bash
# 指定其他端口
npm run dev -- --port 3000
```

### 问题2: 模块未找到错误
```bash
# 清除缓存并重新安装
rm -r node_modules
npm install
```

### 问题3: 样式未加载
```bash
# 检查 Tailwind 配置
npm run dev  # 重启开发服务器
```

### 问题4: 事件数据丢失
数据存储在 `localStorage` 中。清除浏览器缓存会导致数据丢失。
打开开发者工具 (F12) 查看：
- 应用 → 本地存储 → http://localhost:5173

## 📊 数据流说明

```
用户操作 (组件)
    ↓
Zustand Store (eventStore / uiStore / eventGroupStore)
    ↓
localStorage (自动保存)
    ↓
组件重新渲染 (订阅更新)
```

## 🎯 关键功能实现位置

| 功能 | 文件 | 说明 |
|------|------|------|
| 添加事件 | `EventForm.tsx` | 表单验证和数据保存 |
| 冲突检测 | `eventStore.ts` + `eventUtils.ts` | 检测重叠事件 |
| 课程导入 | `courseImporter.ts` | 解析 Excel 文件 |
| 日期计算 | `dateUtils.ts` | 周数、月日期等 |
| 通知提醒 | `notificationManager.ts` | 浏览器 Notification API |
| 视图切换 | `uiStore.ts` (viewMode) | 日/周/月模式 |

## 🔔 浏览器通知权限

首次使用提醒功能时，浏览器会请求权限。点击 "允许" 才能接收通知。

## 📱 响应式设计

应用使用 Tailwind CSS 的响应式类名。主要布局：
- 超大屏幕(1920px+): 完整三栏布局
- 大屏幕(1024px+): 正常布局
- 平板(768px+): 隐藏部分面板
- 手机: 单列布局（需要进一步优化）

## 🎨 深色模式

深色模式使用 Tailwind 的 `dark:` 前缀。自动跟随系统设置。
手动切换暂未实现，可在 `Header.tsx` 中添加。

## 📚 进阶开发

### 添加全局快捷键
编辑 `App.tsx`，添加 `useEffect` 监听键盘事件：
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault()
      setIsEventPanelOpen(true)
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])
```

### 添加云同步
集成 Firebase 或其他后端服务：
1. 创建 `src/services/api.ts`
2. 在 Store 中添加同步逻辑
3. 替换 localStorage 为 API 调用

### 打包为桌面应用
使用 Electron 或 Tauri：
```bash
npm install --save-dev electron
# 配置 Electron 主进程和预加载脚本
```

## 📖 文档资源

- [React 文档](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Zustand](https://github.com/pmndrs/zustand)
- [Vite 文档](https://vitejs.dev)
- [TypeScript 文档](https://www.typescriptlang.org)

## ✨ 下一步

1. ✅ 完成基础框架（已完成）
2. 🔄 实现拖拽功能（React Beautiful DnD）
3. 🔄 完成时间冲突对话框
4. 🔄 实现快捷键系统
5. 🔄 添加撤销/重做功能
6. 🔄 云端同步功能

---

**有问题？** 查看 README.md 或检查浏览器控制台的错误信息。
