import React, { useState, useEffect } from 'react'
import {
  X, Calendar, Pencil, Upload, Link, Folders,
  Tags, Zap, ListTodo, Search, Bell, Keyboard, Layout,
  ArrowLeft, ChevronLeft, ChevronRight
} from 'lucide-react'

const Card: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; onClick: () => void }> = ({ icon, title, children, onClick }) => (
  <div onClick={onClick}
    className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
    <div className="flex items-center gap-2 mb-2">
      <div className="text-accent-500 dark:text-accent-400">{icon}</div>
      <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">{title}</h3>
    </div>
    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{children}</p>
  </div>
)

interface CardData {
  icon: React.ReactNode
  title: string
  content: string
  detail: string
  animation: React.ReactNode
}

const CARDS: CardData[] = [
  {
    icon: <Layout className="w-5 h-5" />,
    title: '界面布局',
    content: '三栏结构——左侧边栏管理事件组/事件链/事件类型，中间日历区为主操作区，右侧面板查看事件详情或待办。两侧面板可折叠，拖拽分隔条调整宽度。',
    detail: '左侧边栏管理事件组、事件链、事件类型，支持折叠和拖拽调整宽度。中间日历区为主操作区，支持拖拽创建事件、右键打开上下文菜单。右侧面板展示事件详情或待办视图，默认显示待办清单。三栏协同工作，提供完整的日程管理体验。',
    animation: (
      <div className="flex items-end gap-1 h-full">
        <div className="animate-layout-bar-1 bg-blue-400 rounded-t-md w-12" style={{ height: '70%' }} />
        <div className="animate-layout-bar-2 bg-emerald-400 rounded-t-md w-20" style={{ height: '95%' }} />
        <div className="animate-layout-bar-3 bg-purple-400 rounded-t-md w-12" style={{ height: '80%' }} />
      </div>
    ),
  },
  {
    icon: <Calendar className="w-5 h-5" />,
    title: '日历视图',
    content: '支持日视图、周视图（可切换1/3/5/7天）、月视图。顶部"今天"按钮快速回到当天，前后箭头逐页翻动。周/日视图自动滚动到当前时间附近。',
    detail: '日视图展示单天24小时时间线，每小时一行清晰标注。周视图灵活切换1/3/5/7天显示，适应不同使用场景。月视图显示整月网格概览，最多显示4个事件，超出折叠显示。顶部"今天"按钮一键回到当天。',
    animation: (
      <div className="flex flex-col items-center gap-2 w-full">
        <div className="flex gap-1">
          {['日', '周', '月'].map((label, i) => (
            <span key={label} className={`animate-calendar-tab px-3 py-1 rounded text-xs font-medium text-blue-600 border border-blue-300`}
              style={{ animationDelay: `${i * 0.6}s` }}>{label}</span>
          ))}
        </div>
        <div className="flex gap-0.5">
          {[...Array(7)].map((_, i) => (
            <div key={i} className={`w-5 h-5 rounded border border-slate-300 dark:border-slate-600 ${i === 3 ? 'animate-calendar-day' : ''}`} />
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: <Pencil className="w-5 h-5" />,
    title: '事件操作',
    content: '点击"新建"按钮或 Ctrl+N 创建事件；点击事件块弹出快速编辑器；双击打开完整编辑弹窗；拖拽事件块移动时间；拖拽上下边缘调整时长（15分钟吸附）；右键事件块打开上下文菜单。',
    detail: '点击新建按钮或 Ctrl+N 创建事件。单击事件块弹出 Popover 快速编辑器（400ms 防抖自动保存）。双击打开完整 EventForm 表单。拖拽事件块可移动时间，拖拽上下边缘可调整时长，自动吸附15分钟刻度。右键打开上下文菜单：复制、剪切、粘贴、改类型、改链、钉选、加重点、删除。',
    animation: (
      <div className="relative w-full h-full">
        <div className="absolute left-4 right-12 top-2 bottom-2 border-l-2 border-slate-200 dark:border-slate-600 rounded" />
        <div className="absolute left-8 right-8 animate-event-block bg-blue-400 rounded-md h-10 flex items-center px-2">
          <span className="text-white text-xs font-medium">事件块</span>
        </div>
        <div className="absolute left-8 right-8 top-0 h-1 animate-event-handle bg-blue-600 rounded" />
        <div className="absolute left-8 right-8 bottom-0 h-1 animate-event-handle bg-blue-600 rounded" style={{ animationDelay: '2s' }} />
      </div>
    ),
  },
  {
    icon: <Upload className="w-5 h-5" />,
    title: '课程导入',
    content: '三步向导从山东大学教务系统导入课程表.xls文件，自动解析课表生成事件链和全部课程事件。支持20周排课，多节连排自动合并。',
    detail: '三步向导从山东大学教务系统导入课表：①从教务网站（bkzhjx.wh.sdu.edu.cn）下载 .xls 课表文件 ②设置学期开始日期（默认为下一个周一）③选择文件自动解析。支持20周排课，多节连排自动合并，备注提醒自动展示，解析结果即时反馈。',
    animation: (
      <div className="flex flex-col items-center gap-2 w-full">
        <div className="animate-file-drop text-2xl">📄</div>
        <div className="w-32 h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
          <div className="animate-progress-fill h-full bg-blue-500 rounded-full" />
        </div>
        <div className="flex gap-1 text-xs text-slate-400">
          <span>步骤 1</span><span>→</span><span>步骤 2</span><span>→</span><span className="text-blue-500">步骤 3 ✓</span>
        </div>
      </div>
    ),
  },
  {
    icon: <Link className="w-5 h-5" />,
    title: '事件链',
    content: '将相关事件组成事件链，同一链内事件共享颜色标识。双击左侧链名快速定位第一个事件。可为链设置批量规则，按周模式自动创建或批量修改事件。',
    detail: '将关联事件组成事件链（如"计算机组成原理"课程→各章节复习），同一链内事件共享颜色标识。双击左侧链名快速定位第一个事件。支持链合并（选中多链→合并为一）、链复制（深拷贝链及全部事件）。可为链设置批量规则实现自动化操作。',
    animation: (
      <div className="flex items-center justify-center gap-0 w-full">
        {['#3B82F6', '#EF4444', '#10B981', '#F59E0B'].map((color, i) => (
          <React.Fragment key={color}>
            <div className="animate-dot-appear rounded-full w-4 h-4" style={{ backgroundColor: color, animationDelay: `${i * 0.6}s` }} />
            {i < 3 && (
              <div className="animate-line-connect h-0.5 w-6" style={{ backgroundColor: color, animationDelay: `${i * 0.6}s` }} />
            )}
          </React.Fragment>
        ))}
      </div>
    ),
  },
  {
    icon: <Folders className="w-5 h-5" />,
    title: '事件组',
    content: '按用途分组管理事件链和独立事件。支持创建/重命名/删除/排序/合并/复制组。导出组为.events文件，导入时自动检测时间冲突。',
    detail: '按用途分组管理事件链和独立事件（如按学期、按项目）。左侧边栏"事件组"区域支持创建、重命名、删除、拖拽排序（上下移动）、合并（多选后合为一组）、复制。导出组为 .events JSON 文件便于分享备份，导入时自动检测时间冲突并提供解决方案。',
    animation: (
      <div className="flex flex-col items-center gap-1 w-full">
        <div className="animate-folder-flap text-3xl">📁</div>
        <div className="flex gap-1">
          {['📄', '📄', '📄'].map((doc, i) => (
            <span key={i} className="animate-doc-fly text-lg" style={{ animationDelay: `${i * 0.5}s` }}>{doc}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: <Tags className="w-5 h-5" />,
    title: '事件类型',
    content: '内置课程📚、考试📝、实验🔬三种类型，支持自定义类型。每种类型可配置专属属性字段（如课程有教室/教师/课序号），属性字段可自定义图标。',
    detail: '内置课程📚、考试📝、实验🔬三种类型。支持创建自定义类型（名称+emoji+颜色）。每种类型可配置专属属性字段，字段可自定义图标（15种图标可选）。类型决定事件创建表单中的动态属性区域（课程→教室/教师/课序号，考试→形式/监考，实验室→实验内容/指导老师）。',
    animation: (
      <div className="flex gap-3 items-center justify-center w-full">
        {['📚 课程', '📝 考试', '🔬 实验'].map((tag, i) => (
          <span key={tag} className="animate-tag-flip inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: ['#3B82F6', '#EF4444', '#10B981'][i], animationDelay: `${i * 0.8}s` }}>
            {tag}
          </span>
        ))}
      </div>
    ),
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: '批量规则',
    content: '创建模式：按星期几+周范围自动生成事件。修改模式：按位置查找事件并批量修改名称/描述/时间偏移。支持每周/单周/双周模式，执行前可预览。',
    detail: '创建模式：选择星期几（如周一三五）+ 周范围（1-16周）+ 时间段，自动批量生成事件。修改模式：按位置（如"每天第二个事件"）查找并批量修改名称、描述、时间偏移。支持每周/单周/双周三种周模式。执行前弹出预览窗口，确认后统一应用。',
    animation: (
      <div className="grid grid-cols-7 gap-0.5 w-full max-w-[200px] mx-auto">
        {[...Array(14)].map((_, i) => (
          <div key={i} className={`animate-cell-light w-5 h-5 rounded border border-slate-300 dark:border-slate-600`}
            style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    ),
  },
  {
    icon: <ListTodo className="w-5 h-5" />,
    title: '待办视图',
    content: '右侧面板默认显示待办视图，分为置顶、重点事项、即将到来三个区域。拖拽排序，手动钉选事件。可调整各区域的时间范围。',
    detail: '右侧面板默认显示待办视图，分为三个区域：①置顶区——手动钉选的事件，拖拽排序，始终显示在最上方 ②重点事项区——标记为"重点"的事件，时间范围可在设置中调整（默认30天）③即将到来区——未来N天内的事件（默认3天，可调）。设置项支持按事件组/链过滤。',
    animation: (
      <div className="flex flex-col gap-1.5 w-full">
        <div className="animate-todo-swap flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1 text-xs">
          <span>📌</span><span className="text-amber-700 dark:text-amber-300">复习考试</span>
        </div>
        <div className="animate-todo-swap flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-900/20 rounded px-2 py-1 text-xs" style={{ animationDelay: '1.5s' }}>
          <span>⭐</span><span className="text-yellow-700 dark:text-yellow-300">提交作业</span>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1 text-xs">
          <span>🕐</span><span className="text-blue-700 dark:text-blue-300">小组会议</span>
        </div>
      </div>
    ),
  },
  {
    icon: <Search className="w-5 h-5" />,
    title: '搜索',
    content: 'Ctrl+K 打开全局搜索：按事件名称、事件链名、类型名、属性值搜索，支持自然语言日期（今天/明天/本周），支持星期和时间筛选。',
    detail: 'Ctrl+K 或点击顶部搜索栏打开全局搜索对话框。支持按事件名称、事件链名、组名、类型名、属性值（位置/教师等）搜索。智能日期解析：今天/明天/后天/本周/下周/周一~周日，以及 HH:MM 时间和 YYYY-MM-DD 日期格式。结果按分类分组显示，点击事件结果跳转并闪烁定位，点击链/组/类型自动选中。',
    animation: (
      <div className="flex flex-col gap-1.5 w-full">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1.5">
          <Search className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-400">计算</span>
          <span className="animate-cursor-blink w-0.5 h-3 bg-blue-500 rounded" />
        </div>
        <div className="animate-result-slide flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1 text-xs">
          <span className="text-blue-500">计算机组成原理</span><span className="text-slate-400">— 周一 08:00</span>
        </div>
      </div>
    ),
  },
  {
    icon: <Bell className="w-5 h-5" />,
    title: '提醒通知',
    content: '多级预设提醒时刻：1周/3天/1天/6小时/2小时/30分/10分/5分/2分/准时。支持钉选常用时刻、自定义任意分钟数。浏览器通知自动弹出。',
    detail: '多级预设提醒时间：1周前/3天前/1天前/6小时前/2小时前/30分钟前/10分钟前/5分钟前/2分钟前/准时提醒。支持钉选常用时刻到顶部快捷区，自定义任意分钟数。浏览器通知在到点时自动弹出（30秒轮询检测），无通知权限时静默跳过。',
    animation: (
      <div className="relative w-full flex items-center justify-center">
        <Bell className="animate-bell-shake w-8 h-8 text-amber-500" />
        <div className="animate-toast-slide absolute -top-1 right-4 bg-white dark:bg-slate-700 shadow-lg rounded-lg px-2 py-1 text-xs border border-slate-200 dark:border-slate-600">
          🔔 提醒：30分钟后上课
        </div>
      </div>
    ),
  },
  {
    icon: <Keyboard className="w-5 h-5" />,
    title: '快捷键',
    content: 'Ctrl+N 新建 · Ctrl+C 复制 · Ctrl+X 剪切 · Ctrl+V 粘贴 · Ctrl+Z 撤销 · Ctrl+Y 重做 · Ctrl+K 搜索 · Ctrl+A 全选 · Delete 删除 · Escape 关闭弹窗',
    detail: 'Ctrl+N 新建事件 · Ctrl+C 复制选中事件 · Ctrl+X 剪切 · Ctrl+V 粘贴 · Ctrl+Z 撤销（50步历史）· Ctrl+Y/Ctrl+Shift+Z 重做 · Ctrl+K/Ctrl+F 搜索 · Ctrl+A 全选可见事件 · Delete 删除选中事件 · Escape 依次关闭弹窗/浮窗/取消选择。所有核心操作均可键盘完成，无需鼠标。',
    animation: (
      <div className="flex flex-wrap gap-1 justify-center w-full">
        {['Ctrl', 'N', 'Ctrl', 'C', 'Ctrl', 'V', 'Ctrl', 'Z', 'Ctrl', 'K', 'Esc'].map((key, i) => (
          <span key={`${key}-${i}`} className="animate-key-glow inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-xs font-mono text-slate-600 dark:text-slate-300"
            style={{ animationDelay: `${i * 0.25}s` }}>{key}</span>
        ))}
      </div>
    ),
  },
]

interface WelcomeGuideProps {
  onClose: () => void
}

export default function WelcomeGuide({ onClose }: WelcomeGuideProps) {
  const [visible, setVisible] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const handleClose = () => {
    setVisible(false)
    try { localStorage.setItem('hasSeenWelcomeGuide', 'true') } catch {}
    setTimeout(() => onClose(), 200)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) handleClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [visible])

  const openDetail = (index: number) => setSelectedIndex(index)
  const closeDetail = () => setSelectedIndex(null)

  const goPrev = () => {
    setSelectedIndex(prev => prev === null ? null : prev > 0 ? prev - 1 : prev)
  }

  const goNext = () => {
    setSelectedIndex(prev => {
      if (prev === null) return null
      if (prev < CARDS.length - 1) return prev + 1
      return null
    })
  }

  if (!visible) return null

  // Detail view
  if (selectedIndex !== null) {
    const card = CARDS[selectedIndex]
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-modal-backdrop" onClick={closeDetail}>
        <div
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-modal dark:shadow-modal-dark border border-slate-200/60 dark:border-slate-700/60 max-w-lg w-full overflow-hidden flex flex-col animate-modal-panel"
          onClick={e => e.stopPropagation()}
        >
          {/* Detail Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-slate-700/60 flex-shrink-0">
            <button onClick={closeDetail}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
              <ArrowLeft className="w-4 h-4" /> 返回
            </button>
            <span className="text-xs text-slate-400">{selectedIndex + 1} / {CARDS.length}</span>
          </div>

          {/* Detail Body */}
          <div className="px-5 py-5 overflow-y-auto flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-blue-500 dark:text-blue-400">{card.icon}</div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{card.title}</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5">{card.detail}</p>

            {/* Animation Demo Area */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 p-4 flex items-center justify-center" style={{ minHeight: '160px' }}>
              {card.animation}
            </div>
          </div>

          {/* Detail Footer with prev/next */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200/60 dark:border-slate-700/60 flex-shrink-0">
            <button onClick={goPrev} disabled={selectedIndex === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" /> 上一个
            </button>
            <button onClick={goNext}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedIndex === CARDS.length - 1
                  ? 'bg-accent-600 hover:bg-accent-700 text-white font-medium shadow-sm shadow-accent-600/20'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}>
              {selectedIndex === CARDS.length - 1 ? '完成' : <>{'下一个'} <ChevronRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Card grid view
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-modal-backdrop" onClick={handleClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-modal dark:shadow-modal-dark border border-slate-200/60 dark:border-slate-700/60 max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-modal-panel"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-6 h-6 text-accent-500" />
              欢迎使用时间规划器
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">现代化大学生日程管理工具 — 单击卡片查看详情</p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - scrollable card grid */}
        <div className="overflow-y-auto px-6 py-5 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CARDS.map((card, i) => (
              <Card key={i} icon={card.icon} title={card.title} onClick={() => openDetail(i)}>
                {card.content}
              </Card>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-center px-6 py-4 border-t border-slate-200/60 dark:border-slate-700/60 flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-8 py-2.5 bg-accent-600 hover:bg-accent-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-accent-600/20"
          >
            开始使用
          </button>
        </div>
      </div>
    </div>
  )
}
