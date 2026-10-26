# 📅 大学生时间规划器

<div align="center">

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Zustand](https://img.shields.io/badge/Zustand-4-433e38)](https://zustand.docs.pmnd.rs/)

**专为大学生设计的时间规划工具，管理你的课程、实验、考试、Deadline等活动。支持Todo功能、支持设置提醒、支持事件链/组并按高级规则批量创建事件等。支持课程表无缝导入（山东大学）**

新增：日历上下边缘事件摘要、课程作业/实验灯珠工作台、AI API 与 MCP 存档操作、GitHub/Gitee 私有仓库自动同步。手机用户直接在右上角用户栏登录，无需安装软件或运行命令。部署者需一次性开通 [轻量授权服务](docs/WEB_ACCOUNT_SYNC.md)；课程任务和 AI/MCP 见 [功能指南](docs/LOCAL_INTEGRATIONS.md)。

第一次配置 GitHub 登录？按 [从零创建 OAuth App 并部署授权服务](docs/GITHUB_LOGIN_SETUP.md) 操作，全程可在网页完成。

<p align="center">
  <a href="https://icebearhound.github.io/TimeScheduler/">
    <img src="https://raw.githubusercontent.com/IcebearHound/TimeScheduler/main/public/visit-btn.svg" alt="访问 WebApp →">
  </a>
</p>


[功能概览](#核心功能) · [快速开始](#快速开始) · [快捷键](#快捷键) · [技术栈](#技术栈) · [课程导入](#课程表导入指南)

</div>

---

## 📖 目录

- [核心功能](#核心功能)
  - [TimeTable 日历](#timetable日历)
  - [Event Chain 事件链](#event-chain事件链)
  - [Event Group 事件组](#event-group事件组)
  - [事件类型系统](#事件类型系统)
  - [课程表导入](#课程表导入)
  - [高级功能](#高级功能)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [数据持久化](#数据持久化)
- [.events 文件格式](#events-文件格式)
- [快捷键](#快捷键)
- [提醒时间说明](#提醒时间说明)
- [技术栈](#技术栈)
- [课程表导入指南](#课程表导入指南)
- [已知限制](#已知限制)
- [路线图](#路线图)
- [贡献](#贡献)
- [许可证](#许可证)

---

## 🎯 核心功能

### 🗓️ TimeTable（日历）

- **多视图支持**：日视图、周视图（周一~周日）、月视图
- **事件展示**：圆角矩形块显示，自动冲突检测与智能叠放
- **拖拽操作**：支持拖拽移动事件，自由调整时间
- **编辑操作**：编辑、复制（`Ctrl+C`）、剪切（`Ctrl+X`）、粘贴（`Ctrl+V`）、删除
- **快捷键**：完整的键盘操作支持，提升效率
- **自定义属性**：地点、备注、授课教师、课程编号等
- **智能提醒**：10 级提醒（1周/3天/1天/6小时/2小时/30分钟/10分钟/5分钟/2分钟/即时）
- **浏览器通知**：集成 [Notification API](https://developer.mozilla.org/docs/Web/API/Notification)，到点弹窗提醒

### 🔗 Event Chain（事件链）

- **分组管理**：将关联事件按链分组，统一管理
- **统一配色**：同一事件链内所有事件共享颜色标识
- **重点标记**：支持标记重点事件，自动附带默认提醒
- **选中高亮**：点击事件链时，链内所有事件同步高亮
- **冲突检测**：自动检测事件链内的时间重叠

### 📦 Event Group（事件组）

- **文件格式**：支持 `.events` 自定义文件格式，便于备份与分享
- **CRUD 操作**：事件组的完整增删改查
- **导入导出**：支持加载、导出、导入 `.events` 文件
- **冲突处理**：加载事件组时的智能冲突处理选项（覆盖/跳过/融合）
- **融合功能**：支持将多个事件组合并

### 🏷️ 事件类型系统

- **内置类型**：课程 📚、考试 📝、实验 🔬
- **自定义类型**：自由创建任意事件类型
- **多级分类**：支持 Tag 标签体系
- **Emoji 标识**：每种类型配备对应 Emoji，一目了然
- **类型筛选**：按事件类型快速过滤视图

### 📥 课程表导入

- **格式支持**：山东大学教务系统 `.xls` 课表格式
- **智能识别**：自动识别周次模式（每周 / 单周 / 双周 / 指定周）
- **学期计算**：支持 20 周学期自动计算开课日期
- **信息保留**：完整保存授课教师、上课地点、课程编号等信息

### ⚡ 高级功能

- **冲突检测**：多事件时间重叠检测，自动优先级排序
- **智能布局**：重叠事件自动并排显示，≥4 个事件时折叠
- **批量规则**：支持复杂修改规则（如"奇数周周一第2个事件"）的批量创建与修改
- **撤销/重做**：完整的 Undo/Redo 栈（最多 50 条），覆盖事件、事件链、事件组、事件类型
- **搜索**：全局事件搜索对话框
- **主题**：浅色 / 深色 / 跟随系统 三种主题模式
- **Todo 视图**：置顶事件、自定义高亮/即将到来的时间范围

---

## 🚀 快速开始

### 直接使用

打开 [在线网站](https://icebearhound.github.io/TimeScheduler/) 即可编辑和本地保存日程。网站开通授权服务后，在右上角 **用户** 选择 GitHub 或 Gitee，登录授权即可自动同步与跨设备恢复。未开通时页面会明确提示，仍可正常编辑与导出备份。

### 日程工作台与数据保护

- 首页提供今日概览、下一项日程和设备保存状态；空日历可直接创建日程、导入课表或恢复备份。功能导览和通知授权可在设置中主动打开。
- 日／多日视图显示时间刻度与当前时间线；月视图从周一开始，包含完整六周和相邻月份日程。月底翻月不会跳过月份。月历日期可用方向键选择、Enter 打开。
- 搜索支持名称、地点和自然语言日期；用 ↑↓ 选择结果、Enter 打开、Esc 关闭。弹窗隔离背景操作并恢复打开前焦点，文字编辑使用原生撤销。
- 保存失败会显示持续提示，可导出包含未保存修改的紧急备份并重试。损坏的原始存档会被保护；先在设置中导出原始数据，再恢复有效的完整备份。存在存储问题时自动云同步暂停。
- 创建日程及分组归属支持一步撤销。删除日程／事件链会同时清理引用；删除类型保留日程并移入「未分类」。剪切在粘贴时才移动原事件。

### 手机导航与界面设置

- 顶部切换日程、多日、月览，选择日期或搜索；右上角用户栏提供账号同步与 **设置**。
- 底部依次为 **分组、待办、新建、课程、工具**。导入课表、AI/MCP、撤销/重做和详情侧栏位于工具面板。
- 分组面板按 **事件组／事件链／事件类型** 分页，每页独立滚动；长名称自动换行。事件组的“更多”菜单提供排序、重命名、导出、图标与删除。
- **用户 → 设置 → 界面布局** 可选 **自动适配、手机版、桌面版**，此浏览器会记住选择。自动模式在小于 1100 px 时使用手机／平板布局；手动选择桌面版时允许横向滚动。
- 设置还提供浅色/深色/跟随系统主题、类型管理、功能导览和完整备份导出/恢复。
- 手机面板最多占可视屏幕约 78%，顶部关闭栏始终可见。可点击 **关闭**、轻点面板外侧空白，或从顶部向下滑动关闭；在内容区正常滚动不会误关。详情修改会在关闭时保存，新建表单需点击“创建事件”才写入日程。

开发者可运行 `npm run test:mobile` 验证窄屏导航、长分组列表、备份恢复与布局切换。
运行 `npm run test:mobile-panels` 可验证触摸关闭、滑动、滚动后的关闭按钮、小视口以及嵌套面板。

### 网页 AI

手机和电脑打开 **AI / MCP**，选择服务商、粘贴 **API Key** 即可生成日程操作预览；无需 npm、本机服务或配对。内置服务商自动填写模型和地址，密钥只在此浏览器加密保存，确认后才修改存档。浏览器跨域受限的服务商可由部署者开通轻量转发，详见 [配置指南](docs/LOCAL_INTEGRATIONS.md)。外部 MCP 客户端的本机连接单独放在高级选项中。

开发者可运行 `npm run test:browser-ai` 和 `npm run test:ai-relay` 验证网页直连、加密保存与 Worker 转发流程；测试使用模拟服务响应，不消耗真实 API 额度。

### 右边栏作业 / 实验

- 右边栏的 **TODO** 与 **作业 / 实验** 并列切换，手机底部的“待办”和“课程”也会打开对应栏目。
- 点击右上角 **全屏放大** 可展开当前栏目，点击 **退出全屏** 或按 Esc 返回；放大、缩小与切换栏目保留正在编辑的任务草稿。
- 灯珠从今天开始按每门课程一行、每天一列展示，可选择未来 7／14／30 天。绿色为已完成，红色为逾期，黄色为今日截止，蓝色为待验收，灰色为当天无任务；横向滚动可查看后续日期。
- 此前逾期未完成的任务单独提醒，历史和远期任务可在“全部课程任务”中查看。点击灯珠编辑，保存后继续使用原有事件链与表格批量导入功能。

运行 `npm run test:assignment-sidebar` 可验证每日状态、跨日刷新、全屏草稿保留和桌面／手机布局。

### 本地开发前置要求

- **Node.js** `>= 22.12`
- **npm** 或 **yarn**

### 安装

```bash
git clone https://github.com/IcebearHound/TimeScheduler.git
cd TimeScheduler
npm install
```

### 开发

```bash
npm run dev
```

打开终端显示的本地地址（默认 `http://localhost:5173/TimeScheduler/`）。

### 构建

```bash
npm run build    # 生产构建，输出到 dist/
npm run preview  # 预览生产构建
```

### 其他命令

```bash
npm run check       # 前端、本机服务和 Worker 类型检查
npm test            # 业务、数据事务与安全回归测试
npm run test:quality # 构建后执行质量验收、WCAG 扫描与首屏体积预算
npm run test:ui     # 质量验收、手机导航、触摸面板和日历滚动回归
npm audit           # 依赖安全审计
```

浏览器测试首次运行前执行 `npx playwright install chromium`。结果、截图和可访问性明细写入 `test-results/`。持续集成在 PR 和 `codex/**` 分支运行相同检查；发布构建也先执行类型检查、业务测试和安全审计。

首屏全部 JavaScript（含 React 和视图分块）的预算为原始体积 600 KiB、gzip 200 KiB；导入课表、电子表格和 Agent 在使用时加载。SheetJS 使用官方 CDN 的 0.20.3 发布包，锁文件包含完整性校验；`postcss-selector-parser` 固定在包含安全修复的兼容版本范围。

---

## 📁 项目结构

```
TimeScheduler/
├── index.html                      # HTML 入口 (zh-CN)
├── package.json                    # 项目配置 & 依赖
├── vite.config.ts                  # Vite 构建配置
├── tsconfig.json                   # TypeScript 配置
├── tailwind.config.js              # Tailwind CSS 配置
├── postcss.config.js               # PostCSS 配置
│
└── src/
    ├── main.tsx                    # React 入口
    ├── App.tsx                     # 根组件（布局、模态框、主题、通知）
    ├── index.css                   # 全局样式 & 动画系统
    │
    ├── types/                      # TypeScript 类型定义
    │   ├── event.ts                # Event, EventChain, EventGroup, EventType, BatchRule 等
    │   ├── calendar.ts             # ViewMode, TimeSlot, CalendarDate, WeekInfo 等
    │   └── course.ts               # CourseCell, CourseImportResult
    │
    ├── stores/                     # Zustand 状态管理
    │   ├── eventStore.ts           # 核心事件状态（事件、事件链、类型、剪贴板、撤销/重做）
    │   ├── eventGroupStore.ts      # 事件组管理（含撤销/重做）
    │   ├── uiStore.ts              # UI 状态（视图、模态框、筛选、主题、Toast）
    │   └── sideSelection.ts        # 侧边栏选中状态
    │
    ├── components/                 # React 组件
    │   ├── TimeTable.tsx           # 主日历容器（协调日/周/月视图）
    │   ├── TimeTable/              # 视图子组件
    │   │   ├── DayView.tsx         #   日视图
    │   │   ├── WeekView.tsx        #   周视图
    │   │   ├── MonthView.tsx       #   月视图
    │   │   ├── DayColumn.tsx       #   日列
    │   │   └── EventBlockItem.tsx  #   事件块
    │   ├── EventModal.tsx          # 事件编辑模态框
    │   ├── EventForm/              # 表单子组件
    │   ├── EventChainModal.tsx     # 事件链管理
    │   ├── EventContextMenu.tsx    # 右键菜单
    │   ├── CourseImportModal.tsx   # 课程导入
    │   ├── BatchRuleModal.tsx      # 批量规则
    │   ├── ConflictDialog.tsx      # 冲突处理
    │   ├── SearchDialog.tsx        # 搜索
    │   ├── TodoModal.tsx           # Todo 视图
    │   ├── TypeManagerModal.tsx    # 类型管理
    │   ├── WelcomeGuide.tsx        # 首次启动引导
    │   ├── KeyboardShortcuts.tsx   # 全局快捷键
    │   └── ...
    │
    └── utils/                      # 工具函数
        ├── eventUtils.ts           # 冲突检测、重叠计算、定位、提醒
        ├── dateUtils.ts            # 日期计算、格式化、周/月信息
        ├── courseImporter.ts       # 课程导入主逻辑
        ├── courseTableParser.ts    # XLS 课表解析
        ├── batchRuleUtils.ts       # 批量规则执行引擎
        ├── notificationManager.ts  # 浏览器通知 API
        ├── fileManager.ts          # .events 文件导入/导出
        ├── idGenerator.ts          # 唯一 ID 生成
        ├── navigation.ts           # 日期导航
        ├── dialog.ts               # 对话框工具
        ├── debugStore.ts           # 调试日志
        └── scrollTarget.ts         # 滚动位置管理
```

---

## 💾 数据持久化

日程数据通过 Zustand `subscribe` 自动持久化到浏览器 **localStorage**，无需手动保存：

| 存储 Key | 内容 |
|----------|------|
| `eventStore` | 事件、事件链、事件类型、学期日期（剪贴板仅保留在内存） |
| `eventGroupStore` | 事件组配置 |
| `time-scheduler-preferences-v1` | 事件组图标、待办时间范围等显示偏好 |

> 在右上角用户栏登录 GitHub / Gitee 后，修改自动同步到个人私有仓库并回读核验，离线修改联网后补传。登录令牌仅在当前浏览器 IndexedDB 中加密持久化，不进入日程存档。详见 [账号同步与部署指南](docs/WEB_ACCOUNT_SYNC.md)。也可导出 `.events` 文件备份。

---

## 📝 .events 文件格式

```json
{
  "version": "1.0.0",
  "exportTime": "2024-06-16T10:30:00Z",
  "eventGroups": [
    {
      "id": "group-xxx",
      "name": "我的学习计划",
      "eventChainIds": ["chain-xxx"],
      "eventIds": ["event-xxx"],
      "description": "这是一个事件组",
      "createdAt": "2024-06-16T10:30:00Z",
      "updatedAt": "2024-06-16T10:30:00Z"
    }
  ],
  "semesterStartDate": "2024-09-01"
}
```

---

## ⌨️ 快捷键

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Ctrl + N` | 新建事件 | 打开事件创建对话框 |
| `Ctrl + C` | 复制事件 | 将选中事件复制到剪贴板 |
| `Ctrl + X` | 剪切事件 | 剪切选中事件到剪贴板 |
| `Ctrl + V` | 粘贴事件 | 粘贴剪贴板中的事件 |
| `Ctrl + Z` | 撤销 | 撤销上一步操作 |
| `Ctrl + Y` | 重做 | 重做已撤销的操作 |
| `Ctrl + F` | 搜索     | 全局高级搜索           |
| `Delete` | 删除 | 删除当前选中的事件 |



---

## 🔧 技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | [React](https://react.dev/) | ^18.2 | UI 框架 |
| 语言 | [TypeScript](https://www.typescriptlang.org/) | ^5.0 | 类型安全 |
| 构建 | [Vite](https://vitejs.dev/) | ^8.3 | 快速开发与打包 |
| 样式 | [Tailwind CSS](https://tailwindcss.com/) | ^3.3 | 原子化 CSS |
| 状态管理 | [Zustand](https://zustand.docs.pmnd.rs/) | ^4.4 | 轻量状态管理 |
| 日期处理 | [date-fns](https://date-fns.org/) | ^2.30 | 日期计算与格式化 |
| Excel 解析 | [XLSX (SheetJS)](https://sheetjs.com/) | ^0.18 | 课表文件解析 |
| 图标 | [Lucide React](https://lucide.dev/) | ^0.294 | SVG 图标库 |
| 工具 | [clsx](https://github.com/lukeed/clsx) | ^2.0 | 类名拼接 |

---

## 📝 课程表导入指南

> 适用于**山东大学**教务系统

1. 打开 [山东大学教学管理系统](https://bkzhjx.wh.sdu.edu.cn/)
2. 登录个人账号
3. 进入 **培养管理** → **我的课表** → **学期理论课表**
4. 选择对应学期
5. 点击 **导出** 获取 `.xls` 文件
6. 在时间规划器中点击 **导入课程** 按钮
7. 设置**学期开始日期**后选择刚下载的 `.xls` 文件
8. 系统会自动解析并创建事件链和事件

---

## 🐛 已知限制

| 限制 | 计划解决方案 |
|------|-------------|
| 不同浏览器的本地数据独立 | 授权服务开通后，登录同一个 GitHub/Gitee 账号自动同步与恢复 |
| 超大数据量时性能下降 | 虚拟化滚动 |

---

## 🚧 路线图

- [x] GitHub/Gitee 自动同步（部署者需配置 OAuth 授权服务）
- [ ] 日历分享功能
- [ ] 学习统计与分析仪表盘
- [ ] 搜索功能增强（全文搜索、正则匹配）
- [ ] 日程冲突智能解决方案推荐
- [ ] CLI 快速添加事件
- [ ] 第三方日历集成（Google Calendar, iCal）
- [ ] 移动端 PWA 支持
- [ ] 单元测试 & E2E 测试覆盖
- [ ] 国际化（i18n）支持

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/new-feature`
3. 提交更改：`git commit -m 'feat: add feature'`
4. 推送分支：`git push origin feature/new-feature`
5. 提交 Pull Request

---

## 📄 许可证

本项目基于 [MIT License](./LICENSE) 开源。

---

## 👤 作者

白熊苍狗IcebearHound

---

<div align="center">
**⭐ 如果这个项目对你有帮助，请给一个 Star！**

</div>
