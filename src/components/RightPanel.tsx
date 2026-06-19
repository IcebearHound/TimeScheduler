/**
 * 右侧面板 - 改动即保存，顶部色条显示可切换事件链
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Clock, MapPin, User, BookOpen, Star, Bell, Link, PanelRightClose, ChevronDown, Plus } from 'lucide-react'
import useUIStore from '../stores/uiStore'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import TodoView from './TodoView'

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
  const typePickerRef = useRef<HTMLDivElement>(null)

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
      setEditProps(event.properties as Record<string, string> || {})
      setEditTypeId(event.typeId)
    }
  }, [selectedEventId])

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

  // 自动保存
  const save = useCallback(() => {
    if (!event || !editName.trim()) return
    eventStore.updateEvent(selectedEventId!, {
      name: editName, properties: editProps, typeId: editTypeId,
    })
  }, [editName, editProps, editTypeId, selectedEventId, event])

  useEffect(() => {
    const t = setTimeout(save, 400)
    return () => clearTimeout(t)
  }, [save])

  if (!event) {
    return <TodoView />
  }

  const barColor = chain?.color || event.color || '#3B82F6'

  return (
    <div className="w-[min(22vw,20rem)] bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 overflow-y-auto flex flex-col">
      {/* 顶部地铁线路图 — 事件链各事件横向排列 */}
      {chain && (() => {
        const ce = eventStore.getEventsByChain(chain.id)
        const sorted = [...ce].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        if (sorted.length === 0) {
          return <div className="flex-shrink-0 h-8 flex items-center px-3 text-xs text-white" style={{ backgroundColor: barColor }}><Link className="w-3 h-3 mr-1.5" />{chain.name} · 无事件</div>
        }
        return (
          <div className="flex-shrink-0 overflow-x-auto" style={{ backgroundColor: barColor + '20' }}>
            <div className="flex items-stretch min-w-full" style={{ backgroundColor: barColor }}>
              {sorted.map((evt, idx) => {
                const ia = evt.id === selectedEventId
                const t = eventStore.getEventType(evt.typeId)
                return (
                  <button key={evt.id}
                    onClick={() => setSelectedEvent(evt.id)}
                    className={`flex items-center gap-1 px-2 py-1.5 text-[10px] whitespace-nowrap transition-colors flex-shrink-0 ${ia ? 'bg-white/20 font-bold' : 'hover:bg-white/10'}`}
                    style={{ color: 'white' }}>
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 border-2 ${ia ? 'bg-white border-white' : 'border-white/50'}`} />
                    <span className="truncate max-w-[80px]">{t?.emoji} {evt.name}</span>
                    {idx < sorted.length - 1 && <span className="w-2 h-px bg-white/30 mx-0.5 flex-shrink-0" />}
                  </button>
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

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {/* 标题栏 + 折叠 */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">事件详情</span>
          <button onClick={() => setIsRightPanelOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400"><PanelRightClose className="w-3.5 h-3.5" /></button>
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
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 min-w-36 max-h-48 overflow-y-auto z-50">
                {allTypes.map(t => {
                  const isCurrent = t.id === editTypeId
                  return (
                    <button key={t.id} onClick={() => { setEditTypeId(t.id); setShowTypePicker(false) }}
                      className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 ${isCurrent ? 'font-medium' : 'text-slate-700 dark:text-slate-200'}`}
                      style={isCurrent ? { color: t.color } : {}}>
                      <span>{t.emoji}</span>
                      <span>{t.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <button onClick={() => setIsTypeManagerOpen(true)}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-blue-500 transition-colors"
            title="管理事件类型">
            <Plus className="w-3.5 h-3.5" />
          </button>
          {displayGroup && <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{displayGroup.emoji} {displayGroup.name}</span>}
          {event.isHighlight && <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />}
        </div>

        {/* 名称 */}
        <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
          className="w-full text-lg font-bold text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 focus:outline-none pb-0.5 transition-colors" />

        {/* 时间 */}
        <div className="p-2 bg-slate-50 dark:bg-slate-700/30 rounded-lg space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            {new Date(event.startTime).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 ml-5">
            {new Date(event.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} → {new Date(event.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* 属性 — 按事件类型动态显示 */}
        <div className="space-y-1.5">
          {propFields.map(({ field, icon }) => (
            <div key={field} className="flex items-center gap-1.5">
              {icon && PROP_ICON_MAP[icon] ? <>{PROP_ICON_MAP[icon]}</> :
               field === 'location' ? <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> :
               field === 'teacher' || field === 'supervisor' || field === 'labTeacher' ? <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> :
               field === 'courseCode' || field === 'examForm' || field === 'labContent' ? <BookOpen className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> :
               <span className="w-3.5 h-3.5 flex-shrink-0 text-[10px] text-slate-400">{field[0]}</span>}
              <input type="text" value={editProps[field] || ''} onChange={e => setEditProps(p => ({ ...p, [field]: e.target.value }))}
                placeholder={FIELD_LABELS[field] || field}
                className="flex-1 text-sm text-slate-700 dark:text-slate-300 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 focus:outline-none pb-0.5 transition-colors" />
            </div>
          ))}
          {/* 额外自定义属性 — 与类型属性一致的展示方式 */}
          {Object.keys(editProps).filter(k => k !== 'notes' && !propFields.some(p => p.field === k)).map(k => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 flex-shrink-0 text-[10px] text-slate-400 flex items-center justify-center">+</span>
              <input type="text" value={editProps[k] || ''} onChange={e => setEditProps(p => ({ ...p, [k]: e.target.value }))}
                placeholder={k}
                className="flex-1 text-sm text-slate-700 dark:text-slate-300 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 focus:outline-none pb-0.5 transition-colors" />
            </div>
          ))}
        </div>

        {/* 备注 */}
        <textarea value={editProps.notes || ''} onChange={e => setEditProps(p => ({ ...p, notes: e.target.value }))} placeholder="备注" rows={2}
          className="w-full text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/10 rounded-lg p-2 border border-transparent hover:border-amber-300 dark:hover:border-amber-700 focus:border-amber-500 focus:outline-none resize-none transition-colors" />

        {/* 提醒 */}
        {event.reminders.filter(r => r.enabled).length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5"><Bell className="w-3.5 h-3.5" /> {event.reminders.filter(r => r.enabled).length} 个提醒</div>
            <div className="flex flex-wrap gap-1">
              {event.reminders.filter(r => r.enabled).map(r => {
                const labels: Record<string, string> = {'1w':'1周前','3d':'3天前','1d':'1天前','6h':'6h前','2h':'2h前','30min':'30min前','10min':'10min前','5min':'5min前','2min':'2min前','at-time':'发生时'}
                return <span key={r.id} className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">{labels[r.time]||r.time}</span>
              })}
            </div>
          </div>
        )}

        {/* 事件链时间线 */}
        {chain && (() => {
          const ce = eventStore.getEventsByChain(chain.id)
          const sorted = [...ce].sort((a,b)=>new Date(a.startTime).getTime()-new Date(b.startTime).getTime())
          if (sorted.length === 0) return null
          return (
          <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3"><Link className="w-3.5 h-3.5" style={{color:chain.color}} />{chain.name} 时间线 ({sorted.length})</div>
            <div className="relative pl-5 border-l-2 border-dotted ml-2" style={{ borderColor: chain.color + '60' }}>
              {sorted.map((evt, idx) => {
                const t = eventStore.getEventType(evt.typeId)
                const ia = evt.id === selectedEventId
                const isFirst = idx === 0
                const isLast = idx === sorted.length - 1
                return (
                  <button key={evt.id} onClick={() => setSelectedEvent(evt.id)}
                    onDoubleClick={() => { setCurrentDate(new Date(evt.startTime)); setSelectedEvent(evt.id); setOpenPopoverEventId(evt.id) }}
                    className={`relative w-full text-left py-2 ${!isLast ? 'pb-3' : ''}`}>
                    {/* 连接点 */}
                    <span className="absolute -left-[27px] top-2 w-3 h-3 rounded-full border-2 flex-shrink-0 z-10"
                      style={{ backgroundColor: ia ? chain.color : 'white', borderColor: chain.color, boxShadow: ia ? `0 0 6px ${chain.color}` : 'none' }} />
                    <div className={`rounded p-1.5 text-xs transition-colors ${ia ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
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
          )
        })()}
      </div>
    </div>
  )
}
