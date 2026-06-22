/**
 * 事件右键菜单 — 重新设计布局
 * 第一区: 新建 / 复制 / 剪切 / 粘贴
 * 第二区: 修改类型 / 事件链 / 时长 / 属性 / 更多
 * 第三区: 标记重点 / 删除
 */
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Edit2, Copy, Scissors, Trash2, Star, ClipboardPaste, PlusSquare, Tag, ChevronRight, Link, Clock, Settings, Pin, Bell, MapPin, User, BookOpen } from 'lucide-react'
import { Event } from '../types/event'
import useEventStore from '../stores/eventStore'
import useUIStore from '../stores/uiStore'
import useEventGroupStore from '../stores/eventGroupStore'
import ReminderQuickPicker from './EventForm/ReminderQuickPicker'

interface EventContextMenuProps {
  event: Event
  position: { x: number; y: number }
  anchorRef?: React.RefObject<HTMLElement>
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

type SubMenu = 'type' | 'chain' | 'duration' | 'properties' | 'reminder' | null

export default function EventContextMenu({ event, position, anchorRef, onClose, onEdit }: EventContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
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
  const [newPropName, setNewPropName] = useState('')

  const toggleSubMenu = (key: SubMenu) => {
    setActiveSub(prev => prev === key ? null : key)
  }

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

  // 初始化属性值：中英文键统一转为英文键 + 保留自定义属性
  useEffect(() => {
    const vals: Record<string, string> = {}
    const raw = (event.properties as Record<string, string>) || {}
    // 类型属性 → 英文键
    propFields.forEach(f => {
      if (raw[f] != null) vals[f] = raw[f]
      else if (raw[CN_TO_EN[f]]) vals[f] = raw[CN_TO_EN[f]]
    })
    // 自定义属性（不在类型属性中、不在 CN_TO_EN 映射内）
    for (const [k, v] of Object.entries(raw)) {
      if (!propFields.includes(k) && !Object.values(CN_TO_EN).includes(k) && !(k in CN_TO_EN)) vals[k] = v
    }
    setPropValues(vals)
  }, [event.typeId, event.id])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onCloseRef.current()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 跟随事件滚动（直接操作 DOM 避免 state 延迟）
  useEffect(() => {
    const el = menuRef.current
    if (!el || !anchorRef?.current) return
    let raf = 0
    const updatePos = () => {
      const r = anchorRef.current?.getBoundingClientRect()
      if (!r) return
      el.style.left = `${Math.min(r.right + 4, window.innerWidth - 280)}px`
      el.style.top = `${Math.min(r.top, window.innerHeight - 420)}px`
    }
    updatePos()
    let scrollEl: HTMLElement | null = anchorRef.current.parentElement
    while (scrollEl) {
      const s = getComputedStyle(scrollEl)
      if (/(auto|scroll)/.test(s.overflow + s.overflowY)) break
      scrollEl = scrollEl.parentElement
    }
    if (!scrollEl) return
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(updatePos)
    }
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      scrollEl.scrollTop += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      scrollEl.removeEventListener('scroll', onScroll)
      el.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

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
    // 保存类型属性和自定义属性
    for (const [k, v] of Object.entries(propValues)) {
      if (v) updated[k] = v
      else delete updated[k]
    }
    updateEvent(event.id, { properties: updated })
    onClose()
  }

  const handleSaveReminders = (reminders: typeof event.reminders) => {
    updateEvent(event.id, { reminders })
  }

  // 使用 portal 渲染到 body，避免被事件块遮挡
  const menuEl = (
     <div ref={menuRef} className="fixed bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-overlay z-[9999] border border-slate-200/60 dark:border-slate-700/60 min-w-44 animate-popover-in"
      style={{ left: Math.min(position.x, window.innerWidth - 280), top: Math.min(position.y, window.innerHeight - 420) }}>
      {/* ===== 第一区: 基本操作 ===== */}
      <button onClick={handleDuplicate}
        className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm rounded-t-lg">
        <PlusSquare className="w-4 h-4 text-purple-500" /> 新建
      </button>
      <button onClick={() => { copyEvent(event.id); onClose() }}
        className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm">
        <Copy className="w-4 h-4 text-green-500" /> 复制
      </button>
      <button onClick={() => { cutEvent(event.id); onClose() }}
        className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm">
        <Scissors className="w-4 h-4 text-amber-500" /> 剪切
      </button>
      {clipboardEvent && (
        <button onClick={() => { pasteEvent(event.startTime); onClose() }}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm">
          <ClipboardPaste className="w-4 h-4 text-purple-500" /> 粘贴到此处
        </button>
      )}

      <div className="border-t border-slate-100 dark:border-slate-800 my-0.5" />

      {/* ===== 第二区: 编辑操作 ===== */}
      {/* 修改类型 */}
      <div className="relative">
        <button onClick={() => toggleSubMenu('type')}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm justify-between">
          <span className="flex items-center gap-3"><Tag className="w-4 h-4 text-cyan-500" /> 修改类型</span>
          <span className="text-xs text-slate-400 flex items-center gap-1">{currentType?.emoji} {currentType?.name} <ChevronRight className="w-3 h-3" /></span>
        </button>
        {activeSub === 'type' && (
          <div className="absolute left-full top-0 ml-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200/60 dark:border-slate-700/60 min-w-36 max-h-48 overflow-y-auto z-[10000]">
            {eventTypes.map(t => (
                <button key={t.id} onClick={() => handleChangeType(t.id)}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50 ${t.id === event.typeId ? 'text-accent-600 dark:text-accent-400 font-medium' : 'text-slate-700 dark:text-slate-200'}`}>
                  <span>{t.emoji}</span>
                  <span>{t.name}</span>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* 事件链 */}
      <div className="relative">
        <button onClick={() => toggleSubMenu('chain')}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm justify-between">
          <span className="flex items-center gap-3"><Link className="w-4 h-4 text-indigo-500" /> 事件链</span>
          <span className="text-xs text-slate-400 flex items-center gap-1">{currentChain?.name || '无'} <ChevronRight className="w-3 h-3" /></span>
        </button>
        {activeSub === 'chain' && (
          <div className="absolute left-full top-0 ml-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200/60 dark:border-slate-700/60 min-w-36 max-h-48 overflow-y-auto z-[10000]">
            <button onClick={() => handleChangeChain('')}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50 ${!event.chainId ? 'text-accent-600 dark:text-accent-400 font-medium' : 'text-slate-700 dark:text-slate-200'}`}>
              无（独立事件）
            </button>
            {allChains.map(c => (
              <button key={c.id} onClick={() => handleChangeChain(c.id)}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50 ${c.id === event.chainId ? 'text-accent-600 dark:text-accent-400 font-medium' : 'text-slate-700 dark:text-slate-200'}`}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 时长 */}
      <div className="relative">
        <button onClick={() => toggleSubMenu('duration')}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm justify-between">
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
          <div className="absolute left-full top-0 ml-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200/60 dark:border-slate-700/60 min-w-28 z-[10000]">
            {DURATION_PRESETS.map(p => (
              <button key={p.minutes} onClick={() => handleChangeDuration(p.minutes)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 提醒 */}
      <div className="relative">
        <button onClick={() => toggleSubMenu('reminder')}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm justify-between">
          <span className="flex items-center gap-3"><Bell className="w-4 h-4 text-amber-500" /> 提醒</span>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            {event.reminders.filter(r => r.enabled).length > 0 ? `${event.reminders.filter(r => r.enabled).length} 个` : '无'}
            <ChevronRight className="w-3 h-3" />
          </span>
        </button>
        {activeSub === 'reminder' && (
          <div className="absolute left-full top-0 ml-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200/60 dark:border-slate-700/60 z-[10000]" onClick={e => e.stopPropagation()}>
            <ReminderQuickPicker reminders={event.reminders} onChange={handleSaveReminders} compact />
          </div>
        )}
      </div>

      {/* 属性 */}
      <div className="relative">
        <button onClick={() => toggleSubMenu('properties')}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm justify-between">
          <span className="flex items-center gap-3"><Settings className="w-4 h-4 text-slate-500" /> 属性</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
        </button>
        {activeSub === 'properties' && (
          <div className="absolute left-full top-0 ml-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200/60 dark:border-slate-700/60 min-w-52 p-2 z-[10000]" onClick={e => e.stopPropagation()}>
            {[...propFields, ...Object.keys(propValues).filter(k => !propFields.includes(k))].map(f => {
              const isCustom = !propFields.includes(f)
              return (
                <div key={f} className="mb-1.5">
                  <label className="text-[10px] text-slate-400 flex items-center gap-1 mb-0.5">
                    {PROP_ICONS[f]}
                    <span>{FIELD_LABELS[f] || f}</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input type="text" value={propValues[f] || ''} onChange={e => setPropValues(p => ({ ...p, [f]: e.target.value }))}
                      className="flex-1 px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent-500/40" />
                    {isCustom && (
                      <button type="button" onClick={() => { const np = { ...propValues }; delete np[f]; setPropValues(np) }}
                        className="text-slate-300 hover:text-red-400 flex-shrink-0">&times;</button>
                    )}
                  </div>
                </div>
              )
            })}
            {propFields.length === 0 && Object.keys(propValues).length === 0 && <div className="text-xs text-slate-400 px-2 py-1">无属性</div>}
            {/* 添加新属性 */}
            <div className="border-t border-slate-200/60 dark:border-slate-600/60 pt-1.5 mt-1">
              <div className="flex items-center gap-1">
                <input type="text" value={newPropName} onChange={e => setNewPropName(e.target.value)}
                  placeholder="添加属性名..."
                  className="flex-1 px-2 py-1 text-xs border border-dashed border-slate-300 dark:border-slate-600 rounded bg-transparent text-slate-500 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-accent-500/40"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const v = newPropName.trim()
                      if (v && !(v in propValues)) { setPropValues(p => ({ ...p, [v]: '' })); setNewPropName('') }
                      e.preventDefault()
                    }
                  }} />
              </div>
            </div>
            <button onClick={handleSaveProps}
              className="w-full mt-1.5 px-3 py-1 text-xs bg-accent-600 hover:bg-accent-700 shadow-sm shadow-accent-600/20 text-white rounded">
              保存属性
            </button>
          </div>
        )}
      </div>

      {/* 更多 */}
      <button onClick={() => { onEdit(event); onClose() }}
        className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm">
        <Edit2 className="w-4 h-4 text-blue-500" /> 更多
      </button>

      <div className="border-t border-slate-100 dark:border-slate-800 my-0.5" />

      {/* ===== 第三区: 标记/删除 ===== */}
      <button onClick={() => { updateEvent(event.id, { pinned: !event.pinned }); onClose() }}
        className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm">
        <Pin className="w-4 h-4" style={{ color: event.pinned ? '#3B82F6' : undefined }} /> {event.pinned ? '取消置顶' : '置顶'}
      </button>
      <button onClick={() => { updateEvent(event.id, { isHighlight: !event.isHighlight }); onClose() }}
        className="flex items-center gap-3 w-full px-4 py-2.5 text-amber-600 dark:text-amber-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm">
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
