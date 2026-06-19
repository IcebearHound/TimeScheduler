# Welcome Guide Feature Design

## Overview
A welcome guide modal that introduces users to TimeScheduler's core features, operations, and interface layout. Shows automatically on first launch and is always accessible from the Header settings menu.

## Trigger Mechanism
- **First launch**: Auto-popup on app mount, gated by `localStorage` key `hasSeenWelcomeGuide`
- **Manual access**: "功能导览" entry added to Header settings dropdown menu
- On dismiss, set `localStorage.hasSeenWelcomeGuide = 'true'`

## Component: `WelcomeGuide.tsx`

### Layout
- Full-screen overlay with centered scrollable modal (max-height limiting, internal scroll)
- Header area: app icon, title "欢迎使用时间规划器", subtitle "现代化大学生日程管理工具", version number
- Body: 2-column card grid (`grid grid-cols-2`) on desktop, single column on small screens
- Footer: "开始使用" button to dismiss

### Content Cards (12 cards, each with Lucide icon + description)

| # | Title | Icon | Content |
|---|-------|------|---------|
| 1 | 界面布局 | `Layout` | 三栏结构——左侧边栏管理事件组/事件链/事件类型，中间日历区为主操作区，右侧面板查看事件详情或待办。两侧面板可折叠，拖拽分隔条调整宽度。 |
| 2 | 日历视图 | `Calendar` | 支持日视图、周视图（可切换1/3/5/7天）、月视图。顶部"今天"按钮快速回到当天，前后箭头逐页翻动。周/日视图自动滚动到当前时间附近。 |
| 3 | 事件操作 | `Pencil` | 点击"新建"按钮或 Ctrl+N 创建事件；点击事件块弹出快速编辑器；双击打开完整编辑弹窗；拖拽事件块移动时间；拖拽上下边缘调整时长（15分钟吸附）；右键事件块打开上下文菜单（复制/剪切/粘贴/改类型/钉选/删除等）。 |
| 4 | 课程导入 | `Upload` | 三步向导从山东大学教务系统导入课程表：① 打开教务网站下载课表.xls文件 ② 设置学期第一天（周一） ③ 选择文件自动解析生成事件链和全部课程事件。支持20周排课，多节连排自动合并。 |
| 5 | 事件链 | `Link` | 将相关事件组成事件链（如"计算机组成原理"课程→各章节复习），同一链内事件共享颜色。双击左侧链名快速定位到第一个事件。可为链设置批量规则，按周模式自动创建或批量修改事件。 |
| 6 | 事件组 | `Folders` | 按用途分组管理事件链和独立事件（如按学期、按项目）。支持创建/重命名/删除/排序/合并/复制组。导出组为.events文件，导入.events文件创建新组，自动检测时间冲突。 |
| 7 | 事件类型 | `Tags` | 内置课程📚、考试📝、实验🔬三种类型，支持自定义类型。每种类型可配置专属属性字段（如课程有教室/教师/课序号，考试有形式/监考等），属性字段可自定义图标。 |
| 8 | 批量规则 | `Zap` | 为事件链设置批量规则：创建模式下按星期几+周范围自动生成事件；修改模式下按位置查找事件并批量修改名称/描述/时间偏移。支持每周/单周/双周模式，执行前可预览。 |
| 9 | 待办视图 | `ListTodo` | 右侧面板默认显示待办视图，分为置顶、重点事项、即将到来三个区域。拖拽排序，手动钉选事件到置顶区。设置按钮可调整各区域的时间范围。 |
| 10 | 搜索 | `Search` | Ctrl+F 打开全局搜索：按事件名称、事件链名、类型名、属性值搜索，支持自然语言日期（今天/明天/本周），支持星期（周一~周日）和时间（HH:MM）筛选。结果按事件链分组高亮显示。 |
| 11 | 提醒通知 | `Bell` | 多级预设提醒时刻：1周/3天/1天/6小时/2小时/30分/10分/5分/2分/准时。支持钉选常用时刻、自定义任意分钟数。浏览器通知在到点时自动弹出。 |
| 12 | 快捷键 | `Keyboard` | Ctrl+N 新建 / Ctrl+C 复制 / Ctrl+X 剪切 / Ctrl+V 粘贴 / Ctrl+Z 撤销 / Ctrl+Y 重做 / Ctrl+F 搜索 / Ctrl+A 全选 / Delete 删除 / Escape 关闭弹窗 |

### UI States
- **Loading**: N/A (component renders synchronously)
- **Empty**: N/A
- **Error**: N/A (no async operations)
- **Edge cases**: 
  - If localStorage is unavailable, silently skip auto-show (no crash)
  - Very small screens (<640px): switch to single-column card layout
  - Dark mode: all colors use Tailwind dark: variants, consistent with app theme

### Styling
- Tailwind CSS utility classes
- Overlay: `fixed inset-0 bg-black/50 z-50`
- Modal: `bg-white dark:bg-gray-800 rounded-xl shadow-2xl`
- Fade-in animation on open
- Cards: `bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4` with icon + heading + paragraph

### Integration Points
- New file: `src/components/WelcomeGuide.tsx`
- Modified file: `src/components/Header.tsx` — add "功能导览" menu item in settings dropdown
- Modified file: `src/App.tsx` — conditional render on mount if `!localStorage.getItem('hasSeenWelcomeGuide')`
- Modified file: `src/stores/uiStore.ts` — add `isWelcomeGuideOpen: boolean` state and `openWelcomeGuide` / `closeWelcomeGuide` actions (optional; can also use local state in App)

### Files Changed
| Action | File |
|--------|------|
| Create | `src/components/WelcomeGuide.tsx` |
| Modify | `src/App.tsx` |
| Modify | `src/components/Header.tsx` |
