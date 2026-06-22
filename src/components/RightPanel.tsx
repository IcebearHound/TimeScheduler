/**
 * 右侧面板 - 改动即保存，顶部色条显示可切换事件链
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Clock, MapPin, User, BookOpen, Star, Bell, Link, PanelRightClose, ChevronDown, ChevronRight, Plus, Settings, Pencil, X } from 'lucide-react'
import useUIStore from '../stores/uiStore'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import TodoView from './TodoView'
import ReminderQuickPicker from './EventForm/ReminderQuickPicker'
import TimeEditPopover from './EventForm/TimeEditPopover'
import { scrollToEventBlock } from '../utils/scrollTarget'

const PROP_ICON_MAP: Record<string, React.ReactNode> = {
  MapPin: <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-300 flex-shrink-0" />,
  User: <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-300 flex-shrink-0" />,
  BookOpen: <BookOpen className="w-3.5 h-3.5 text-slate-400 dark:text-slate-300 flex-shrink-0" />,
  Clock: <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-300 flex-shrink-0" />,
  Bell: <Bell className="w-3.5 h-3.5 text-slate-400 dark:text-slate-300 flex-shrink-0" />,
  Link: <Link className="w-3.5 h-3.5 text-slate-400 dark:text-slate-300 flex-shrink-0" />,
  Star: <Star className="w-3.5 h-3.5 text-slate-400 dark:text-slate-300 flex-shrink-0" />,
}

const FIELD_LABELS: Record<string, string> = {
  location: '地点', teacher: '授课老师', courseCode: '课序号',
  examForm: '考试形式', supervisor: '监考老师',
  labTeacher: '实验指导老师', labContent: '实验内容',
  notes: '备注',
}

const CN_TO_EN: Record<string, string> = {
  '地点': 'location', '授课老师': 'teacher', '课序号': 'courseCode',
  '考试形式': 'examForm', '监考老师': 'supervisor',
  '实验指导老师': 'labTeacher', '实验内容': 'labContent',
}

export default function RightPanel() {
  const selectedEventId = useUIStore((s) => s.selectedEventId)
  const setSelectedEvent = useUIStore((s) => s.setSelectedEvent)
  const setIsRightPanelOpen = useUIStore((s) => s.setIsRightPanelOpen)
  const setOpenPopoverEventId = useUIStore((s) => s.setOpenPopoverEventId)
  const setCurrentDate = useUIStore((s) => s.setCurrentDate)
  const setIsTypeManagerOpen = useUIStore((s) => s.setIsTypeManagerOpen)
  const setFlashEventId = useUIStore((s) => s.setFlashEventId)
  const events = useEventStore((s) => s.events)
  const event = selectedEventId ? events.get(selectedEventId) : undefined
  const eventStore = useEventStore.getState()
  const chain = event ? eventStore.getEventChain(event.chainId) : undefined
  const type = event ? eventStore.getEventType(event.typeId) : undefined
  const groups = useEventGroupStore((s) => s.groups)
  const allChains = useEventStore((s) => Array.from(s.eventChains.values()))
  const eventGroup = event ? Array.from(groups.values()).find(g => g.eventIds.includes(event.id)) : undefined
  const chainGroup = event?.chainId ? Array.from(groups.values()).find(g => g.eventChainIds.includes(event.chainId)) : undefined
  const displayGroup = eventGroup || chainGroup
  const allTypes = useEventStore((s) => Array.from(s.eventTypes.values()))
  const getEventType = useEventStore((s) => s.getEventType)

  const [editName, setEditName] = useState('')
  const [editProps, setEditProps] = useState<Record<string, string>>({})
  const [editTypeId, setEditTypeId] = useState('')
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [editReminders, setEditReminders] = useState(event?.reminders || [])
  const [showTimeEdit, setShowTimeEdit] = useState(false)
  const [editStartTime, setEditStartTime] = useState(event?.startTime || new Date())
  const [editEndTime, setEditEndTime] = useState(event?.endTime || new Date())
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [newPropName, setNewPropName] = useState('')
  const toggleSection = (key: string) => setCollapsedSections(prev => {
    const n = new Set(prev)
    if (n.has(key)) n.delete(key); else n.add(key)
    return n
  })
  const timeEditRef = useRef<HTMLDivElement>(null)
  const typePickerRef = useRef<HTMLDivElement>(null)
  const metroBarRef = useRef<HTMLDivElement>(null)
  const metroButtonRefs = useRef<Map<string, HTMLElement>>(new Map())
  const tooltipTimer = useRef(0)
  const [hoveredMetroEventId, setHoveredMetroEventId] = useState<string | null>(null)

  // 事件类型推荐的属性字段 — 从事件类型的 propertyFields 读取
  const propFields: { field: string; icon?: string }[] = (() => {
    if (type?.propertyFields && type.propertyFields.length > 0) {
      return type.propertyFields.map(f => {
        const name = typeof f === 'string' ? f : f.name
        const icon = typeof f === 'string' ? undefined : f.icon
        return { field: CN_TO_EN[name] || name, icon }
      })
    }
    return []
  })()

  useEffect(() => {
    if (event) {
      setEditName(event.name)
      // 将中英文混存的属性统一转为英文键
      const raw = (event.properties as Record<string, string>) || {}
      const mapped: Record<string, string> = {}
      for (const [cn, en] of Object.entries(CN_TO_EN)) {
        if (raw[cn] != null) mapped[en] = raw[cn]
        else if (raw[en] != null) mapped[en] = raw[en]
      }
      for (const [k, v] of Object.entries(raw)) {
        if (!Object.values(CN_TO_EN).includes(k) && !(k in CN_TO_EN)) mapped[k] = v
      }
      setEditProps(mapped)
      setEditTypeId(event.typeId)
      setEditReminders(event.reminders || [])
      setEditStartTime(new Date(event.startTime))
      setEditEndTime(new Date(event.endTime))
    }
  }, [selectedEventId, event?.startTime?.getTime(), event?.endTime?.getTime()])

  // 当事件类型被外部修改时（如右键菜单），同步 editTypeId
  useEffect(() => {
    if (event && event.typeId !== editTypeId) {
      setEditTypeId(event.typeId)
    }
  }, [event?.typeId])

  // Close type picker on click outside
  useEffect(() => {
    if (!showTypePicker) return
    const handler = (e: MouseEvent) => {
      if (typePickerRef.current && !typePickerRef.current.contains(e.target as Node)) setShowTypePicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTypePicker])

  useEffect(() => {
    if (!showTimeEdit) return
    const handler = (e: MouseEvent) => {
      if (timeEditRef.current && !timeEditRef.current.contains(e.target as Node)) setShowTimeEdit(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTimeEdit])

  useEffect(() => {
    if (!selectedEventId || !chain) return
    const el = metroButtonRefs.current.get(selectedEventId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [selectedEventId, chain?.id])

  // 自动保存
  const save = useCallback(() => {
    const current = useEventStore.getState().getEvent(selectedEventId!)
    if (!current || !editName.trim()) return
    const sameTime = current.startTime.getTime() === editStartTime.getTime() && current.endTime.getTime() === editEndTime.getTime()
    const sameName = current.name === editName
    const sameType = current.typeId === editTypeId
    const sameReminders = JSON.stringify(current.reminders || []) === JSON.stringify(editReminders)
    const sameProps = JSON.stringify(current.properties || {}) === JSON.stringify(editProps)
    if (sameTime && sameName && sameType && sameReminders && sameProps) return
    useEventStore.getState().updateEvent(selectedEventId!, {
      name: editName, properties: editProps, typeId: editTypeId,
      reminders: editReminders,
      startTime: editStartTime, endTime: editEndTime,
    })
  }, [editName, editProps, editTypeId, editReminders, editStartTime, editEndTime, selectedEventId])

  useEffect(() => {
    const t = setTimeout(save, 400)
    return () => clearTimeout(t)
  }, [save])

  if (!event) {
    return <TodoView />
  }

  const barColor = chain?.color || event.color || '#3B82F6'

  return (
    <div className="w-[min(22vw,20rem)] bg-white/90 dark:bg-slate-900/90 border-l border-slate-200/60 dark:border-slate-800/60 overflow-y-auto flex flex-col">
      {/* 顶部地铁线路图 — 事件链各事件横向排列 */}
      {chain && (() => {
        const ce = eventStore.getEventsByChain(chain.id)
        const sorted = [...ce].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        if (sorted.length === 0) {
          return <div className="flex-shrink-0 h-8 flex items-center px-3 text-xs text-white" style={{ backgroundColor: barColor }}><Link className="w-3 h-3 mr-1.5" />{chain.name} · 无事件</div>
        }
        return (
          <div ref={metroBarRef} className="flex-shrink-0 overflow-x-auto no-scrollbar" style={{ backgroundColor: barColor }}
            onWheel={(e) => {
              e.preventDefault()
              if (metroBarRef.current) {
                metroBarRef.current.scrollLeft += e.deltaY * 0.3
              }
            }}
            onMouseMove={(e) => {
              if (tooltipTimer.current) return
              tooltipTimer.current = window.setTimeout(() => {
                tooltipTimer.current = 0
                const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
                const btn = target?.closest('button[data-metro-id]') as HTMLElement | null
                setHoveredMetroEventId(btn?.dataset.metroId || null)
              }, 80)
            }}
            onMouseLeave={() => {
              if (tooltipTimer.current) { clearTimeout(tooltipTimer.current); tooltipTimer.current = 0 }
              setHoveredMetroEventId(null)
            }}
          >
            <div className="flex items-center min-w-full">
              {sorted.map((evt, idx) => {
                const ia = evt.id === selectedEventId
                const t = eventStore.getEventType(evt.typeId)
                const typeColor = evt.isHighlight ? '#facc15' : (t?.color || barColor)
                const altBg = ia ? 'bg-white/25' : idx % 2 === 0 ? 'bg-white/10' : 'bg-white/[0.06]'
                return (
                  <React.Fragment key={evt.id}>
                    {idx > 0 && <span className="w-px bg-white/20 self-stretch flex-shrink-0" />}
                    <button
                      data-metro-id={evt.id}
                      ref={(el) => {
                        if (el) metroButtonRefs.current.set(evt.id, el)
                        else metroButtonRefs.current.delete(evt.id)
                      }}
                      onClick={() => {
                        scrollToEventBlock(evt.id)
                        setFlashEventId(evt.id)
                        setCurrentDate(new Date(evt.startTime))
                        setSelectedEvent(evt.id)
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] whitespace-nowrap flex-shrink-0 border-l-2 transition-colors ${altBg} ${ia ? 'font-bold' : 'hover:bg-white/20'}`}
                      style={{ color: 'white', borderLeftColor: typeColor }}>
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 border-2 ${ia ? 'bg-white border-white' : 'border-white/50'}`} />
                      <span className="truncate max-w-[80px]">{t?.emoji} {evt.name}</span>
                    </button>
                  </React.Fragment>
                )
              })}
            </div>
          </div>
        )
      })()}
      {!chain && (
        <div className="flex-shrink-0 h-8 flex items-center px-3 text-xs text-white" style={{ backgroundColor: barColor }}>
          <Link className="w-3 h-3 mr-1.5" />无事件链
        </div>
      )}
      {/* 地铁图悬停浮窗 */}
      {hoveredMetroEventId && (() => {
        const he = eventStore.events.get(hoveredMetroEventId)
        if (!he) return null
        const btnEl = metroButtonRefs.current.get(hoveredMetroEventId)
        if (!btnEl) return null
        const ht = eventStore.getEventType(he.typeId)
        const rect = btnEl.getBoundingClientRect()
        return (
          <div className="fixed z-[120] w-52 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-overlay border border-slate-200/60 dark:border-slate-700/60 pointer-events-none"
            style={{ top: rect.bottom + 4, left: Math.max(4, rect.left) }}>
            <div className="h-1 rounded-t-lg" style={{ backgroundColor: chain?.color || '#3B82F6' }} />
            <div className="p-2 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{ht?.emoji}</span>
                <span className="text-xs font-medium text-slate-900 dark:text-white truncate">{he.name}</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {new Date(he.startTime).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}{' '}
                {new Date(he.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                {' → '}
                {new Date(he.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {he.properties?.location && (
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{he.properties.location}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {/* 标题栏 + 折叠 */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">事件详情</span>
          <button onClick={() => setIsRightPanelOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400"><PanelRightClose className="w-3.5 h-3.5" /></button>
        </div>

        {/* 类型 + 重点 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative" ref={typePickerRef}>
            <button onClick={() => setShowTypePicker(!showTypePicker)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium hover:opacity-80 transition-opacity"
              style={{ backgroundColor: type?.color + '20', color: type?.color }}>
              {type?.emoji} {type?.name} <ChevronDown className="w-3 h-3" />
            </button>
            {showTypePicker && (
              <div className="absolute top-full left-0 mt-1 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-overlay border border-slate-200/60 dark:border-slate-700/60 min-w-36 max-h-48 overflow-y-auto z-50">
                {allTypes.map(t => {
                  const isCurrent = t.id === editTypeId
                  return (
                    <button key={t.id} onClick={() => { setEditTypeId(t.id); setShowTypePicker(false) }}
                      className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50 ${isCurrent ? 'font-medium' : 'text-slate-700 dark:text-slate-200'}`}
                      style={isCurrent ? { color: t.color } : {}}>
                      <span>{t.emoji}</span>
                      <span>{t.name}</span>
                    </button>
                  )
                })}
                <div className="border-t border-slate-100 dark:border-slate-800 my-0.5" />
                <button onClick={() => { setIsTypeManagerOpen(true); setShowTypePicker(false) }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <Plus className="w-3 h-3" /> 添加类型
                </button>
              </div>
            )}
          </div>
          {displayGroup && <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{displayGroup.emoji} {displayGroup.name}</span>}
          <button onClick={() => {
            if (!event) return
            eventStore.updateEvent(event.id, { isHighlight: !event.isHighlight })
          }}
            className={`p-1 rounded-lg transition-colors ${event.isHighlight ? 'text-yellow-400 hover:text-yellow-500' : 'text-slate-300 hover:text-yellow-400'}`}>
            <Star className={`w-4 h-4 ${event.isHighlight ? 'fill-yellow-400' : ''}`} />
          </button>
        </div>

        {/* 名称 */}
        <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
          className="w-full text-lg font-bold text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-accent-500 focus:outline-none pb-0.5 transition-colors" />

        {/* 时间 */}
        <div ref={timeEditRef}>
          <button onClick={() => toggleSection('time')}
            className="flex items-center gap-1.5 w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1">
            {collapsedSections.has('time') ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <Clock className="w-3.5 h-3.5" />
            时间
            {collapsedSections.has('time') && (
              <span className="text-[10px] truncate ml-1">
                {new Date(event.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </button>
          {!collapsedSections.has('time') && (
          <>
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-0.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => setShowTimeEdit(!showTimeEdit)}>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                {new Date(event.startTime).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300">
                {new Date(event.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} → {new Date(event.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            {showTimeEdit && (
              <div className="mt-2">
                <TimeEditPopover
                  startTime={editStartTime}
                  endTime={editEndTime}
                  onStartChange={(d) => { setEditStartTime(d); eventStore.updateEvent(selectedEventId!, { startTime: d, endTime: editEndTime }) }}
                  onEndChange={(d) => { setEditEndTime(d); eventStore.updateEvent(selectedEventId!, { startTime: editStartTime, endTime: d }) }}
                  onClose={() => setShowTimeEdit(false)}
                />
              </div>
            )}
          </>
          )}
        </div>

        {/* 提醒 */}
        <div>
          <button onClick={() => toggleSection('reminder')}
            className="flex items-center gap-1.5 w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1">
            {collapsedSections.has('reminder') ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <Bell className="w-3.5 h-3.5" />
            提醒
            {collapsedSections.has('reminder') && (
              <span className="text-[10px] text-slate-400 ml-1">
                {editReminders.filter(r => r.enabled).length > 0 ? `${editReminders.filter(r => r.enabled).length} 个` : '无'}
              </span>
            )}
          </button>
          {!collapsedSections.has('reminder') && (
            <ReminderQuickPicker reminders={editReminders} onChange={setEditReminders} />
          )}
        </div>

        {/* 属性 */}
        <div>
          <button onClick={() => toggleSection('properties')}
            className="flex items-center gap-1.5 w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1">
            {collapsedSections.has('properties') ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <Settings className="w-3.5 h-3.5" />
            属性
            {collapsedSections.has('properties') && (
              <span className="text-[10px] text-slate-400 ml-1">
                {(() => {
                  const customKeys = Object.keys(editProps).filter(k => !propFields.some(p => p.field === k) && !Object.values(CN_TO_EN).includes(k))
                  const total = propFields.length + customKeys.length
                  return `${total}项`
                })()}
              </span>
            )}
          </button>
          {!collapsedSections.has('properties') && (
          <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-1.5">
            {propFields.map(({ field, icon }) => (
            <div key={field} className="flex items-center gap-1.5">
              {icon && PROP_ICON_MAP[icon] ? <>{PROP_ICON_MAP[icon]}</> :
               field === 'location' ? <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> :
               field === 'teacher' || field === 'supervisor' || field === 'labTeacher' ? <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> :
               field === 'courseCode' || field === 'examForm' || field === 'labContent' ? <BookOpen className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> :
               <span className="w-3.5 h-3.5 flex-shrink-0 text-[10px] text-slate-400">{field[0]}</span>}
              <input type="text" value={editProps[field] || ''} onChange={e => setEditProps(p => ({ ...p, [field]: e.target.value }))}
                placeholder={FIELD_LABELS[field] || field}
                className="flex-1 text-sm text-slate-700 dark:text-slate-300 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-accent-500 focus:outline-none pb-0.5 transition-colors" />
            </div>
          ))}
          {/* 额外自定义属性 — 过滤掉已映射的类型属性键 */}
          {Object.keys(editProps).filter(k => !propFields.some(p => p.field === k) && !Object.values(CN_TO_EN).includes(k)).map(k => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 flex-shrink-0 text-[10px] text-slate-400 flex items-center justify-center">+</span>
              <input type="text" value={editProps[k] || ''} onChange={e => setEditProps(p => ({ ...p, [k]: e.target.value }))}
                placeholder={k}
                className="flex-1 text-sm text-slate-700 dark:text-slate-300 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-accent-500 focus:outline-none pb-0.5 transition-colors" />
              <button type="button" onClick={() => { const np = { ...editProps }; delete np[k]; setEditProps(np) }}
                className="text-slate-300 hover:text-red-400 flex-shrink-0 p-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {/* 添加新属性 */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="w-3.5 h-3.5 flex-shrink-0 text-[10px] text-blue-400 flex items-center justify-center">+</span>
            <input type="text" value={newPropName} onChange={e => setNewPropName(e.target.value)}
              placeholder="添加属性名..."
              className="flex-1 text-xs text-slate-500 dark:text-slate-400 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 focus:border-accent-500 focus:outline-none pb-0.5 transition-colors"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const v = newPropName.trim()
                  if (v && !(v in editProps)) { setEditProps(p => ({ ...p, [v]: '' })); setNewPropName('') }
                  e.preventDefault()
                }
              }} />
          </div>
        </div>
          )}
        </div>

        {/* 备注 */}
        <div>
          <button onClick={() => toggleSection('notes')}
            className="flex items-center gap-1.5 w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1">
            {collapsedSections.has('notes') ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <Pencil className="w-3.5 h-3.5" />
            备注
          </button>
          {!collapsedSections.has('notes') && (
            <textarea value={editProps.notes || ''} onChange={e => setEditProps(p => ({ ...p, notes: e.target.value }))} placeholder="备注" rows={2}
              className="w-full text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/10 rounded-lg p-2 border border-transparent hover:border-amber-300 dark:hover:border-amber-700 focus:border-amber-500 focus:outline-none resize-none transition-colors" />
          )}
        </div>

        {/* 事件链时间线 */}
        {chain && (() => {
          const ce = eventStore.getEventsByChain(chain.id)
          const sorted = [...ce].sort((a,b)=>new Date(a.startTime).getTime()-new Date(b.startTime).getTime())
          if (sorted.length === 0) return null
          return (
          <div>
            <button onClick={() => toggleSection('timeline')}
              className="flex items-center gap-1.5 w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1">
              {collapsedSections.has('timeline') ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <Link className="w-3.5 h-3.5" style={{color:chain.color}} />{chain.name} 时间线 ({sorted.length})
            </button>
            {!collapsedSections.has('timeline') && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
            <div className="relative pl-5 border-l-2 border-dotted ml-2" style={{ borderColor: chain.color + '60' }}>
              {sorted.map((evt, idx) => {
                const t = eventStore.getEventType(evt.typeId)
                const ia = evt.id === selectedEventId
                const isFirst = idx === 0
                const isLast = idx === sorted.length - 1
                return (
                  <button key={evt.id}
                    onClick={() => {
                      scrollToEventBlock(evt.id)
                      setFlashEventId(evt.id)
                      setCurrentDate(new Date(evt.startTime))
                      setSelectedEvent(evt.id)
                    }}
                    onDoubleClick={() => {
                      scrollToEventBlock(evt.id)
                      setFlashEventId(evt.id)
                      setCurrentDate(new Date(evt.startTime))
                      setSelectedEvent(evt.id)
                      setOpenPopoverEventId(evt.id)
                    }}
                    className={`relative w-full text-left py-2 ${!isLast ? 'pb-3' : ''}`}>
                    {/* 连接点 */}
                    <span className="absolute -left-[27px] top-2 w-3 h-3 rounded-full border-2 flex-shrink-0 z-10"
                      style={{ backgroundColor: ia ? chain.color : 'white', borderColor: chain.color, boxShadow: ia ? `0 0 6px ${chain.color}` : 'none' }} />
                    <div className={`rounded p-1.5 text-xs transition-colors ${ia ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-accent-200 dark:ring-accent-700' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{t?.emoji}</span>
                        <span className={`truncate flex-1 ${ia ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{evt.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 pl-5">
                        {new Date(evt.startTime).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}{' '}
                        {new Date(evt.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - {new Date(evt.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
            )}
          </div>
          )
        })()}
      </div>
    </div>
  )
}
