/**
 * 事件编辑表单 - duration时间选择、优雅重点标记、按类型自定义属性
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Star, ChevronDown, Settings, MapPin, User, BookOpen, Clock, Bell, Flag, Home, Award, Heart, Zap, Smile, Pin, Hash, Paperclip, Eye, Music, Gift, Coffee } from 'lucide-react'
import useEventStore from '../../stores/eventStore'
import useEventGroupStore from '../../stores/eventGroupStore'
import useUIStore from '../../stores/uiStore'
import ReminderSelector from './ReminderSelector'
import { Event, EventChain, Reminder, EventProperty } from '../../types/event'

const CN_TO_EN: Record<string, string> = {
  '地点': 'location', '授课老师': 'teacher', '课序号': 'courseCode',
  '考试形式': 'examForm', '监考老师': 'supervisor',
  '实验指导老师': 'labTeacher', '实验内容': 'labContent',
}

const CUSTOM_PROP_ICONS = [
  { key: 'pin', icon: <Pin className="w-3.5 h-3.5 text-slate-400" />, label: '图钉' },
  { key: 'map', icon: <MapPin className="w-3.5 h-3.5 text-slate-400" />, label: '地点' },
  { key: 'user', icon: <User className="w-3.5 h-3.5 text-slate-400" />, label: '人员' },
  { key: 'book', icon: <BookOpen className="w-3.5 h-3.5 text-slate-400" />, label: '书本' },
  { key: 'clock', icon: <Clock className="w-3.5 h-3.5 text-slate-400" />, label: '时间' },
  { key: 'bell', icon: <Bell className="w-3.5 h-3.5 text-slate-400" />, label: '提醒' },
  { key: 'flag', icon: <Flag className="w-3.5 h-3.5 text-slate-400" />, label: '标记' },
  { key: 'home', icon: <Home className="w-3.5 h-3.5 text-slate-400" />, label: '地点' },
  { key: 'star', icon: <Star className="w-3.5 h-3.5 text-slate-400" />, label: '星标' },
  { key: 'award', icon: <Award className="w-3.5 h-3.5 text-slate-400" />, label: '奖项' },
  { key: 'heart', icon: <Heart className="w-3.5 h-3.5 text-slate-400" />, label: '重要' },
  { key: 'zap', icon: <Zap className="w-3.5 h-3.5 text-slate-400" />, label: '快速' },
  { key: 'smile', icon: <Smile className="w-3.5 h-3.5 text-slate-400" />, label: '表情' },
  { key: 'hash', icon: <Hash className="w-3.5 h-3.5 text-slate-400" />, label: '编号' },
  { key: 'clip', icon: <Paperclip className="w-3.5 h-3.5 text-slate-400" />, label: '附件' },
  { key: 'eye', icon: <Eye className="w-3.5 h-3.5 text-slate-400" />, label: '查看' },
  { key: 'music', icon: <Music className="w-3.5 h-3.5 text-slate-400" />, label: '音乐' },
  { key: 'gift', icon: <Gift className="w-3.5 h-3.5 text-slate-400" />, label: '礼物' },
  { key: 'coffee', icon: <Coffee className="w-3.5 h-3.5 text-slate-400" />, label: '咖啡' },
]
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
  const [showExtraProps, setShowExtraProps] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [customPropIcon, setCustomPropIcon] = useState('pin')
  const [customPropIcons, setCustomPropIcons] = useState<Record<string, string>>({})
  const [editingCustomPropIcon, setEditingCustomPropIcon] = useState<string | null>(null)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [properties, setProperties] = useState<Record<string, string>>(() => {
    if (!editEvent) return {}
    // 将事件属性（可能中英文混存）统一转换为英文键
    const raw = (editEvent.properties as Record<string, string>) || {}
    const mapped: Record<string, string> = {}
    for (const [cn, en] of Object.entries(CN_TO_EN)) {
      if (raw[cn]) mapped[en] = raw[cn]
      else if (raw[en]) mapped[en] = raw[en]
    }
    // 保留不在映射表内的自定义属性
    for (const [k, v] of Object.entries(raw)) {
      if (!Object.values(CN_TO_EN).includes(k) && !CN_TO_EN[k]) mapped[k] = v
    }
    return mapped
  })
  const [chains, setChains] = useState<EventChain[]>([])
  const [showChainModal, setShowChainModal] = useState(false)
  const [chainModalKey, setChainModalKey] = useState(0)

  // 根据图标key渲染图标组件
  const renderIcon = (key: string) => {
    const item = CUSTOM_PROP_ICONS.find(ic => ic.key === key)
    return item ? item.icon : <Pin className="w-3.5 h-3.5 text-slate-400" />
  }
  const formatDisplayDate = (dt: string) => {
    const d = new Date(dt); if (isNaN(d.getTime())) return dt
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
  const formatDisplayTime = (dt: string) => {
    const d = new Date(dt); if (isNaN(d.getTime())) return dt
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
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
        // 统一转换为英文键
        const raw = (evt.properties as Record<string, string>) || {}
        const mapped: Record<string, string> = {}
        for (const [cn, en] of Object.entries(CN_TO_EN)) {
          if (raw[cn]) mapped[en] = raw[cn]
          else if (raw[en]) mapped[en] = raw[en]
        }
        for (const [k, v] of Object.entries(raw)) {
          if (!Object.values(CN_TO_EN).includes(k) && !CN_TO_EN[k]) mapped[k] = v
        }
        setProperties(mapped)
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
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* 名称 */}
        <div className="flex items-center gap-2">
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className="flex-1 text-lg font-bold text-slate-900 dark:text-white bg-transparent border-b-2 border-slate-200 dark:border-slate-700 focus:border-accent-500 focus:outline-none pb-1 transition-colors" placeholder="事件名称 *" />
          <button type="button" onClick={() => setIsHighlight(!isHighlight)}
            className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${
              isHighlight ? 'text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' : 'text-slate-300 hover:text-yellow-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
            }`} title="重点事件">
            <Star className={`w-5 h-5 ${isHighlight ? 'fill-yellow-400' : ''}`} />
          </button>
        </div>

        {/* 类型 + 事件链 */}
        <div className="flex gap-2">
          <select value={typeId} onChange={e => { setTypeId(e.target.value); setProperties({}) }}
            className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-accent-500/40 focus:border-accent-500">
            {eventTypes.map(t => (
              <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
            ))}
          </select>
          <div className="flex-1 flex gap-1">
            <select value={chainIdState} onChange={e => setChainIdState(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-accent-500/40 focus:border-accent-500">
              <option value="">无事件链</option>
              {chains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" onClick={handleOpenChainModal} title="新建事件链"
              className="px-2 py-1.5 text-sm text-accent-500 hover:text-accent-600 hover:bg-accent-50 dark:hover:bg-accent-900/20 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 flex-shrink-0">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 时间 */}
        <div>
          <button type="button" onClick={() => setShowTimePicker(!showTimePicker)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 hover:border-accent-300 transition-colors">
            <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span>{formatDisplayDate(startTime)} {formatDisplayTime(startTime)}</span>
            <span className="text-slate-400">→</span>
            <span>{formatDisplayTime(endTime)}</span>
            <span className="text-xs text-slate-400">({durationMin >= 60 ? `${Math.floor(durationMin / 60)}h${durationMin % 60 ? ` ${durationMin % 60}min` : ''}` : `${durationMin}分钟`})</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 ml-auto flex-shrink-0 transition-transform ${showTimePicker ? 'rotate-180' : ''}`} />
          </button>
          {showTimePicker && (
            <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg space-y-2">
              <div>
                <label className="text-xs text-slate-500">开始时间</label>
                <input type="datetime-local" value={startTime} onChange={e => handleStartChange(e.target.value)}
                  className="w-full px-2 py-1 mt-0.5 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-accent-500/40 focus:border-accent-500" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DURATION_PRESETS.map(p => (
                  <button key={p.minutes} type="button"
                    onClick={() => handleDurationChange(p.minutes)}
                    className={`px-2 py-0.5 text-xs rounded-full border transition-all ${
                      durationMin === p.minutes
                        ? 'bg-accent-600 text-white border-accent-600 shadow-sm shadow-accent-600/20'
                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-accent-300'
                    }`}>{p.label}</button>
                ))}
              </div>
              <div>
                <label className="text-xs text-slate-500">结束时间</label>
                <input type="datetime-local" value={endTime} onChange={e => handleEndChange(e.target.value)}
                  className="w-full px-2 py-1 mt-0.5 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-accent-500/40 focus:border-accent-500" />
              </div>
            </div>
          )}
        </div>

        {/* 属性 — 可折叠 */}
        <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
          <button type="button" onClick={() => setShowExtraProps(!showExtraProps)}
            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
            <Settings className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">属性</span>
            {!showExtraProps && (() => {
              const customKeys = Object.keys(properties).filter(k => !propFields.includes(k) && !Object.values(CN_TO_EN).includes(k) && !(k in CN_TO_EN))
              const total = propFields.length + customKeys.length
              return <span className="text-xs text-slate-400">({total}项)</span>
            })()}
            <ChevronDown className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${showExtraProps ? '' : '-rotate-90'}`} />
          </button>
          {showExtraProps && (
          <div className="px-3 pb-3 space-y-2">
            {/* 类型属性 + 自定义属性统一 grid */}
            {(() => {
              const customKeys = Object.keys(properties).filter(k => !propFields.includes(k) && !Object.values(CN_TO_EN).includes(k) && !(k in CN_TO_EN))
              const allFields = [...propFields.map(f => ({ name: f, storeKey: CN_TO_EN[f] || f, isCustom: false })), ...customKeys.map(k => ({ name: k, storeKey: k, isCustom: true }))]
              return allFields.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {allFields.map(({ name, storeKey, isCustom }) => (
                    <div key={name}>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                        {isCustom ? (
                          <button type="button" onClick={(e) => { e.preventDefault(); setEditingCustomPropIcon(name); setShowEmojiPicker(true) }}
                            className="hover:scale-110 transition-transform cursor-pointer" title="点击更换图标">
                            {renderIcon(customPropIcons[name])}
                          </button>
                        ) : (
                          renderIcon(customPropIcons[name])
                        )}
                        {name}
                      </label>
                      <div className="flex items-center gap-1">
                        <input type="text" value={properties[storeKey] || ''} onChange={e => setProperties(p => ({ ...p, [storeKey]: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-accent-500/40 focus:border-accent-500" placeholder={name} />
                        {isCustom && (
                          <button type="button" onClick={() => { const np = { ...properties }; delete np[storeKey]; setProperties(np) }}
                            className="text-slate-400 hover:text-red-500 flex-shrink-0">&times;</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-xs text-slate-400 py-1">无属性</div>
            })()}

            {/* 添加自定义属性 */}
            <div className="flex gap-1 pt-1 border-t border-slate-200 dark:border-slate-600">
              <div className="relative">
                <button type="button" onClick={() => { if (!editingCustomPropIcon) setShowEmojiPicker(!showEmojiPicker); else { setShowEmojiPicker(true) } }}
                  className={`w-7 h-7 border border-dashed rounded bg-transparent flex items-center justify-center ${
                    editingCustomPropIcon ? 'border-accent-400 bg-accent-50 dark:bg-accent-900/20' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`} title={editingCustomPropIcon ? `正在更换「${editingCustomPropIcon}」的图标` : '选择新属性图标'}>
                  {renderIcon(editingCustomPropIcon ? (customPropIcons[editingCustomPropIcon] || 'pin') : customPropIcon)}
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-0 mb-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-overlay z-50 w-64">
                    {editingCustomPropIcon && (
                      <div className="text-[10px] text-accent-600 dark:text-accent-400 px-1 pb-1 mb-1 border-b border-slate-100 dark:border-slate-700">
                        更换「{editingCustomPropIcon}」的图标
                        <button type="button" onClick={() => { setEditingCustomPropIcon(null); setShowEmojiPicker(false) }}
                          className="ml-2 text-slate-400 hover:text-red-500">&times; 取消</button>
                      </div>
                    )}
                    <div className="grid grid-cols-7 gap-1">
                      {CUSTOM_PROP_ICONS.map(ic => (
                        <button key={ic.key} type="button" onClick={() => {
                          if (editingCustomPropIcon) { setCustomPropIcons(p => ({ ...p, [editingCustomPropIcon]: ic.key })); setEditingCustomPropIcon(null) }
                          else setCustomPropIcon(ic.key)
                          setShowEmojiPicker(false)
                        }} className={`w-7 h-7 hover:bg-slate-100 dark:hover:bg-slate-700 rounded flex items-center justify-center ${
                          editingCustomPropIcon && customPropIcons[editingCustomPropIcon] === ic.key ? 'bg-accent-100 dark:bg-accent-900/30 ring-1 ring-accent-400' : ''
                        }`} title={ic.label}>{ic.icon}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <input type="text" placeholder="添加自定义属性名..."
                className="flex-1 px-2 py-1 text-xs border border-dashed border-slate-300 dark:border-slate-600 rounded bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-accent-500/40 focus:border-accent-500"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value.trim()
                    if (v && !(v in properties)) { setProperties(p => ({ ...p, [v]: '' })); setCustomPropIcons(p => ({ ...p, [v]: customPropIcon })); (e.target as HTMLInputElement).value = '' }
                    e.preventDefault()
                  }
                }} />
            </div>
          </div>
          )}
        </div>

        <ReminderSelector reminders={reminders} onChange={setReminders} isHighlight={isHighlight} />

        <div className="flex gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium text-sm transition-colors">取消</button>
          <button type="submit" className="flex-1 px-4 py-2 bg-accent-600 hover:bg-accent-700 shadow-sm shadow-accent-600/20 text-white rounded-lg font-medium text-sm transition-colors">{eventId ? '保存更改' : '创建事件'}</button>
        </div>
      </form>

      {showChainModal && (
        <EventChainModal key={chainModalKey} mode="create" onClose={() => setShowChainModal(false)} onCreated={handleChainCreated} />
      )}
    </>
  )
}
