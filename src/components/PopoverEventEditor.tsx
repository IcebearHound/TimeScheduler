import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Clock, MapPin, User, BookOpen, Star, Bell, Settings, ChevronDown, ChevronRight } from 'lucide-react'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import { Event, Reminder } from '../types/event'
import ReminderQuickPicker from './EventForm/ReminderQuickPicker'

interface Props { eventId: string; anchorRect: DOMRect | null; anchorRef?: React.RefObject<HTMLElement>; onClose: () => void }

const DURATIONS = [30, 60, 90, 120, 180]

function toLocalDT(d: Date) {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0'); const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

const CN_TO_EN: Record<string, string> = {
  '地点': 'location', '授课老师': 'teacher', '课序号': 'courseCode',
  '考试形式': 'examForm', '监考老师': 'supervisor',
  '实验指导老师': 'labTeacher', '实验内容': 'labContent',
}

const FIELD_LABELS: Record<string, string> = {
  location: '地点', teacher: '授课老师', courseCode: '课序号',
  examForm: '考试形式', supervisor: '监考老师',
  labTeacher: '实验指导老师', labContent: '实验内容',
  notes: '备注',
}

const PROP_ICON_MAP: Record<string, React.ReactNode> = {
  MapPin: <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />,
  User: <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />,
  BookOpen: <BookOpen className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />,
}

export default function PopoverEventEditor({ eventId, anchorRect, anchorRef, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const saveRef = useRef<() => void>(() => {})
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const eventStore = useEventStore.getState()
  const event = eventStore.getEvent(eventId)
  const chain = event ? eventStore.getEventChain(event.chainId) : undefined
  const type = event ? eventStore.getEventType(event.typeId) : undefined
  const chains = eventStore.getAllEventChains()
  const allTypes = eventStore.getAllEventTypes()

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

  const [name, setName] = useState(event?.name || '')
  const [startTime, setStartTime] = useState(event ? toLocalDT(new Date(event.startTime)) : '')
  const [endTime, setEndTime] = useState(event ? toLocalDT(new Date(event.endTime)) : '')
  const [durationMin, setDurationMin] = useState(event ? Math.round((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / 60000) : 60)
  const [editProps, setEditProps] = useState<Record<string, string>>({})
  const [editReminders, setEditReminders] = useState<Reminder[]>(event?.reminders || [])
  const [isHighlight, setIsHighlight] = useState(event?.isHighlight || false)
  const [chainId, setChainId] = useState(event?.chainId || '')
  const [typeId, setTypeId] = useState(event?.typeId || '')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['properties']))
  const [newPropName, setNewPropName] = useState('')

  const toggleSection = (key: string) => setCollapsedSections(prev => {
    const n = new Set(prev)
    if (n.has(key)) n.delete(key); else n.add(key)
    return n
  })

  useEffect(() => {
    if (!event) return
    const raw = (event.properties as Record<string, string>) || {}
    const mapped: Record<string, string> = {}
    for (const [cn, en] of Object.entries(CN_TO_EN)) {
      if (raw[cn] != null) mapped[en] = raw[cn]
      else if (raw[en] != null) mapped[en] = raw[en]
    }
    for (const [k, v] of Object.entries(raw)) {
      if (!Object.values(CN_TO_EN).includes(k) && !(k in CN_TO_EN)) mapped[k] = v
    }
    propFields.forEach(({ field }) => { if (!(field in mapped)) mapped[field] = '' })
    setEditProps(mapped)
    setEditReminders(event.reminders || [])
  }, [eventId])

  const save = useCallback(() => {
    if (!name.trim() || !event) return
    const st = new Date(startTime); const ed = new Date(endTime)
    const merged: Record<string, string> = {}
    for (const [k, v] of Object.entries(editProps)) {
      if (v) merged[k] = v
    }
    eventStore.updateEvent(eventId, {
      name, startTime: st, endTime: ed, isHighlight, chainId, typeId,
      properties: merged,
      reminders: editReminders,
    })
  }, [name, startTime, endTime, isHighlight, chainId, typeId, editProps, editReminders, event, eventId])

  saveRef.current = save

  useEffect(() => {
    const t = setTimeout(save, 400)
    return () => clearTimeout(t)
  }, [save])

  useEffect(() => {
    const listener = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current && !ref.current.contains(target)) {
        if (anchorRef?.current && anchorRef.current.contains(target)) return
        saveRef.current(); onCloseRef.current()
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', listener), 50)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', listener) }
  }, [])

  // 跟随锚点滚动
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const updatePos = () => {
      const r = anchorRef?.current?.getBoundingClientRect() || anchorRect
      if (!r) return
      el.style.top = `${Math.min(r.top, window.innerHeight - 520)}px`
      el.style.left = `${Math.min(r.right + 8, window.innerWidth - 380)}px`
    }
    updatePos()
    if (!anchorRef?.current) return
    let scrollEl: HTMLElement | null = anchorRef.current.parentElement
    while (scrollEl) {
      const s = getComputedStyle(scrollEl)
      if (/(auto|scroll)/.test(s.overflow + s.overflowY)) break
      scrollEl = scrollEl.parentElement
    }
    if (!scrollEl) return
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(updatePos) }
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    const onWheel = (e: WheelEvent) => { e.preventDefault(); scrollEl.scrollTop += e.deltaY }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => { scrollEl.removeEventListener('scroll', onScroll); el.removeEventListener('wheel', onWheel); cancelAnimationFrame(raf) }
  }, [])

  const handleStartChange = useCallback((val: string) => {
    setStartTime(val); const st = new Date(val)
    if (isNaN(st.getTime())) return
    setEndTime(toLocalDT(new Date(st.getTime() + durationMin * 60000)))
  }, [durationMin])

  const handleDurationChange = useCallback((min: number) => {
    setDurationMin(min); const st = new Date(startTime)
    if (isNaN(st.getTime())) return
    setEndTime(toLocalDT(new Date(st.getTime() + min * 60000)))
  }, [startTime])

  const handleEndChange = useCallback((val: string) => {
    setEndTime(val); const st = new Date(startTime); const ed = new Date(val)
    if (isNaN(st.getTime()) || isNaN(ed.getTime())) return
    const d = Math.round((ed.getTime() - st.getTime()) / 60000)
    if (d > 0 && d <= 1440) setDurationMin(d)
  }, [startTime])

  const handleClose = () => { save(); onClose() }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { saveRef.current(); onCloseRef.current() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  if (!event || (!anchorRect && !anchorRef)) return null

  const initialR = anchorRect || anchorRef?.current?.getBoundingClientRect()
  const displayPos = initialR ? { top: Math.min(initialR.top, window.innerHeight - 520), left: Math.min(initialR.right + 8, window.innerWidth - 380) } : null
  if (!displayPos) return null

  const popoverEl = (
    <div ref={ref} className="fixed z-[120] bg-white dark:bg-slate-900 rounded-2xl shadow-modal dark:shadow-modal-dark border border-slate-200/60 dark:border-slate-700/60 w-80 max-h-[85vh] overflow-y-auto animate-popover-in"
      style={{ top: displayPos.top, left: displayPos.left }}>
      <div className="h-1 rounded-t-xl" style={{ backgroundColor: chain?.color || '#3B82F6' }} />
      <div className="p-4 space-y-3">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><span className="text-lg">{type?.emoji}</span><span className="text-xs text-slate-500">{chain?.name}</span></div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setIsHighlight(!isHighlight)}
              className={`p-1 rounded-lg ${isHighlight ? 'text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' : 'text-slate-300 hover:text-yellow-400'}`}>
              <Star className={`w-4 h-4 ${isHighlight ? 'fill-yellow-400' : ''}`} />
            </button>
            <button onClick={handleClose} className="p-1 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* 名称 */}
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="事件名称"
          className="w-full text-base font-bold text-slate-900 dark:text-white bg-transparent border-b border-slate-200/60 dark:border-slate-700/60 focus:border-accent-500 focus:outline-none pb-1" />

        {/* 事件链 & 类型 */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-slate-400">事件链</label>
            <select value={chainId} onChange={e => setChainId(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 mt-0.5 focus:outline-none focus:ring-1 focus:ring-accent-500/40">
              <option value="">无</option>
              {chains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-slate-400">类型</label>
            <select value={typeId} onChange={e => setTypeId(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 mt-0.5 focus:outline-none focus:ring-1 focus:ring-accent-500/40">
              {allTypes.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}
            </select>
          </div>
        </div>

        {/* 时间 — 可折叠 */}
        <div>
          <button onClick={() => toggleSection('time')}
            className="flex items-center gap-1.5 w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1">
            {collapsedSections.has('time') ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <Clock className="w-3.5 h-3.5" /> 时间
          </button>
          {!collapsedSections.has('time') && (
          <div className="space-y-1.5">
            <input type="datetime-local" value={startTime} onChange={e => handleStartChange(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-accent-500/40" />
            <div className="flex flex-wrap gap-1">
              {DURATIONS.map(m => (
                <button key={m} type="button" onClick={() => handleDurationChange(m)}
                  className={`px-2 py-0.5 text-[10px] rounded-full border ${durationMin === m ? 'bg-accent-600 text-white border-accent-600' : 'bg-white dark:bg-slate-700 border-slate-200/60 dark:border-slate-600/60 text-slate-500 hover:border-accent-300'}`}>
                  {m >= 60 ? `${m / 60}h` : `${m}min`}
                </button>
              ))}
            </div>
            <input type="datetime-local" value={endTime} onChange={e => handleEndChange(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-accent-500/40" />
          </div>
          )}
        </div>

        {/* 提醒 — 可折叠 */}
        <div>
          <button onClick={() => toggleSection('reminder')}
            className="flex items-center gap-1.5 w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1">
            {collapsedSections.has('reminder') ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <Bell className="w-3.5 h-3.5" /> 提醒
          </button>
          {!collapsedSections.has('reminder') && (
            <ReminderQuickPicker reminders={editReminders} onChange={setEditReminders} />
          )}
        </div>

        {/* 属性 — 可折叠 */}
        <div>
          <button onClick={() => toggleSection('properties')}
            className="flex items-center gap-1.5 w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1">
            {collapsedSections.has('properties') ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <Settings className="w-3.5 h-3.5" /> 属性
            {collapsedSections.has('properties') && (
              <span className="text-[10px] text-slate-400 ml-1">
                {(() => {
                  const customKeys = Object.keys(editProps).filter(k => !propFields.some(p => p.field === k) && !Object.values(CN_TO_EN).includes(k))
                  return `${propFields.length + customKeys.length}项`
                })()}
              </span>
            )}
          </button>
          {!collapsedSections.has('properties') && (
            <div className="p-2 bg-slate-50 dark:bg-slate-700/30 rounded-lg space-y-1.5">
              {propFields.map(({ field, icon }) => (
                <div key={field} className="flex items-center gap-2">
                  {icon && PROP_ICON_MAP[icon] ? <>{PROP_ICON_MAP[icon]}</> :
                   field === 'location' ? <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> :
                   field === 'teacher' || field === 'supervisor' || field === 'labTeacher' ? <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> :
                   field === 'courseCode' || field === 'examForm' || field === 'labContent' ? <BookOpen className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> :
                   <span className="w-3.5 h-3.5 flex-shrink-0 text-[10px] text-slate-400 flex items-center justify-center">{field[0]}</span>}
                  <input type="text" value={editProps[field] || ''} onChange={e => setEditProps(p => ({ ...p, [field]: e.target.value }))}
                    placeholder={FIELD_LABELS[field] || field}
                    className="flex-1 text-xs text-slate-700 dark:text-slate-300 bg-transparent border-b border-transparent hover:border-slate-200/60 dark:hover:border-slate-600/60 focus:border-accent-500 focus:outline-none pb-0.5" />
                </div>
              ))}
              {/* 自定义属性 */}
              {Object.keys(editProps).filter(k => !propFields.some(p => p.field === k) && !Object.values(CN_TO_EN).includes(k)).map(k => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 flex-shrink-0 text-[10px] text-slate-400 flex items-center justify-center">+</span>
                  <input type="text" value={editProps[k] || ''} onChange={e => setEditProps(p => ({ ...p, [k]: e.target.value }))}
                    placeholder={k}
                    className="flex-1 text-xs text-slate-700 dark:text-slate-300 bg-transparent border-b border-transparent hover:border-slate-200/60 dark:hover:border-slate-600/60 focus:border-accent-500 focus:outline-none pb-0.5" />
                  <button type="button" onClick={() => { const np = { ...editProps }; delete np[k]; setEditProps(np) }}
                    className="text-slate-300 hover:text-red-400 flex-shrink-0 p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {propFields.length === 0 && Object.keys(editProps).length === 0 && <div className="text-xs text-slate-400">无属性</div>}
              {/* 添加新属性 */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="w-3.5 h-3.5 flex-shrink-0 text-[10px] text-blue-400 flex items-center justify-center">+</span>
                <input type="text" value={newPropName} onChange={e => setNewPropName(e.target.value)}
                  placeholder="添加属性名..."
                  className="flex-1 text-[11px] text-slate-500 dark:text-slate-400 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 focus:border-accent-500 focus:outline-none pb-0.5"
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
      </div>
    </div>
  )
  return createPortal(popoverEl, document.body)
}
