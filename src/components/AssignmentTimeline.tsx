import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Event, EventChain } from '../types/event'

export const assignmentDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const colors = {
  '已完成': 'bg-emerald-500 ring-emerald-200',
  '已逾期': 'bg-rose-500 ring-rose-200',
  '今日截止': 'bg-amber-500 ring-amber-200',
  '待验收': 'bg-indigo-500 ring-indigo-200',
  '无任务': 'bg-slate-200 ring-slate-100 dark:bg-slate-600 dark:ring-slate-700',
}
export function assignmentStatus(event: Event, now: Date): keyof typeof colors {
  if (event.properties.completed === 'true') return '已完成'
  if (+event.endTime < +now) return '已逾期'
  return assignmentDay(event.endTime) === assignmentDay(now) ? '今日截止' : '待验收'
}
function Lamp({ status }: { status: keyof typeof colors }) {
  return <span aria-hidden="true" className={`inline-block h-3 w-3 shrink-0 rounded-full ring-2 ${colors[status]}`} />
}

export default function AssignmentTimeline({ courses, tasks, onEdit }: { courses: EventChain[]; tasks: Event[]; onEdit: (event: Event) => void }) {
  const [now, setNow] = useState(() => new Date())
  const tableViewport = useRef<HTMLDivElement>(null)
  const [dayMode, setDayMode] = useState<'auto' | number>('auto')
  const [autoCount, setAutoCount] = useState(1)
  const count = dayMode === 'auto' ? autoCount : dayMode
  useLayoutEffect(() => {
    const viewport = tableViewport.current
    if (!viewport) return
    const measure = () => {
      // Match the table's 6rem course column and 8rem readable day columns.
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      setAutoCount(Math.max(1, Math.min(30, Math.floor((viewport.clientWidth - 6 * rem) / (8 * rem)))))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    window.addEventListener('resize', measure)
    measure()
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  useEffect(() => {
    const tick = () => setNow(new Date())
    const timer = window.setInterval(tick, 30000)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick) }
  }, [])
  const dates = Array.from({ length: count }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i))
  const overdue = tasks.filter(e => assignmentDay(e.endTime) < assignmentDay(now) && e.properties.completed !== 'true')
  const byCell = new Map<string, Event[]>()
  for (const task of tasks) {
    const key = `${assignmentDay(task.endTime)}/${task.chainId}`
    byCell.set(key, [...(byCell.get(key) || []), task])
  }
  const taskButton = (event: Event, showDate = false) => {
    const status = assignmentStatus(event, now)
    return <button key={event.id} type="button" data-task-lamp={event.id} data-status={status} onClick={() => onEdit(event)} title="修改任务详情" className="flex min-h-11 w-full items-start gap-2 rounded-lg p-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800">
      <span className="pt-1"><Lamp status={status} /></span>
      <span className="min-w-0 break-words"><span className="block font-medium">{event.name}</span><span className="block text-slate-500">{event.properties.taskKind} · {event.endTime.toLocaleString('zh-CN', { ...(showDate ? { month: 'numeric', day: 'numeric' } as const : {}), hour: '2-digit', minute: '2-digit' })}</span><span className="text-slate-500">{status}</span></span>
    </button>
  }
  return <section aria-label="每日课程任务灯珠" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">从今天开始</h3><label className="flex items-center gap-2 text-xs">显示天数<select aria-label="灯珠显示天数" className="rounded-lg border bg-transparent p-2 dark:border-slate-700" value={dayMode} onChange={e => { setDayMode(e.target.value === 'auto' ? 'auto' : Number(e.target.value)); if (tableViewport.current) tableViewport.current.scrollLeft = 0 }}><option value="auto">自动 · {autoCount} 天</option>{[7, 14, 30].map(n => <option key={n} value={n}>{n} 天</option>)}</select></label></div>
    <div className="flex flex-wrap gap-x-3 gap-y-2 text-[10px] text-slate-500">{(Object.keys(colors) as (keyof typeof colors)[]).map(status => <span key={status} className="flex items-center gap-1.5"><Lamp status={status} />{status}</span>)}</div>
    {overdue.length > 0 && <details open className="rounded-lg border border-rose-200 p-2 dark:border-rose-900"><summary className="cursor-pointer text-xs font-medium text-rose-600">此前逾期未完成 · {overdue.length} 项</summary>{overdue.map(e => taskButton(e, true))}</details>}
    <p className="text-xs text-slate-500">每门课程一行，日期从今天向右排列；灯珠按验收截止日亮起。点击任务可编辑。自动模式随面板宽度调整天数，也可选择 7 / 14 / 30 天并横滑查看。</p>
    <div ref={tableViewport} className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700" tabIndex={0} role="region" aria-label="每日灯珠表格，可横向滚动">
      <table className="w-full table-fixed border-collapse text-xs" style={{ minWidth: `${6 + count * 8}rem` }} data-assignment-days data-day-mode={dayMode}>
        <colgroup><col style={{ width: '6rem' }} />{dates.map(date => <col key={assignmentDay(date)} />)}</colgroup>
        <thead><tr className="bg-slate-50 dark:bg-slate-800"><th scope="col" className="sticky left-0 z-10 w-24 min-w-24 bg-slate-50 p-2 text-left dark:bg-slate-800">课程</th>{dates.map((date, index) => <th key={assignmentDay(date)} data-assignment-date={assignmentDay(date)} scope="col" className={`min-w-32 p-2 text-left ${index === 0 ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : ''}`}><span className="block">{index === 0 ? '今天' : date.toLocaleDateString('zh-CN', { weekday: 'short' })}</span><span className="whitespace-nowrap font-normal">{date.getMonth() + 1}/{date.getDate()}</span></th>)}</tr></thead>
        <tbody>{courses.map(course => <tr key={course.id} data-assignment-course={course.id} className="border-t border-slate-100 dark:border-slate-800">
          <th scope="row" className="sticky left-0 z-10 bg-white p-2 text-left align-top dark:bg-slate-900"><span className="block max-w-28 break-words" style={{ color: course.color }}>{course.name}</span></th>
          {dates.map((date, index) => {
            const daily = byCell.get(`${assignmentDay(date)}/${course.id}`) || []
            return <td key={assignmentDay(date)} data-task-date={assignmentDay(date)} className={`p-1 align-top ${index === 0 ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : ''}`}>{daily.length ? daily.map(e => taskButton(e)) : <span className="flex min-h-11 items-center gap-2 p-2 text-slate-400"><Lamp status="无任务" /><span>无任务</span></span>}</td>
          })}
        </tr>)}{!courses.length && <tr><td colSpan={count + 1} className="p-3 text-slate-400"><Lamp status="无任务" /> 暂无课程任务，点击“添加作业 / 实验”开始。</td></tr>}</tbody>
      </table>
    </div>
  </section>
}
