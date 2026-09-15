import { useEffect, useRef, useState } from 'react'
import { Event } from '../../types/event'
import useUIStore from '../../stores/uiStore'

/** A compact, independently scrollable stack at each visible edge of a day. */
export default function OffscreenEvents({ date, events, height }: { date: Date; events: Event[]; height: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [bounds, setBounds] = useState({ top: 0, bottom: height })
  useEffect(() => {
    const column = ref.current?.parentElement
    const scroll = column?.closest<HTMLElement>('[data-calendar-scroll]')
    if (!column || !scroll) return
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const rect = column.getBoundingClientRect(), viewport = scroll.getBoundingClientRect()
        const header = scroll.querySelector('[data-calendar-header]')?.getBoundingClientRect().height || 0
        setBounds({ top: Math.max(0, viewport.top + header - rect.top), bottom: Math.min(height, viewport.bottom - rect.top) })
      })
    }
    const observer = new ResizeObserver(update)
    observer.observe(scroll); observer.observe(column)
    scroll.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update); update()
    return () => { observer.disconnect(); cancelAnimationFrame(frame); scroll.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [height, date])
  const start = new Date(date); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)
  const position = (time: Date) => (Math.max(+start, Math.min(+end, +new Date(time))) - +start) / (+end - +start) * height
  const sorted = [...events].filter(e => +new Date(e.startTime) < +end && +new Date(e.endTime) > +start).sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime))
  const above = bounds.top > 0 ? sorted.filter(e => position(e.startTime) < bounds.top + 64) : []
  const below = bounds.bottom < height ? sorted.filter(e => position(e.endTime) > bounds.bottom - 64) : []
  const jump = (event: Event) => {
    const column = ref.current?.parentElement
    const scroll = column?.closest<HTMLElement>('[data-calendar-scroll]')
    if (column && scroll) scroll.scrollBy({ top: column.getBoundingClientRect().top - scroll.getBoundingClientRect().top + position(event.startTime) - scroll.clientHeight / 2, behavior: 'smooth' })
    useUIStore.getState().setSelectedEvent(event.id)
  }
  const time = (value: Date) => new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const shortTime = (value: Date) => new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return <div ref={ref} className="pointer-events-none absolute inset-0 z-20">
    {([['上方', above, bounds.top], ['下方', below, bounds.bottom]] as const).map(([label, items, edge]) => items.length > 0 && (
      <section key={label} aria-label={`${label}未完整显示的事件`} className="pointer-events-auto absolute inset-x-0.5 rounded-lg border border-accent-200 bg-white/95 text-slate-700 shadow-md backdrop-blur dark:bg-slate-800/95 dark:text-slate-200 dark:border-slate-600" style={label === '上方' ? { top: edge } : { bottom: height - edge }}>
        <div className="px-2 text-[10px] font-semibold">{label === '上方' ? '↑' : '↓'} {label}还有 {items.length} 项</div>
        <div className="max-h-14 overflow-y-auto overscroll-contain">
          {items.map(e => <button key={e.id} onClick={() => jump(e)} title={`${e.name} · ${time(e.startTime)} — ${time(e.endTime)}`} className="block w-full border-t border-slate-100 px-2 py-1 text-left text-[10px] hover:bg-accent-50 dark:border-slate-700 dark:hover:bg-slate-700">
            <span className="block truncate font-medium">{e.name}</span><span className="block opacity-75">{new Date(e.startTime).toDateString() === new Date(e.endTime).toDateString() ? `${shortTime(e.startTime)} – ${shortTime(e.endTime)}` : <>{time(e.startTime)}<br />至 {time(e.endTime)}</>}</span>
          </button>)}
        </div>
      </section>
    ))}
  </div>
}
