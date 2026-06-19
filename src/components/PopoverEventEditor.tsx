/**
 * 悬浮事件编辑器 — 完整编辑功能含时间修改，属性字段按事件类型动态显示
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Clock, MapPin, User, Star } from 'lucide-react'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import { Event, Reminder } from '../types/event'

interface Props { eventId: string; anchorRect: DOMRect | null; onClose: () => void }

const DURATIONS = [30, 60, 90, 120, 180]

function toLocalDT(d: Date) {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0'); const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

const PROP_ICONS: Record<string, React.ReactNode> = {
  '地点': <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />,
  '授课老师': <User className="w-3 h-3 text-slate-400 flex-shrink-0" />,
  '监考老师': <User className="w-3 h-3 text-slate-400 flex-shrink-0" />,
  '实验指导老师': <User className="w-3 h-3 text-slate-400 flex-shrink-0" />,
}

export default function PopoverEventEditor({ eventId, anchorRect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const eventStore = useEventStore.getState()
  const event = eventStore.getEvent(eventId)
  const chain = event ? eventStore.getEventChain(event.chainId) : undefined
  const type = event ? eventStore.getEventType(event.typeId) : undefined
  const chains = eventStore.getAllEventChains()
  const allTypes = eventStore.getAllEventTypes()

  // 事件类型绑定的属性字段
  const propFields = (() => {
    if (type?.propertyFields && type.propertyFields.length > 0) return type.propertyFields.map(f => typeof f === 'string' ? f : f.name)
    return []
  })()

  const [name, setName] = useState(event?.name || '')
  const [startTime, setStartTime] = useState(event ? toLocalDT(new Date(event.startTime)) : '')
  const [endTime, setEndTime] = useState(event ? toLocalDT(new Date(event.endTime)) : '')
  const [durationMin, setDurationMin] = useState(event ? Math.round((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / 60000) : 60)
  const [editProps, setEditProps] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [isHighlight, setIsHighlight] = useState(event?.isHighlight || false)
  const [chainId, setChainId] = useState(event?.chainId || '')
  const [typeId, setTypeId] = useState(event?.typeId || '')

  // 初始化属性值
  useEffect(() => {
    if (!event) return
    const vals: Record<string, string> = {}
    const existing = (event.properties as Record<string, string>) || {}
    propFields.forEach(f => { vals[f] = existing[f] || '' })
    setEditProps(vals)
    setNotes(existing['备注'] || existing.notes || '')
  }, [eventId])

  // 自动保存（debounce）
  const save = useCallback(() => {
    if (!name.trim() || !event) return
    const st = new Date(startTime); const ed = new Date(endTime)
    // 保留原有属性，合并编辑后的值
    const merged: Record<string, string> = { ...(event.properties as Record<string, string> || {}) }
    propFields.forEach(f => {
      if (editProps[f]) merged[f] = editProps[f]
      else delete merged[f]
    })
    if (notes) merged['备注'] = notes
    else delete merged['备注']
    eventStore.updateEvent(eventId, {
      name, startTime: st, endTime: ed, isHighlight, chainId, typeId,
      properties: merged,
    })
  }, [name, startTime, endTime, isHighlight, chainId, typeId, editProps, notes, event, eventId, eventStore, propFields])

  useEffect(() => {
    const t = setTimeout(save, 400)
    return () => clearTimeout(t)
  }, [save])

  // Close on click outside
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        save()
        onClose()
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', listener), 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', listener)
    }
  }, [save, onClose])

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

  if (!event || !anchorRect) return null

  const top = Math.min(anchorRect.top, window.innerHeight - 520)
  const left = Math.min(anchorRect.right + 8, window.innerWidth - 380)

  return (
    <div ref={ref} className="fixed z-[110] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-80 max-h-[85vh] overflow-y-auto"
      style={{ top, left }}>
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
            <button onClick={handleClose} className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* 名称 */}
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="事件名称"
          className="w-full text-base font-bold text-slate-900 dark:text-white bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:outline-none pb-1" />

        {/* 事件链 */}
        <div>
          <label className="text-[10px] text-slate-400">事件链</label>
          <select value={chainId} onChange={e => setChainId(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 mt-0.5">
            <option value="">无（独立事件）</option>
            {chains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* 事件类型 */}
        <div>
          <label className="text-[10px] text-slate-400">事件类型</label>
          <select value={typeId} onChange={e => setTypeId(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 mt-0.5">
            {allTypes.map(t => (
              <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
            ))}
          </select>
        </div>

        {/* 开始时间 */}
        <div>
          <label className="text-[10px] text-slate-400">开始时间</label>
          <input type="datetime-local" value={startTime} onChange={e => handleStartChange(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 mt-0.5" />
        </div>

        {/* 持续时长 */}
        <div className="flex flex-wrap gap-1">
          {DURATIONS.map(m => (
            <button key={m} type="button" onClick={() => handleDurationChange(m)}
              className={`px-2 py-0.5 text-[10px] rounded-full border ${durationMin === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 hover:border-blue-300'}`}>
              {m >= 60 ? `${m / 60}h` : `${m}min`}
            </button>
          ))}
        </div>

        {/* 结束时间 */}
        <div>
          <label className="text-[10px] text-slate-400">结束时间</label>
          <input type="datetime-local" value={endTime} onChange={e => handleEndChange(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 mt-0.5" />
        </div>

        {/* 属性 — 按事件类型动态显示 */}
        {propFields.length > 0 && (
          <div className="space-y-1.5">
            {propFields.map(f => (
              <div key={f} className="flex items-center gap-2">
                {PROP_ICONS[f] || <span className="w-3 h-3 flex-shrink-0" />}
                <input type="text" value={editProps[f] || ''} onChange={e => setEditProps(p => ({ ...p, [f]: e.target.value }))}
                  placeholder={f}
                  className="flex-1 text-xs text-slate-700 dark:text-slate-300 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-none pb-0.5" />
              </div>
            ))}
          </div>
        )}

        {/* 备注 */}
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="备注" rows={2}
          className="w-full text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/10 rounded-lg p-2 border-none focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none" />
      </div>
    </div>
  )
}
