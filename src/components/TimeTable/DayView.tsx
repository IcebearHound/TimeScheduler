/**
 * 日视图 - 24小时全覆盖，默认滚动到 6:00
 */
import React, { useMemo, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import useUIStore from '../../stores/uiStore'
import useEventStore from '../../stores/eventStore'
import { getStartOfDay, getEndOfDay } from '../../utils/dateUtils'
import DayColumn from './DayColumn'

export default function DayView() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentDate = useUIStore((s) => s.currentDate)
  const setCurrentDate = useUIStore((s) => s.setCurrentDate)
  const filterTypeIds = useUIStore((s) => s.filterTypeIds)
  const events = useEventStore((s) => s.events)

  const dayStart = useMemo(() => getStartOfDay(currentDate), [currentDate])
  const dayEnd = useMemo(() => getEndOfDay(currentDate), [currentDate])
  const dayEvents = useMemo(() =>
    Array.from(events.values()).filter(e =>
      e.startTime <= dayEnd && e.endTime >= dayStart && !filterTypeIds.has(e.typeId)
    ), [events, dayStart, dayEnd, filterTypeIds])
  const wd = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][currentDate.getDay()]
  const isToday = currentDate.toDateString() === new Date().toDateString()

  const [slotH, setSlotH] = useState(80)
  useEffect(() => {
    const calc = () => {
      const h = window.innerHeight - 110; setSlotH(Math.max(40, Math.floor(h / 24)))
    }
    calc(); window.addEventListener('resize', calc); return () => window.removeEventListener('resize', calc)
  }, [])

  // 默认滚动到 6:00
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 6 * slotH
  }, [currentDate, slotH])

  const nav = {
    p: () => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d) },
    n: () => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d) },
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <button onClick={nav.p} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" /></button>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white min-w-60">{currentDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' })} {wd}</h2>
          <button onClick={nav.n} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" /></button>
        </div>
        <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/40 shadow-sm transition-colors">今天</button>
      </div>
      <div className="flex-1 overflow-hidden">
        <div ref={scrollRef} className="flex h-full overflow-y-auto">
          <div className="w-16 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex-shrink-0">
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="flex items-start justify-end pr-2 pt-1 text-xs text-slate-500 dark:text-slate-400 font-medium" style={{ height: slotH, minHeight: 36 }}>
                {`${String(i).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>
          <div className="flex-1"><DayColumn date={currentDate} events={dayEvents} /></div>
        </div>
      </div>
    </div>
  )
}
