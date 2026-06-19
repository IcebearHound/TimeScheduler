/**
 * 事件右键菜单 — 重新设计布局
 * 第一区: 新建 / 复制 / 剪切 / 粘贴
 * 第二区: 修改类型 / 事件链 / 时长 / 属性 / 更多
 * 第三区: 标记重点 / 删除
 */
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Edit2, Copy, Scissors, Trash2, Star, ClipboardPaste, PlusSquare, Tag, ChevronRight, Link, Clock, Settings, Pin, MapPin, User, BookOpen } from 'lucide-react'
import { Event } from '../types/event'
import useEventStore from '../stores/eventStore'
import useUIStore from '../stores/uiStore'
import useEventGroupStore from '../stores/eventGroupStore'

interface EventContextMenuProps {
  event: Event
  position: { x: number; y: number }
  onClose: () => void
  onEdit: (event: Event) => void
}

const DURATION_PRESETS = [
  { label: '30分钟', minutes: 30 },
  { label: '1小时', minutes: 60 },
  { label: '1.5小时', minutes: 90 },
  { label: '2小时', minutes: 120 },
  { label: '3小时', minutes: 180 },
]

const FIELD_LABELS: Record<string, string> = {
  location: '地点', teacher: '授课老师', courseCode: '课序号',
  examForm: '考试形式', supervisor: '监考老师',
  labTeacher: '实验指导老师', labContent: '实验内容',
}

const PROP_ICONS: Record<string, React.ReactNode> = {
  location: <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />,
  teacher: <User className="w-3 h-3 text-slate-400 flex-shrink-0" />,
  courseCode: <BookOpen className="w-3 h-3 text-slate-400 flex-shrink-0" />,
  examForm: <BookOpen className="w-3 h-3 text-slate-400 flex-shrink-0" />,
  supervisor: <User className="w-3 h-3 text-slate-400 flex-shrink-0" />,
  labTeacher: <User className="w-3 h-3 text-slate-400 flex-shrink-0" />,
  labContent: <BookOpen className="w-3 h-3 text-slate-400 flex-shrink-0" />,
}

const CN_TO_EN: Record<string, string> = {
  '地点': 'location', '授课老师': 'teacher', '课序号': 'courseCode',
  '考试形式': 'examForm', '监考老师': 'supervisor',
  '实验指导老师': 'labTeacher', '实验内容': 'labContent',
}

type SubMenu = 'type' | 'chain' | 'duration' | 'properties' | null

export default function EventContextMenu({ event, position, onClose, onEdit }: EventContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const deleteEvent = useEventStore((s) => s.deleteEvent)
  const updateEvent = useEventStore((s) => s.updateEvent)
  const copyEvent = useEventStore((s) => s.copyEvent)
  const cutEvent = useEventStore((s) => s.cutEvent)
  const pasteEvent = useEventStore((s) => s.pasteEvent)
  const clipboardEvent = useEventStore((s) => s.clipboardEvent)
  const eventTypes = useEventStore((s) => Array.from(s.eventTypes.values()))
  const getEventType = useEventStore((s) => s.getEventType)
  const allChains = useEventStore((s) => Array.from(s.eventChains.values()))

  const [activeSub, setActiveSub] = useState<SubMenu>(null)

  // 属性编辑临时状态
  const [propValues, setPropValues] = useState<Record<string, string>>({})

  const currentType = getEventType(event.typeId)
  const currentChain = event.chainId ? useEventStore.getState().getEventChain(event.chainId) : undefined

  // 当前类型的属性字段 — 从事件类型的 propertyFields 读取
  const propFields = (() => {
    if (currentType?.propertyFields && currentType.propertyFields.length > 0) {
      return currentType.propertyFields.map(f => {
        const name = typeof f === 'string' ? f : f.name
        return CN_TO_EN[name] || name
      })
    }
    return []
  })()

  // 初始化属性值
  useEffect(() => {
    const vals: Record<string, string> = {}
    propFields.forEach(f => { vals[f] = (event.properties as any)[f] || '' })
    setPropValues(vals)
  }, [event.typeId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const pos = {
    left: Math.min(position.x, window.innerWidth - 280),
    top: Math.min(position.y, window.innerHeight - 420),
  }

  const handleDelete = () => {
    deleteEvent(event.id)
    useUIStore.getState().addToast(`已删除「${event.name}」· Ctrl+Z 撤回`, '撤回', () => useEventStore.getState().undo())
    onClose()
  }

  const handleDuplicate = () => {
    const store = useEventStore.getState()
    const gid = useEventGroupStore.getState().ensureActiveGroup()
    store.addEvent({
      name: `${event.name} (副本)`,
      description: event.description || '',
      startTime: new Date(event.startTime),
      endTime: new Date(event.endTime),
      chainId: event.chainId || '',
      typeId: event.typeId,
      reminders: event.reminders,
      properties: { ...event.properties },
      isHighlight: false,
      priority: 0,
    })
    onClose()
  }

  const handleChangeType = (typeId: string) => {
    updateEvent(event.id, { typeId })
    onClose()
  }

  const handleChangeChain = (chainId: string) => {
    updateEvent(event.id, { chainId: chainId || '' })
    onClose()
  }

  const handleChangeDuration = (minutes: number) => {
    const st = new Date(event.startTime)
    const ed = new Date(st.getTime() + minutes * 60000)
    updateEvent(event.id, { startTime: st, endTime: ed })
    onClose()
  }

  const handleSaveProps = () => {
    const updated: Record<string, any> = { ...event.properties }
    propFields.forEach(f => {
      if (propValues[f]) updated[f] = propValues[f]
      else delete updated[f]
    })
    updateEvent(event.id, { properties: updated })
    onClose()
  }

  // 使用 portal 渲染到 body，避免被事件块遮挡
  const menuEl = (
    <div ref={menuRef} className="fixed bg-white dark:bg-slate-800 rounded-lg shadow-2xl z-[9999] border border-slate-200 dark:border-slate-700 min-w-44"
      style={{ left: pos.left, top: pos.top }}>
      {/* ===== 第一区: 基本操作 ===== */}
      <button onClick={handleDuplicate}
        className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm rounded-t-lg">
        <PlusSquare className="w-4 h-4 text-purple-500" /> 新建
      </button>
      <button onClick={() => { copyEvent(event.id); onClose() }}
        className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm">
        <Copy className="w-4 h-4 text-green-500" /> 复制
      </button>
      <button onClick={() => { cutEvent(event.id); onClose() }}
        className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm">
        <Scissors className="w-4 h-4 text-amber-500" /> 剪切
      </button>
      {clipboardEvent && (
        <button onClick={() => { pasteEvent(event.startTime); onClose() }}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm">
          <ClipboardPaste className="w-4 h-4 text-purple-500" /> 粘贴到此处
        </button>
      )}

      <div className="border-t border-slate-200 dark:border-slate-700 my-0.5" />

      {/* ===== 第二区: 编辑操作 ===== */}
      {/* 修改类型 */}
      <div className="relative" onMouseEnter={() => setActiveSub('type')} onMouseLeave={() => setActiveSub(null)}>
        <button className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm justify-between">
          <span className="flex items-center gap-3"><Tag className="w-4 h-4 text-cyan-500" /> 修改类型</span>
          <span className="text-xs text-slate-400 flex items-center gap-1">{currentType?.emoji} {currentType?.name} <ChevronRight className="w-3 h-3" /></span>
        </button>
        {activeSub === 'type' && (
          <div className="absolute left-full top-0 ml-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 min-w-36 max-h-48 overflow-y-auto z-[10000]">
            {eventTypes.map(t => (
                <button key={t.id} onClick={() => handleChangeType(t.id)}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 ${t.id === event.typeId ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-200'}`}>
                  <span>{t.emoji}</span>
                  <span>{t.name}</span>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* 事件链 */}
      <div className="relative" onMouseEnter={() => setActiveSub('chain')} onMouseLeave={() => setActiveSub(null)}>
        <button className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm justify-between">
          <span className="flex items-center gap-3"><Link className="w-4 h-4 text-indigo-500" /> 事件链</span>
          <span className="text-xs text-slate-400 flex items-center gap-1">{currentChain?.name || '无'} <ChevronRight className="w-3 h-3" /></span>
        </button>
        {activeSub === 'chain' && (
          <div className="absolute left-full top-0 ml-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 min-w-36 max-h-48 overflow-y-auto z-[10000]">
            <button onClick={() => handleChangeChain('')}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 ${!event.chainId ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-200'}`}>
              无（独立事件）
            </button>
            {allChains.map(c => (
              <button key={c.id} onClick={() => handleChangeChain(c.id)}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 ${c.id === event.chainId ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-200'}`}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 时长 */}
      <div className="relative" onMouseEnter={() => setActiveSub('duration')} onMouseLeave={() => setActiveSub(null)}>
        <button className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm justify-between">
          <span className="flex items-center gap-3"><Clock className="w-4 h-4 text-orange-500" /> 时长</span>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            {(() => {
              const d = Math.round((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / 60000)
              return d >= 60 ? `${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}min` : ''}` : `${d}min`
            })()}
            <ChevronRight className="w-3 h-3" />
          </span>
        </button>
        {activeSub === 'duration' && (
          <div className="absolute left-full top-0 ml-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 min-w-28 z-[10000]">
            {DURATION_PRESETS.map(p => (
              <button key={p.minutes} onClick={() => handleChangeDuration(p.minutes)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 属性 */}
      <div className="relative" onMouseEnter={() => setActiveSub('properties')} onMouseLeave={() => setActiveSub(null)}>
        <button className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm justify-between">
          <span className="flex items-center gap-3"><Settings className="w-4 h-4 text-slate-500" /> 属性</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
        </button>
        {activeSub === 'properties' && (
          <div className="absolute left-full top-0 ml-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 min-w-48 p-2 z-[10000]" onClick={e => e.stopPropagation()}>
            {propFields.length === 0 && <div className="text-xs text-slate-400 px-2 py-1">无预设属性</div>}
            {propFields.map(f => (
              <div key={f} className="mb-1.5">
                <label className="text-[10px] text-slate-400 flex items-center gap-1 mb-0.5">
                  {PROP_ICONS[f]}
                  <span>{FIELD_LABELS[f] || f}</span>
                </label>
                <input type="text" value={propValues[f] || ''} onChange={e => setPropValues(p => ({ ...p, [f]: e.target.value }))}
                  className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            ))}
            <button onClick={handleSaveProps}
              className="w-full mt-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
              保存属性
            </button>
          </div>
        )}
      </div>

      {/* 更多 */}
      <button onClick={() => { onEdit(event); onClose() }}
        className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm">
        <Edit2 className="w-4 h-4 text-blue-500" /> 更多
      </button>

      <div className="border-t border-slate-200 dark:border-slate-700 my-0.5" />

      {/* ===== 第三区: 标记/删除 ===== */}
      <button onClick={() => { updateEvent(event.id, { pinned: !event.pinned }); onClose() }}
        className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm">
        <Pin className="w-4 h-4" style={{ color: event.pinned ? '#3B82F6' : undefined }} /> {event.pinned ? '取消置顶' : '置顶'}
      </button>
      <button onClick={() => { updateEvent(event.id, { isHighlight: !event.isHighlight }); onClose() }}
        className="flex items-center gap-3 w-full px-4 py-2.5 text-amber-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm">
        <Star className="w-4 h-4" /> {event.isHighlight ? '取消重点' : '标记重点'}
      </button>
      <button onClick={handleDelete}
        className="flex items-center gap-3 w-full px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm rounded-b-lg">
        <Trash2 className="w-4 h-4" /> 删除
      </button>
    </div>
  )

  return createPortal(menuEl, document.body)
}
