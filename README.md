# 现代化大学生时间规划器

一个工程级质量的现代美观时间规划应用，专为大学生设计。

## 🎯 核心功能

### 一、TimeTable（日历列表）
- ✅ 多视图支持：日、周（周一到周日）、月
- ✅ 带圆角矩形块显示待办事件及课程
- ✅ 事件块拖动、编辑、复制、剪切、删除
- ✅ 快捷键支持（Ctrl+X/C/V）
- ✅ 自定义事件属性（地点、备注、教师等）
- ✅ 智能提醒系统（1w/3d/1d/6h/2h/30min/10min/5min/2min）
- ✅ 本地通知API集成

### 二、事件链（Event Chain）
- ✅ 事件链分组管理
- ✅ 统一颜色显示
- ✅ 重点事件标记（自动默认提醒）
- ✅ 事件链选中时高亮显示
- ✅ 事件链内事件时间冲突检测

### 三、事件组（Event Group）
- ✅ .events 文件格式支持
- ✅ 事件组的增删改查
- ✅ 事件组加载/导出/导入
- ✅ 事件冲突时的智能处理选项
- ✅ 事件组融合功能

### 四、事件类型系统
- ✅ 基础类型：课程📚、考试📝、实验🔬
- ✅ 自定义类型支持
- ✅ 多级分类（tag）
- ✅ 每个类型配备Emoji
- ✅ 类型筛选视图

### 五、课程表导入
- ✅ 山东大学 xls 课表格式支持
- ✅ 自动化课程事件创建
- ✅ 周期模式识别（每周/奇数周/偶数周/特定周）
- ✅ 20周学期计算
- ✅ 课程信息完整保存（授课老师、地点、课序号）

### 六、高级功能
- ✅ 时间冲突检测和优先级排序
- ✅ 复杂规则修改（每周/奇数/偶数周的周几的第几个事件）
- ✅ 事件重叠时的智能布局
- ✅ 第四个及以后事件折叠显示

## 🚀 快速开始

### 前置要求
- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
cd TimeScheduler
npm install
```

### 开发

```bash
npm run dev
```

应用将在 `http://localhost:5173` 打开

### 构建

```bash
npm run build
```

生成的文件在 `dist/` 目录下

## 📁 项目结构

```
TimeScheduler/
├── src/
│   ├── components/          # React 组件
│   │   ├── TimeTable.tsx   # 日历视图
│   │   ├── EventModal.tsx  # 事件编辑模态框
│   │   ├── Header.tsx      # 顶部导航
│   │   ├── LeftSidebar.tsx # 左侧边栏
│   │   └── ...
│   ├── stores/              # Zustand 状态管理
│   │   ├── eventStore.ts    # 事件状态
│   │   ├── uiStore.ts       # UI 状态
│   │   └── eventGroupStore.ts # 事件组状态
│   ├── types/               # TypeScript 类型定义
│   ├── utils/               # 工具函数
│   │   ├── eventUtils.ts    # 事件处理
│   │   ├── dateUtils.ts     # 日期处理
│   │   ├── courseImporter.ts # 课程导入
│   │   ├── notificationManager.ts # 通知管理
│   │   └── fileManager.ts   # 文件操作
│   ├── App.tsx              # 主应用
│   ├── main.tsx             # 入口点
│   └── index.css            # 全局样式
├── public/
├── index.html               # HTML 模板
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## 🎨 UI/UX 设计亮点

- 现代化设计，支持深色模式
- 流畅的拖拽动画
- 智能的时间冲突检测和展示
- 直观的事件优先级管理
- 响应式布局，适配各种屏幕

## 💾 数据持久化

所有数据存储在浏览器的 localStorage 中：
- `eventStore` - 事件、事件链、事件类型
- `eventGroupStore` - 事件组配置

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

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+N | 新建事件 |
| Ctrl+X | 剪切事件 |
| Ctrl+C | 复制事件 |
| Ctrl+V | 粘贴事件 |
| Ctrl+Z | 撤销 |
| Ctrl+Y | 重做 |
| Delete | 删除选中事件 |

## 🔔 提醒时间说明

| 时间 | 说明 |
|------|------|
| 1w | 1周前 |
| 3d | 3天前 |
| 1d | 1天前 |
| 6h | 6小时前 |
| 2h | 2小时前 |
| 30min | 30分钟前 |
| 10min | 10分钟前 |
| 5min | 5分钟前 |
| 2min | 2分钟前 |
| at-time | 事件开始时刻 |

## 🔧 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 快速打包工具
- **Tailwind CSS** - 样式框架
- **Zustand** - 状态管理
- **React Beautiful DnD** - 拖拽库
- **date-fns** - 日期处理
- **XLSX** - Excel 文件解析
- **Lucide React** - 图标库

## 📝 课程表导入指南

1. 打开 [山东大学教学管理系统](https://bkzhjx.wh.sdu.edu.cn/)
2. 登录账号
3. 进入 "培养管理" → "我的课表" → "学期理论课表"
4. 选择对应学期
5. 点击 "导出" 获取 xls 文件
6. 在时间规划器中点击 "导入课程"
7. 设置学期开始日期后选择 xls 文件
8. 系统会自动创建事件链和事件

## 🐛 已知限制

- 浏览器切换时数据不同步（考虑添加云同步）
- 超大数据量时可能有性能问题（需要虚拟化滚动）
- 不支持跨浏览器数据同步

## 🚧 待实现功能

- [ ] 云端数据同步
- [ ] 日历分享功能
- [ ] 统计和分析功能
- [ ] 搜索功能优化
- [ ] 日程冲突智能解决方案
- [ ] 命令行快速添加事件
- [ ] 第三方日历集成（Google Calendar, iCal 等）
- [ ] 移动端应用

## 📄 许可证

MIT

## 👤 作者

唐程 - 计科6班

---

**欢迎 Star ⭐ 和贡献！**
