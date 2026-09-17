import { useEffect, useState } from 'react'
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
  const [count, setCount] = useState(7)
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
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">从今天开始</h3><label className="flex items-center gap-2 text-xs">显示天数<select aria-label="灯珠显示天数" className="rounded-lg border bg-transparent p-2 dark:border-slate-700" value={count} onChange={e => setCount(Number(e.target.value))}>{[7, 14, 30].map(n => <option key={n} value={n}>{n} 天</option>)}</select></label></div>
    <div className="flex flex-wrap gap-x-3 gap-y-2 text-[10px] text-slate-500">{(Object.keys(colors) as (keyof typeof colors)[]).map(status => <span key={status} className="flex items-center gap-1.5"><Lamp status={status} />{status}</span>)}</div>
    {overdue.length > 0 && <details open className="rounded-lg border border-rose-200 p-2 dark:border-rose-900"><summary className="cursor-pointer text-xs font-medium text-rose-600">此前逾期未完成 · {overdue.length} 项</summary>{overdue.map(e => taskButton(e, true))}</details>}
    <p className="text-xs text-slate-500">每门课程一行，日期从今天向右排列；灯珠按验收截止日亮起。点击任务可编辑，横滑可查看后续日期。</p>
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700" tabIndex={0} role="region" aria-label="每日灯珠表格，可横向滚动">
      <table className="w-full border-collapse text-xs" data-assignment-days>
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
