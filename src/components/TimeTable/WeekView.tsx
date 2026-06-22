/**
 * 灵活视图 — 支持调整天数（1/3/5/7），标题栏固定置顶
 */
import React, { useMemo, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Columns } from 'lucide-react'
import useUIStore from '../../stores/uiStore'
import useEventStore from '../../stores/eventStore'
import useEventGroupStore from '../../stores/eventGroupStore'
import { getStartOfWeek } from '../../utils/dateUtils'
import { isJumping } from '../../utils/scrollTarget'
import DayColumn from './DayColumn'

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const DAY_OPTIONS = [1, 3, 5, 7]

function getDays(date: Date, count: number): Date[] {
  const days: Date[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(date)
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    days.push(d)
  }
  return days
}

export default function WeekView() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentDate = useUIStore((s) => s.currentDate)
  const setCurrentDate = useUIStore((s) => s.setCurrentDate)
  const filterTypeIds = useUIStore((s) => s.filterTypeIds)
  const hiddenGroupIds = useUIStore((s) => s.hiddenGroupIds)
  const selectedEventId = useUIStore((s) => s.selectedEventId)
  const events = useEventStore((s) => s.events)
  const eventStore = useEventStore.getState()
  const groupStore = useEventGroupStore.getState()

  // 计算被隐藏的事件 ID 集合（按事件组过滤）
  const hiddenEventIds = useMemo(() => {
    if (hiddenGroupIds.size === 0) return null
    const ids = new Set<string>()
    hiddenGroupIds.forEach(gid => {
      const g = groupStore.groups.get(gid)
      if (!g) return
      g.eventIds.forEach(eid => ids.add(eid))
      g.eventChainIds.forEach(cid => {
        eventStore.getEventsByChain(cid).forEach(e => ids.add(e.id))
      })
    })
    return ids
  }, [hiddenGroupIds, groupStore, eventStore, events])

  const [dayCount, setDayCount] = useState(7)
  const weekStart = useMemo(() => getStartOfWeek(currentDate, 1), [currentDate])
  const viewDays = useMemo(() => getDays(currentDate, dayCount), [currentDate, dayCount])
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [slotH, setSlotH] = useState(80)
  useEffect(() => {
    const calc = () => { setSlotH(Math.max(40, Math.floor((window.innerHeight - 130) / 24))) }
    calc(); window.addEventListener('resize', calc); return () => window.removeEventListener('resize', calc)
  }, [])

  useEffect(() => {
    if (scrollRef.current && !isJumping()) scrollRef.current.scrollTop = 6 * slotH
  }, [currentDate, slotH])

  const selectedChainId = useMemo(() => {
    if (!selectedEventId) return null
    return eventStore.getEvent(selectedEventId)?.chainId || null
  }, [selectedEventId, eventStore])

  const chainNav = useMemo(() => {
    if (!selectedChainId) return { before: false, after: false }
    const ce = eventStore.getEventsByChain(selectedChainId)
    let b = false, a = false
    for (const e of ce) {
      if (new Date(e.startTime) < weekStart) b = true
      if (new Date(e.startTime) >= weekEnd) a = true
    }
    return { before: b, after: a }
  }, [selectedChainId, eventStore, weekStart])

  const filteredEvents = useMemo(() => {
    const end = new Date(viewDays[viewDays.length - 1].getTime() + 86400000)
    return Array.from(events.values()).filter(e =>
      e.startTime < end && e.endTime > viewDays[0] && !filterTypeIds.has(e.typeId) && (!hiddenEventIds || !hiddenEventIds.has(e.id))
    )
  }, [events, viewDays, filterTypeIds, hiddenEventIds])

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 dark:border-slate-800/60 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => { const p = new Date(currentDate); p.setDate(p.getDate() - dayCount); setCurrentDate(p) }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" /></button>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white min-w-40">
            {viewDays[0].toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} - {
              viewDays[viewDays.length - 1].toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
          </h2>
          <button onClick={() => { const n = new Date(currentDate); n.setDate(n.getDate() + dayCount); setCurrentDate(n) }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" /></button>

          {/* 天数选择器 */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 ml-2">
            <Columns className="w-3.5 h-3.5 text-slate-400 ml-1" />
            {DAY_OPTIONS.map(n => (
              <button key={n} onClick={() => setDayCount(n)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  dayCount === n ? 'bg-white dark:bg-slate-700 text-accent-600 dark:text-accent-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}>{n}天</button>
            ))}
          </div>
        </div>
        {selectedChainId && (
          <div className="flex items-center gap-2">
            {chainNav.before && (
              <button onClick={() => { const p = new Date(currentDate); p.setDate(p.getDate() - dayCount); setCurrentDate(p) }}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"><ArrowUp className="w-3 h-3" /> 前</button>)}
            {chainNav.after && (
              <button onClick={() => { const n = new Date(currentDate); n.setDate(n.getDate() + dayCount); setCurrentDate(n) }}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600">后 <ArrowDown className="w-3 h-3" /></button>)}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <button onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300 hover:bg-accent-100 dark:hover:bg-accent-900/30 shadow-sm transition-colors">
            今天
          </button>
          <button onClick={() => {
            setDayCount(7)
            const mon = new Date(currentDate)
            mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7))
            setCurrentDate(mon)
          }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-accent-50 dark:hover:bg-accent-900/20 hover:text-accent-600 dark:hover:text-accent-400 hover:border-accent-200 dark:hover:border-accent-700 shadow-sm transition-colors">
            📅 标准周
          </button>
        </div>
      </div>

      {/* 统一滚动区域：标题 sticky + 每日列 */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {/* 星期头 — sticky 置顶 */}
        <div className={`grid gap-px bg-slate-200 dark:bg-slate-800 sticky top-0 z-[15] shadow-sm`} style={{ gridTemplateColumns: `repeat(${dayCount}, 1fr)` }}>
        {viewDays.map((d, i) => {
          const dow = d.getDay() || 7
          const isToday = d.toDateString() === new Date().toDateString()
          return (
            <div key={d.toISOString()} className={`bg-white dark:bg-slate-800 px-4 py-3 ${isToday ? 'ring-2 ring-accent-500 ring-inset' : ''}`}>
              <div className={`font-bold ${isToday ? 'text-accent-600 dark:text-accent-400' : 'text-slate-900 dark:text-white'}`}>{DAY_NAMES[dow - 1]}</div>
              <div className={`text-sm ${isToday ? 'text-accent-500 dark:text-accent-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>{d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</div>
            </div>
          )
        })}
      </div>

        {/* 每日列 */}
        <div className={`grid gap-px bg-slate-200 dark:bg-slate-800`} style={{ gridTemplateColumns: `repeat(${dayCount}, 1fr)` }}>
          {viewDays.map(d => <DayColumn key={d.toISOString()} date={d} events={filteredEvents} />)}
        </div>
      </div>
    </div>
  )
}
