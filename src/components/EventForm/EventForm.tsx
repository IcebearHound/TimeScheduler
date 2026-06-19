/**
 * 事件编辑表单 - duration时间选择、优雅重点标记、按类型自定义属性
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Star, ChevronDown, ChevronUp } from 'lucide-react'
import useEventStore from '../../stores/eventStore'
import useEventGroupStore from '../../stores/eventGroupStore'
import useUIStore from '../../stores/uiStore'
import ReminderSelector from './ReminderSelector'
import { Event, EventChain, Reminder, EventProperty } from '../../types/event'
import EventChainModal from '../EventChainModal'
import { dialogAlert } from '../../utils/dialog'

interface EventFormProps {
  eventId?: string; chainId?: string; onClose: () => void
  defaultStart?: Date; defaultEnd?: Date
}

const DURATION_PRESETS = [
  { label: '30分钟', minutes: 30 },
  { label: '1小时', minutes: 60 },
  { label: '1.5小时', minutes: 90 },
  { label: '2小时', minutes: 120 },
  { label: '3小时', minutes: 180 },
]

function toLocalDT(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

export default function EventForm({ eventId, chainId, onClose, defaultStart, defaultEnd }: EventFormProps) {
  const eventStore = useEventStore.getState()
  const groupStore = useEventGroupStore.getState()
  const eventTypes = eventStore.getAllEventTypes()

  // 加载编辑模式的事件数据
  const editEvent = eventId ? eventStore.getEvent(eventId) : null
  const startDefault = defaultStart ? toLocalDT(defaultStart) : (editEvent ? toLocalDT(new Date(editEvent.startTime)) : toLocalDT(new Date()))
  const endDefault = defaultEnd ? toLocalDT(defaultEnd) : (editEvent ? toLocalDT(new Date(editEvent.endTime)) : toLocalDT(new Date(Date.now() + 2 * 3600000)))

  const [name, setName] = useState(editEvent?.name || '')
  const [startTime, setStartTime] = useState(startDefault)
  const [endTime, setEndTime] = useState(endDefault)
  const [durationMin, setDurationMin] = useState(editEvent ? Math.round((new Date(editEvent.endTime).getTime() - new Date(editEvent.startTime).getTime()) / 60000) : 120)
  const [chainIdState, setChainIdState] = useState(editEvent?.chainId || chainId || '')
  const [typeId, setTypeId] = useState(editEvent?.typeId || 'type-course')
  const [isHighlight, setIsHighlight] = useState(editEvent?.isHighlight || false)
  const [reminders, setReminders] = useState<Reminder[]>(editEvent?.reminders || [])
  const [properties, setProperties] = useState<Record<string, string>>(editEvent?.properties as Record<string, string> || {})
  const [showExtraProps, setShowExtraProps] = useState(false)

  const [chains, setChains] = useState<EventChain[]>([])
  const [showChainModal, setShowChainModal] = useState(false)
  const [chainModalKey, setChainModalKey] = useState(0)

  // 当前类型推荐的属性字段
  const propFields = (() => {
    const t = eventStore.getEventType(typeId)
    if (t?.propertyFields && t.propertyFields.length > 0) return t.propertyFields.map(f => typeof f === 'string' ? f : f.name)
    return []
  })()

  useEffect(() => {
    setChains(eventStore.getAllEventChains())
    if (eventId) {
      const evt = eventStore.getEvent(eventId)
      if (evt) {
        setName(evt.name)
        setStartTime(toLocalDT(new Date(evt.startTime)))
        setEndTime(toLocalDT(new Date(evt.endTime)))
        setDurationMin(Math.round((new Date(evt.endTime).getTime() - new Date(evt.startTime).getTime()) / 60000))
        setChainIdState(evt.chainId || '')
        setTypeId(evt.typeId)
        setIsHighlight(evt.isHighlight)
        setReminders(evt.reminders)
        setProperties(evt.properties as Record<string, string> || {})
      }
    }
  }, [eventId])

  // 开始时间变化 → 自动更新结束时间
  const handleStartChange = useCallback((val: string) => {
    setStartTime(val)
    const st = new Date(val)
    if (isNaN(st.getTime())) return
    const ed = new Date(st.getTime() + durationMin * 60000)
    setEndTime(toLocalDT(ed))
  }, [durationMin])

  // duration 变化 → 更新结束时间
  const handleDurationChange = useCallback((min: number) => {
    setDurationMin(min)
    const st = new Date(startTime)
    if (isNaN(st.getTime())) return
    const ed = new Date(st.getTime() + min * 60000)
    setEndTime(toLocalDT(ed))
  }, [startTime])

  // 结束时间手动改 → 反算 duration
  const handleEndChange = useCallback((val: string) => {
    setEndTime(val)
    const st = new Date(startTime)
    const ed = new Date(val)
    if (isNaN(st.getTime()) || isNaN(ed.getTime())) return
    const d = Math.round((ed.getTime() - st.getTime()) / 60000)
    if (d > 0 && d <= 1440) setDurationMin(d)
  }, [startTime])

  const handleOpenChainModal = () => { setChainModalKey(k => k + 1); setShowChainModal(true) }
  const handleChainCreated = (newChainId: string) => {
    setChains(eventStore.getAllEventChains())
    setChainIdState(newChainId)
    const gid = useEventGroupStore.getState().ensureActiveGroup()
    useEventGroupStore.getState().addEventChainToGroup(gid, newChainId)
    setShowChainModal(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { dialogAlert('请输入事件名称', '提示'); return }
    const st = new Date(startTime)
    const ed = new Date(endTime)
    if (ed <= st) { dialogAlert('结束时间必须晚于开始时间', '提示'); return }

    if (eventId) {
      eventStore.updateEvent(eventId, { name, startTime: st, endTime: ed, chainId: chainIdState, typeId, isHighlight, properties: properties as EventProperty, reminders })
    } else {
      const ev = eventStore.addEvent({ name, startTime: st, endTime: ed, chainId: chainIdState, typeId, reminders, properties: properties as EventProperty, isHighlight, priority: 0 })
      const gid = useEventGroupStore.getState().ensureActiveGroup()
      useEventGroupStore.getState().addEventToGroup(gid, ev.id)
    }
    const cf = eventStore.detectConflicts()
    if (cf.length > 0) {
      const ui = useUIStore.getState()
      setTimeout(() => { ui.setConflictConflicts(cf); ui.setIsConflictDialogOpen(true) }, 100)
    }
    onClose()
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 名称 + 重点 */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">事件名称 *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="输入事件名称" />
          </div>
          <button type="button" onClick={() => setIsHighlight(!isHighlight)}
            className={`mt-7 p-2 rounded-xl border-2 transition-all flex-shrink-0 ${
              isHighlight ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 shadow-[0_0_8px_rgba(250,204,21,0.4)]' : 'border-slate-200 dark:border-slate-600 text-slate-300 hover:border-yellow-300 hover:text-yellow-400'
            }`} title="重点事件">
            <Star className={`w-6 h-6 transition-transform ${isHighlight ? 'fill-yellow-400 scale-110' : ''}`} />
          </button>
        </div>

        {/* 事件链 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">所属事件链</label>
          <select value={chainIdState} onChange={e => setChainIdState(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">无（独立事件）</option>
            {chains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" onClick={handleOpenChainModal}
            className="mt-2 flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
            <Plus className="w-4 h-4" /> 创建新的事件链
          </button>
        </div>

        {/* 时间 + Duration */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">开始时间</label>
          <input type="datetime-local" value={startTime} onChange={e => handleStartChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">持续时长</label>
            <span className="text-xs text-slate-400">{durationMin >= 60 ? `${Math.floor(durationMin / 60)}h${durationMin % 60 ? ` ${durationMin % 60}min` : ''}` : `${durationMin}分钟`}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DURATION_PRESETS.map(p => (
              <button key={p.minutes} type="button"
                onClick={() => handleDurationChange(p.minutes)}
                className={`px-3 py-1 text-xs rounded-full border transition-all ${
                  durationMin === p.minutes
                    ? 'bg-blue-600 text-white border-blue-600 shadow'
                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-300 hover:text-blue-600'
                }`}>{p.label}</button>
            ))}
            <input type="number" min="5" max="1440" value={durationMin}
              onChange={e => { const v = parseInt(e.target.value); if (v >= 5 && v <= 1440) handleDurationChange(v) }}
              className="w-20 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="自定义分钟" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">结束时间</label>
          <input type="datetime-local" value={endTime} onChange={e => handleEndChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* 事件类型 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">事件类型</label>
          <select value={typeId} onChange={e => { setTypeId(e.target.value); setProperties({}) }}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {eventTypes.map(t => (
              <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
            ))}
          </select>
        </div>

        {/* 自定义属性 — 按事件类型 */}
        <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">属性</h3>
            <button type="button" onClick={() => setShowExtraProps(!showExtraProps)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
              {showExtraProps ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showExtraProps ? '收起' : '展开全部'}
            </button>
          </div>

          {/* 前两个属性始终可见 */}
          <div className="grid grid-cols-2 gap-2">
            {propFields.slice(0, 2).map(field => (
              <div key={field}>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{field}</label>
                <input type="text" value={properties[field] || ''} onChange={e => setProperties(p => ({ ...p, [field]: e.target.value }))}
                  className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder={field} />
              </div>
            ))}
          </div>

          {/* 额外的属性折叠显示 */}
          {showExtraProps && propFields.length > 2 && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-600">
              {propFields.slice(2).map(field => (
                <div key={field}>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{field}</label>
                  <input type="text" value={properties[field] || ''} onChange={e => setProperties(p => ({ ...p, [field]: e.target.value }))}
                    className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder={field} />
                </div>
              ))}
            </div>
          )}

          {/* 自定义添加属性 */}
          <div className="flex gap-1 pt-1">
            <input type="text" placeholder="添加自定义属性名..."
              className="flex-1 px-2 py-1 text-xs border border-dashed border-slate-300 dark:border-slate-600 rounded bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const v = (e.target as HTMLInputElement).value.trim()
                  if (v && !(v in properties)) { setProperties(p => ({ ...p, [v]: '' })); (e.target as HTMLInputElement).value = '' }
                  e.preventDefault()
                }
              }} />
          </div>

          {/* 已添加的自定义属性 */}
          {Object.keys(properties).filter(k => !propFields.includes(k)).length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-600">
              {Object.keys(properties).filter(k => !propFields.includes(k)).map(k => (
                <div key={k} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-24 flex-shrink-0 truncate">{k}</span>
                  <input type="text" value={properties[k] || ''} onChange={e => setProperties(p => ({ ...p, [k]: e.target.value }))}
                    className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder={k} />
                  <button type="button" onClick={() => { const np = { ...properties }; delete np[k]; setProperties(np) }}
                    className="text-slate-400 hover:text-red-500 flex-shrink-0">&times;</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <ReminderSelector reminders={reminders} onChange={setReminders} isHighlight={isHighlight} />

        <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-medium transition-colors">取消</button>
          <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">{eventId ? '保存更改' : '创建事件'}</button>
        </div>
      </form>

      {showChainModal && (
        <EventChainModal key={chainModalKey} mode="create" onClose={() => setShowChainModal(false)} onCreated={handleChainCreated} />
      )}
    </>
  )
}
