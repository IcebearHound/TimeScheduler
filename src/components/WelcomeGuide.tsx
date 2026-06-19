import React, { useState } from 'react'
import {
  X, Calendar, Pencil, Upload, Link, Folders,
  Tags, Zap, ListTodo, Search, Bell, Keyboard, Layout
} from 'lucide-react'

const Card: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
    <div className="flex items-center gap-2 mb-2">
      <div className="text-blue-500 dark:text-blue-400">{icon}</div>
      <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">{title}</h3>
    </div>
    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{children}</p>
  </div>
)

const CARDS = [
  {
    icon: <Layout className="w-5 h-5" />,
    title: '界面布局',
    content: '三栏结构——左侧边栏管理事件组/事件链/事件类型，中间日历区为主操作区，右侧面板查看事件详情或待办。两侧面板可折叠，拖拽分隔条调整宽度。',
  },
  {
    icon: <Calendar className="w-5 h-5" />,
    title: '日历视图',
    content: '支持日视图、周视图（可切换1/3/5/7天）、月视图。顶部"今天"按钮快速回到当天，前后箭头逐页翻动。周/日视图自动滚动到当前时间附近。',
  },
  {
    icon: <Pencil className="w-5 h-5" />,
    title: '事件操作',
    content: '点击"新建"按钮或 Ctrl+N 创建事件；点击事件块弹出快速编辑器；双击打开完整编辑弹窗；拖拽事件块移动时间；拖拽上下边缘调整时长（15分钟吸附）；右键事件块打开上下文菜单。',
  },
  {
    icon: <Upload className="w-5 h-5" />,
    title: '课程导入',
    content: '三步向导从山东大学教务系统导入课程表.xls文件，自动解析课表生成事件链和全部课程事件。支持20周排课，多节连排自动合并。',
  },
  {
    icon: <Link className="w-5 h-5" />,
    title: '事件链',
    content: '将相关事件组成事件链，同一链内事件共享颜色标识。双击左侧链名快速定位第一个事件。可为链设置批量规则，按周模式自动创建或批量修改事件。',
  },
  {
    icon: <Folders className="w-5 h-5" />,
    title: '事件组',
    content: '按用途分组管理事件链和独立事件。支持创建/重命名/删除/排序/合并/复制组。导出组为.events文件，导入时自动检测时间冲突。',
  },
  {
    icon: <Tags className="w-5 h-5" />,
    title: '事件类型',
    content: '内置课程📚、考试📝、实验🔬三种类型，支持自定义类型。每种类型可配置专属属性字段（如课程有教室/教师/课序号），属性字段可自定义图标。',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: '批量规则',
    content: '创建模式：按星期几+周范围自动生成事件。修改模式：按位置查找事件并批量修改名称/描述/时间偏移。支持每周/单周/双周模式，执行前可预览。',
  },
  {
    icon: <ListTodo className="w-5 h-5" />,
    title: '待办视图',
    content: '右侧面板默认显示待办视图，分为置顶、重点事项、即将到来三个区域。拖拽排序，手动钉选事件。可调整各区域的时间范围。',
  },
  {
    icon: <Search className="w-5 h-5" />,
    title: '搜索',
    content: 'Ctrl+F 打开全局搜索：按事件名称、事件链名、类型名、属性值搜索，支持自然语言日期（今天/明天/本周），支持星期和时间筛选。',
  },
  {
    icon: <Bell className="w-5 h-5" />,
    title: '提醒通知',
    content: '多级预设提醒时刻：1周/3天/1天/6小时/2小时/30分/10分/5分/2分/准时。支持钉选常用时刻、自定义任意分钟数。浏览器通知自动弹出。',
  },
  {
    icon: <Keyboard className="w-5 h-5" />,
    title: '快捷键',
    content: 'Ctrl+N 新建 · Ctrl+C 复制 · Ctrl+X 剪切 · Ctrl+V 粘贴 · Ctrl+Z 撤销 · Ctrl+Y 重做 · Ctrl+F 搜索 · Ctrl+A 全选 · Delete 删除 · Escape 关闭弹窗',
  },
]

interface WelcomeGuideProps {
  onClose: () => void
}

export default function WelcomeGuide({ onClose }: WelcomeGuideProps) {
  const [visible, setVisible] = useState(true)

  const handleClose = () => {
    setVisible(false)
    try { localStorage.setItem('hasSeenWelcomeGuide', 'true') } catch {}
    setTimeout(() => onClose(), 200)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-500" />
              欢迎使用时间规划器
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">现代化大学生日程管理工具</p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - scrollable card grid */}
        <div className="overflow-y-auto px-6 py-5 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CARDS.map((card, i) => (
              <Card key={i} icon={card.icon} title={card.title}>
                {card.content}
              </Card>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-center px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-blue-600/20"
          >
            开始使用
          </button>
        </div>
      </div>
    </div>
  )
}
