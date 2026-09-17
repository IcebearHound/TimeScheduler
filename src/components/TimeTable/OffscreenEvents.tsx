import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Event } from '../../types/event'
import useUIStore from '../../stores/uiStore'

/** Native sticky positioning keeps edge summaries on the calendar's scroll layer. */
export default function OffscreenEvents({ date, events, height }: { date: Date; events: Event[]; height: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState<{ above: Event[]; below: Event[] }>({ above: [], below: [] })
  const start = new Date(date); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)
  const dayStart = +start, dayEnd = +end
  const position = (time: Date) => (Math.max(dayStart, Math.min(dayEnd, +new Date(time))) - dayStart) / (dayEnd - dayStart) * height
  const sorted = useMemo(() => [...events].filter(e => +new Date(e.startTime) < dayEnd && +new Date(e.endTime) > dayStart).sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime)), [events, dayStart, dayEnd])
  useLayoutEffect(() => {
    const layer = ref.current, column = layer?.parentElement
    const scroll = column?.closest<HTMLElement>('[data-calendar-scroll]')
    if (!layer || !column || !scroll) return
    const header = scroll.querySelector<HTMLElement>('[data-calendar-header]')
    let frame = 0
    const updateItems = () => {
      frame = 0
      const rect = column.getBoundingClientRect(), viewport = scroll.getBoundingClientRect()
      const headerHeight = header?.getBoundingClientRect().height || 0
      const top = Math.max(0, viewport.top + headerHeight - rect.top), bottom = Math.min(height, viewport.bottom - rect.top)
      const above = top > 0 ? sorted.filter(e => position(e.startTime) < top + 64) : []
      const below = bottom < height ? sorted.filter(e => position(e.endTime) > bottom - 64) : []
      // React updates only list membership, never the position of the scrolling layer.
      setHidden(previous => previous.above.length === above.length && previous.below.length === below.length && previous.above.every((e, i) => e === above[i]) && previous.below.every((e, i) => e === below[i]) ? previous : { above, below })
    }
    const resize = () => {
      const headerHeight = header?.getBoundingClientRect().height || 0
      layer.style.setProperty('--edge-header-height', `${headerHeight}px`)
      layer.style.setProperty('--edge-viewport-height', `${Math.max(0, scroll.clientHeight - headerHeight)}px`)
      updateItems()
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(updateItems) }
    const observer = new ResizeObserver(resize)
    observer.observe(scroll); observer.observe(column); if (header) observer.observe(header)
    scroll.addEventListener('scroll', onScroll, { passive: true }); resize()
    return () => { observer.disconnect(); cancelAnimationFrame(frame); scroll.removeEventListener('scroll', onScroll) }
  }, [height, dayStart, dayEnd, sorted])
  const jump = (event: Event) => {
    const column = ref.current?.parentElement
    const scroll = column?.closest<HTMLElement>('[data-calendar-scroll]')
    if (column && scroll) scroll.scrollBy({ top: column.getBoundingClientRect().top - scroll.getBoundingClientRect().top + position(event.startTime) - scroll.clientHeight / 2, behavior: 'smooth' })
    useUIStore.getState().setSelectedEvent(event.id)
  }
  const time = (value: Date) => new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const shortTime = (value: Date) => new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return <div ref={ref} className="pointer-events-none absolute inset-0 z-20">
    <div data-calendar-edge-layer className="calendar-edge-layer">
      {([['上方', hidden.above], ['下方', hidden.below]] as const).map(([label, items]) => items.length > 0 && (
        <section key={label} aria-label={`${label}未完整显示的事件`} className={`pointer-events-auto absolute inset-x-0.5 rounded-lg border border-accent-200 bg-white/95 text-slate-700 shadow-md backdrop-blur dark:bg-slate-800/95 dark:text-slate-200 dark:border-slate-600 ${label === '上方' ? 'top-0' : 'bottom-0'}`}>
          <div className="px-2 text-[10px] font-semibold">{label === '上方' ? '↑' : '↓'} {label}还有 {items.length} 项</div>
          <div className="max-h-14 overflow-y-auto overscroll-contain">
            {items.map(e => <button key={e.id} onClick={() => jump(e)} title={`${e.name} · ${time(e.startTime)} — ${time(e.endTime)}`} className="block w-full border-t border-slate-100 px-2 py-1 text-left text-[10px] hover:bg-accent-50 dark:border-slate-700/60 dark:hover:bg-slate-700">
              <span className="block truncate font-medium">{e.name}</span><span className="block opacity-75">{new Date(e.startTime).toDateString() === new Date(e.endTime).toDateString() ? `${shortTime(e.startTime)} – ${shortTime(e.endTime)}` : <>{time(e.startTime)}<br />至 {time(e.endTime)}</>}</span>
            </button>)}
          </div>
        </section>
      ))}
    </div>
  </div>
}
