# 项目文件清单和架构说明

## 📋 已创建的所有文件

### 根目录配置文件 (6 个)

| 文件 | 用途 |
|-----|------|
| `package.json` | 项目依赖和脚本配置 |
| `tsconfig.json` | TypeScript 编译器配置 |
| `tsconfig.node.json` | Node.js TypeScript 配置 |
| `vite.config.ts` | Vite 打包工具配置 |
| `tailwind.config.js` | Tailwind CSS 主题配置 |
| `postcss.config.js` | PostCSS 插件配置 |
| `.gitignore` | Git 忽略文件规则 |
| `index.html` | HTML 入口文件 |

### 源代码目录 `src/` 

#### 主应用文件 (3 个)
```
src/
├── main.tsx           ✅ React 应用入口
├── App.tsx            ✅ 主应用容器组件
└── index.css          ✅ 全局样式和自定义类
```

#### 类型定义 `src/types/` (3 个)
```
src/types/
├── event.ts           ✅ 事件、事件链、事件组类型
├── calendar.ts        ✅ 日期视图相关类型
└── course.ts          ✅ 课程导入相关类型
```

#### 状态管理 `src/stores/` (3 个)
```
src/stores/
├── eventStore.ts      ✅ 事件、事件链、类型状态管理
├── uiStore.ts         ✅ UI 状态（视图、选中项、面板）
└── eventGroupStore.ts ✅ 事件组状态管理
```

#### 工具函数 `src/utils/` (6 个)
```
src/utils/
├── idGenerator.ts         ✅ 唯一 ID 生成
├── eventUtils.ts          ✅ 事件处理（冲突检测、时间计算）
├── dateUtils.ts           ✅ 日期处理（周数、格式化等）
├── notificationManager.ts ✅ 浏览器通知管理
├── fileManager.ts         ✅ .events 文件导出导入
└── courseImporter.ts      ✅ 山东大学课表 Excel 解析
```

#### 组件 `src/components/` (9 个主组件)
```
src/components/
├── Header.tsx                    ✅ 顶部导航栏
├── LeftSidebar.tsx              ✅ 左侧边栏（事件组、筛选）
├── EventChainFilter.tsx         ✅ 事件类型多选筛选
├── RightPanel.tsx               ✅ 右侧事件详情面板
├── TimeTable.tsx                ✅ 日历视图容器（支持懒加载）
├── EventModal.tsx               ✅ 事件编辑模态框
├── CourseImportModal.tsx        ✅ 课程表导入对话框
└── ConflictDialog.tsx           ✅ 时间冲突处理对话框

TimeTable 子组件 (4 个):
├── TimeTable/
│   ├── WeekView.tsx            ✅ 周视图（⭐ 主视图）
│   ├── MonthView.tsx           ✅ 月视图
│   ├── DayView.tsx             ✅ 日视图
│   ├── DayColumn.tsx           ✅ 单日列（显示时间段和事件）
│   └── EventBlockItem.tsx      ✅ 单个事件块

EventForm 子组件 (2 个):
├── EventForm/
│   ├── EventForm.tsx           ✅ 完整事件编辑表单
│   └── ReminderSelector.tsx    ✅ 智能提醒时间选择器（折叠设计）
```

### 文档文件 (4 个)
```
├── README.md           ✅ 项目概览和功能说明
├── QUICK_START.md      ✅ 安装运行指南
├── PROJECT_FILES.md    ✅ 本文件（文件清单和架构）
└── .gitignore          ✅ Git 忽略规则
```

---

## 🏗️ 核心架构

### 数据流

```
┌─────────────────┐
│  React 组件     │  显示 UI，处理用户交互
└────────┬────────┘
         │ 读写
┌────────▼────────┐
│ Zustand Store   │  状态管理（三个独立 store）
│  - eventStore   │  - 事件数据
│  - uiStore      │  - UI 状态
│  - groupStore   │  - 事件组
└────────┬────────┘
         │ 自动保存
┌────────▼────────┐
│  localStorage   │  浏览器本地存储
│ - eventStore    │
│ - eventGroupStore│
└─────────────────┘
```

### 功能模块

```
1. TimeTable（日历视图）
   ├─ WeekView (周视图 - 主要)
   ├─ MonthView (月视图)
   ├─ DayView (日视图)
   └─ EventBlock (事件块显示)

2. Event Management（事件管理）
   ├─ EventStore (Zustand)
   ├─ EventForm (编辑表单)
   ├─ ReminderSelector (提醒选择)
   └─ EventModal (模态框)

3. Event Chain（事件链）
   ├─ 创建/编辑/删除
   ├─ 事件链分组
   ├─ 颜色管理
   └─ 默认提醒

4. Event Group（事件组）
   ├─ GroupStore (Zustand)
   ├─ .events 文件格式
   ├─ 导出/导入
   └─ 事件组融合

5. Course Import（课程导入）
   ├─ CourseImporter (Excel 解析)
   ├─ CourseImportModal (对话框)
   └─ 自动创建事件链

6. Utilities（工具函数）
   ├─ eventUtils (冲突检测)
   ├─ dateUtils (日期计算)
   ├─ notificationManager (通知)
   ├─ fileManager (文件 I/O)
   └─ idGenerator (ID 生成)
```

---

## 🚀 快速参考

### 添加新功能的步骤

#### 1. 添加新的事件类型
文件: `src/stores/eventStore.ts`
```typescript
const type = eventStore.addEventType({
  name: '会议',
  emoji: '📞',
  category: 'custom',
  color: '#FF6B6B'
})
```

#### 2. 创建新事件
文件: `src/components/EventForm/EventForm.tsx`
已包含完整的表单逻辑

#### 3. 添加新视图
1. 创建 `src/components/TimeTable/NewView.tsx`
2. 在 `src/stores/uiStore.ts` 添加视图模式
3. 在 `src/components/TimeTable.tsx` 中导入

---

## 📊 项目统计

| 类别 | 数量 | 说明 |
|------|------|------|
| 配置文件 | 8 | package.json, tsconfig, vite 等 |
| 类型定义 | 3 | TypeScript 接口定义 |
| 状态管理 | 3 | Zustand stores |
| 工具函数 | 6 | 事件、日期、通知等 |
| 组件 | 15+ | React 组件 |
| 文档 | 4 | README、快速开始等 |
| **总计** | **40+** | **完整的工程级代码** |

---

## 🔧 主要依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| react | ^18.2.0 | UI 框架 |
| zustand | ^4.4.0 | 状态管理 |
| tailwindcss | ^3.3.0 | 样式框架 |
| vite | ^4.4.0 | 打包工具 |
| typescript | ^5.0.2 | 类型检查 |
| date-fns | ^2.30.0 | 日期处理 |
| xlsx | ^0.18.5 | Excel 读取 |
| lucide-react | ^0.294.0 | 图标库 |

---

## 🎯 功能完成度

### 第一部分: TimeTable 和事件系统 ✅ 90%
- [x] 日历视图（日/周/月）
- [x] 事件块显示
- [x] 事件编辑表单
- [x] 事件链管理
- [x] 类型系统和筛选
- [ ] 拖拽功能（待完成）
- [ ] 右键菜单（待完成）
- [ ] 快捷键（待完成）

### 第二部分: 事件组和文件 ⚠️ 50%
- [x] EventGroup 状态管理
- [x] .events 文件格式设计
- [x] 导出/导入逻辑
- [ ] UI 界面（待完成）

### 第三部分: 课程导入 ⚠️ 80%
- [x] Excel 解析逻辑
- [x] 课程导入模态框
- [x] 自动创建事件
- [ ] 错误处理完善（待完成）
- [ ] 测试（待完成）

### 第四部分: 高级功能 ⚠️ 40%
- [x] 时间冲突检测
- [x] 通知管理
- [ ] 冲突对话框（待完成）
- [ ] 优先级排序（待完成）
- [ ] 事件重叠显示（待完成）

---

## 📝 关键代码片段

### 添加事件的完整流程
```typescript
// 1. 创建事件链
const chain = eventStore.addEventChain({
  name: "计组复习",
  color: "#3B82F6",
  typeId: "type-course",
  defaultReminders: [...]
})

// 2. 添加事件到链
eventStore.addEvent({
  name: "计组复习 Chapter 1",
  chainId: chain.id,
  startTime: new Date("2024-06-20 10:00"),
  endTime: new Date("2024-06-20 12:00"),
  isHighlight: true,
  ...
})
```

### 检测事件冲突
```typescript
const conflicts = eventStore.detectConflicts()
// 返回所有重叠事件的集合
```

### 使用提醒
```typescript
const reminder: Reminder = {
  id: generateId('reminder'),
  time: '1d',
  enabled: true,
  notified: false
}
```

---

## 🔗 文件依赖关系

```
App.tsx
├─ Header.tsx
├─ LeftSidebar.tsx
│  └─ EventChainFilter.tsx
│     └─ useEventStore
├─ TimeTable.tsx
│  ├─ WeekView.tsx
│  │  ├─ DayColumn.tsx
│  │  │  └─ EventBlockItem.tsx
│  │  └─ useEventStore, useUIStore
│  ├─ MonthView.tsx
│  └─ DayView.tsx
├─ RightPanel.tsx
├─ EventModal.tsx
│  └─ EventForm.tsx
│     └─ ReminderSelector.tsx
├─ CourseImportModal.tsx
│  └─ CourseImporter.ts
└─ ConflictDialog.tsx
```

---

**最后更新**: 2024-06-16  
**项目状态**: 🟡 活跃开发中  
**完成度**: 65% (基础框架 100%, 功能集成 40%)
