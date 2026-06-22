/**
 * 月视图 - 含事件链高亮
 */
import React, { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react'
import useUIStore from '../../stores/uiStore'
import useEventStore from '../../stores/eventStore'
import useEventGroupStore from '../../stores/eventGroupStore'
import { getMonthDays } from '../../utils/dateUtils'
import EventBlockItem from './EventBlockItem'

export default function MonthView() {
  const currentDate = useUIStore((s) => s.currentDate)
  const setCurrentDate = useUIStore((s) => s.setCurrentDate)
  const setViewMode = useUIStore((s) => s.setViewMode)
  const filterTypeIds = useUIStore((s) => s.filterTypeIds)
  const hiddenGroupIds = useUIStore((s) => s.hiddenGroupIds)
  const selectedEventId = useUIStore((s) => s.selectedEventId)
  const events = useEventStore((s) => s.events)
  const eventStore = useEventStore.getState()
  const groupStore = useEventGroupStore.getState()
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const monthDays = useMemo(() => getMonthDays(currentDate), [currentDate])
  const dayNames = ['日', '一', '二', '三', '四', '五', '六']

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

  const selectedChainId = useMemo(() => {
    if (!selectedEventId) return null
    return eventStore.getEvent(selectedEventId)?.chainId || null
  }, [selectedEventId, eventStore])

  const monthEvents = useMemo(() => {
    return Array.from(events.values()).filter(e => {
      const d = new Date(e.startTime)
      return d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth()
        && !filterTypeIds.has(e.typeId) && (!hiddenEventIds || !hiddenEventIds.has(e.id))
    })
  }, [events, currentDate, filterTypeIds, hiddenEventIds])

  const chainMonthIds = useMemo(() => {
    if (!selectedChainId) return new Set<string>()
    return new Set(monthEvents.filter(e => e.chainId === selectedChainId && e.id !== selectedEventId).map(e => e.id))
  }, [selectedChainId, monthEvents, selectedEventId])

  const nav = { p: () => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d) }, n: () => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d) } }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-4">
          <button onClick={nav.p} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" /></button>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{currentDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}</h2>
          <button onClick={nav.n} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" /></button>
        </div>
        {selectedChainId && (
          <div className="flex gap-2">
            <button onClick={nav.p} className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"><ArrowUp className="w-3 h-3" /> 前月</button>
            <button onClick={nav.n} className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600">后月 <ArrowDown className="w-3 h-3" /></button>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300 hover:bg-accent-100 dark:hover:bg-accent-900/30 shadow-sm transition-colors">今天</button>
          <button onClick={() => {
            const mon = new Date(currentDate)
            mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7))
            setCurrentDate(mon)
            setViewMode('week')
          }} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-accent-50 dark:hover:bg-accent-900/20 hover:text-accent-600 dark:hover:text-accent-400 hover:border-accent-200 shadow-sm transition-colors">
            📅 标准周
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 sticky top-0 z-[15]">
          {dayNames.map(d => <div key={d} className="bg-slate-50 dark:bg-slate-800 px-2 py-3 text-center font-bold text-slate-700 dark:text-slate-300 text-sm">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800">
          {monthDays.map((day, i) => {
            const de = monthEvents.filter(e => {
              const dayEnd = new Date(day.getTime() + 86400000)
              return new Date(e.startTime) < dayEnd && new Date(e.endTime) > day
            })
            const isCM = day.getMonth() === currentDate.getMonth()
            const isT = day.getFullYear() === new Date().getFullYear() && day.getMonth() === new Date().getMonth() && day.getDate() === new Date().getDate()
            return (
              <div key={i} onClick={() => setSelectedDay(day)} onDoubleClick={() => { setCurrentDate(day); setViewMode('week') }}
                className={`min-h-24 p-1.5 bg-white dark:bg-slate-800 cursor-pointer ${isCM ? '' : 'bg-slate-50 dark:bg-slate-900'} ${isT ? 'bg-accent-50/50 dark:bg-accent-900/10' : ''} ${selectedDay && selectedDay.toDateString() === day.toDateString() ? 'ring-2 ring-accent-400 ring-inset' : ''}`}>
                <div className={`text-sm font-bold mb-1 flex items-center gap-1 ${isCM ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
                  {day.getDate()}
                  {isT && <span className="w-1.5 h-1.5 rounded-full bg-accent-500 inline-block" title="今天" />}
                </div>
                <div className="space-y-0.5">
                  {de.slice(0, 4).map(e => <EventBlockItem key={e.id} event={e} compact isHighlighted={chainMonthIds.has(e.id)} />)}
                  {de.length > 4 && <div className="text-xs px-2 py-0.5 text-slate-400 truncate rounded bg-slate-50 dark:bg-slate-700/30">+{de.length - 4} 更多</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
