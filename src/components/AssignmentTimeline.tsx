import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Event, EventChain, EventType } from '../types/event'
import { courseTaskCompleted, courseTaskKind, courseTaskStatus, courseTaskTime } from '../utils/courseTasks'
import { buildCourseTaskSchedule } from '../utils/courseTaskSchedule'
import CourseTaskIcon from './CourseTaskIcon'
import CourseTaskLamp from './CourseTaskLamp'
import { Check } from 'lucide-react'
import { differenceInCalendarDays } from 'date-fns'
import CourseTaskQuickMenu, { TaskMenuPosition, TaskMenuSurface, TaskQuickChange } from './CourseTaskQuickMenu'

export const assignmentDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const colors = {
  '已完成': 'text-emerald-600 dark:text-emerald-400',
  '已逾期': 'text-rose-600 dark:text-rose-400',
  '今日截止': 'text-amber-600 dark:text-amber-400',
  '待处理': 'text-indigo-600 dark:text-indigo-300',
}
export default function AssignmentTimeline({ courses, tasks, types, onEdit, onToggle, onTypeChange, onRules, onQuickChange }: { courses: EventChain[]; tasks: Event[]; types: EventType[]; onEdit: (event: Event) => void; onToggle: (event: Event, completed: boolean) => Promise<void>; onTypeChange: (courseId: string, sourceTypeId: string, targetTypeId: string) => void; onRules: (courseId: string, typeId?: string) => void; onQuickChange: (id: string, change: TaskQuickChange) => Promise<void> }) {
  const [now, setNow] = useState(() => new Date())
  const [quick, setQuick] = useState<{ id: string; position: TaskMenuPosition } | null>(null)
  const [rowMenu, setRowMenu] = useState<{ courseId: string; typeId: string; position: TaskMenuPosition } | null>(null)
  const [overdueOpen, setOverdueOpen] = useState(() => !window.matchMedia('(max-width: 767px)').matches)
  const tableViewport = useRef<HTMLDivElement>(null)
  const columnMeasure = useRef<HTMLSpanElement>(null)
  const [dayWidth, setDayWidth] = useState(44)
  const [dayMode, setDayMode] = useState<'auto' | number>('auto')
  const [autoCount, setAutoCount] = useState(1)
  const [availableWidth, setAvailableWidth] = useState(0)
  const scrollLayout = useRef<{ historyDays: number; width: number; today: string; mode: 'auto' | number; viewportWidth: number }>()
  const scrollOffset = useRef(0)
  const count = dayMode === 'auto' ? autoCount : dayMode
  useLayoutEffect(() => {
    const viewport = tableViewport.current
    if (!viewport) return
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      // Fit the widest date/weekday or lamp target, with a little breathing room.
      const contentWidth = Math.max(window.matchMedia('(pointer: coarse)').matches ? 48 : 44, ...Array.from(columnMeasure.current?.children || []).map(el => el.getBoundingClientRect().width))
      const width = Math.ceil(contentWidth + .5 * rem)
      setDayWidth(width)
      setAvailableWidth(Math.max(0, viewport.clientWidth - 8 * rem))
      setAutoCount(Math.max(1, Math.min(30, Math.floor((viewport.clientWidth - 8 * rem) / width))))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    if (columnMeasure.current) observer.observe(columnMeasure.current)
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
  const today = assignmentDay(now)
  // Keep history in the same table so native touch/trackpad scrolling works in both directions.
  const historyDays = useMemo(() => tasks.reduce((days, task) => {
    const date = courseTaskTime(task, courseTaskKind(task, types)!)
    return Number.isNaN(+date) ? days : Math.max(days, differenceInCalendarDays(new Date(today + 'T00:00:00'), date))
  }, 30), [tasks, types, today])
  const columnWidth = Math.max(dayWidth, availableWidth / count)
  useLayoutEffect(() => {
    const viewport = tableViewport.current
    if (!viewport || !availableWidth) return
    const previous = scrollLayout.current
    // Preserve the date being viewed on resize or task edits; reset on a new day or display mode.
    const offset = previous && previous.today === today && previous.mode === dayMode
      ? scrollOffset.current : 0
    viewport.scrollLeft = (historyDays + offset) * columnWidth
    scrollLayout.current = { historyDays, width: columnWidth, today, mode: dayMode, viewportWidth: viewport.clientWidth }
    scrollOffset.current = offset
  }, [historyDays, columnWidth, today, dayMode, availableWidth, count])
  const dates = Array.from({ length: historyDays + count }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i - historyDays))
  const schedule = useMemo(() => buildCourseTaskSchedule(tasks, types, courses), [tasks, types, courses])
  const rows = courses.flatMap(course => types.filter(type => tasks.some(e => e.chainId === course.id && e.typeId === type.id)).map(type => ({ course, type })))
  const rowKey = (courseId: string, typeId: string) => JSON.stringify([courseId, typeId])
  const typeIcon = (type: EventType) => type.category === 'lab_report' || type.category === 'lab' || type.category === 'homework' || type.category === 'exam' ? <CourseTaskIcon kind={type.category === 'lab_report' ? '实验报告' : type.category === 'lab' ? '实验课' : type.category === 'homework' ? '作业' : '考试'} /> : <span className="text-xs" aria-hidden="true">{type.emoji}</span>
  const overdue = tasks.filter(e => !schedule.entries.get(e.id)?.skipped && courseTaskStatus(e, courseTaskKind(e, types)!, now) === '已逾期')
  const exams = tasks.filter(e => courseTaskKind(e, types) === '考试' && !schedule.entries.get(e.id)?.skipped && !courseTaskCompleted(e, '考试', now) && +e.endTime >= +now && +e.startTime - +now <= 7 * 86400000)
  const byCell = new Map<string, Event[]>()
  for (const task of tasks) {
    const key = `${assignmentDay(courseTaskTime(task, courseTaskKind(task, types)!))}/${rowKey(task.chainId, task.typeId)}`
    byCell.set(key, [...(byCell.get(key) || []), task])
  }
  const taskButton = (event: Event, showDate = false) => <CourseTaskLamp key={event.id} event={event} kind={courseTaskKind(event, types)!} courseName={courses.find(c => c.id === event.chainId)?.name} now={now} detail={showDate} schedule={schedule.entries.get(event.id)} onToggle={onToggle} onEdit={onEdit} onMenu={(event, position) => { setRowMenu(null); setQuick({ id: event.id, position }) }} />
  const quickEvent = quick && tasks.find(e => e.id === quick.id)
  return <section aria-label="每日课程任务总览" className="space-y-3">
    {exams.length > 0 && <div aria-label="近期考试提醒" className="rounded-xl border-2 border-rose-300 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-950"><h4 className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300"><CourseTaskIcon kind="考试" />未来 7 天考试 · {exams.length}</h4>{exams.map(e => <button key={e.id} type="button" onClick={() => onEdit(e)} className="mt-2 block min-h-11 w-full rounded-lg bg-white p-2 text-left text-sm dark:bg-slate-900"><strong className="block text-rose-700 dark:text-rose-300">{e.name} · {+e.startTime <= +now ? '正在考试' : `距开始 ${Math.ceil((+e.startTime - +now) / 3600000)} 小时`}</strong><span className="text-xs text-slate-500">{e.startTime.toLocaleString('zh-CN')} · {e.properties.location || e.properties['地点'] || '地点待设置'}</span></button>)}</div>}
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold">课程任务</h3><button type="button" className="min-h-11 rounded-lg px-2 text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950" onClick={() => { if (tableViewport.current) tableViewport.current.scrollLeft = historyDays * columnWidth }}>回到今天</button></div><label className="flex items-center gap-2 text-xs">显示天数<select aria-label="灯珠显示天数" className="rounded-lg border bg-transparent p-2 dark:border-slate-700" value={dayMode} onChange={e => { setDayMode(e.target.value === 'auto' ? 'auto' : Number(e.target.value)) }}><option value="auto">自动 · {autoCount} 天</option>{[7, 14, 30].map(n => <option key={n} value={n}>{n} 天</option>)}</select></label></div>
    <div className="flex flex-wrap gap-x-3 gap-y-2 text-xs text-slate-500"><span className="flex items-center gap-1.5"><CourseTaskIcon kind="作业" />作业</span><span className="flex items-center gap-1.5"><CourseTaskIcon kind="实验课" />实验</span><span className="flex items-center gap-1.5"><CourseTaskIcon kind="实验报告" />报告</span><span className="flex items-center gap-1.5 text-rose-600"><CourseTaskIcon kind="考试" />考试</span></div>
    <div className="flex flex-wrap gap-3 text-[10px]">{Object.entries(colors).map(([status, color]) => <span key={status} className={color}>{status}</span>)}</div>
    <div ref={tableViewport} onScroll={e => { const layout = scrollLayout.current; if (layout && e.currentTarget.clientWidth === layout.viewportWidth) { const offset = e.currentTarget.scrollLeft / layout.width - layout.historyDays; scrollOffset.current = Math.abs(offset) < .03 ? 0 : offset } }} className="relative overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700" tabIndex={0} role="region" aria-label="每日灯珠表格，可横向滚动">
      <span ref={columnMeasure} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex flex-col items-start text-xs tabular-nums"><span>12/31</span><span className="font-bold">星期日</span></span>
      <table className="w-full table-fixed border-collapse text-xs tabular-nums" style={{ width: `calc(8rem + ${dates.length * columnWidth}px)`, minWidth: `calc(8rem + ${dates.length * columnWidth}px)` }} data-assignment-days data-day-mode={dayMode} data-day-width={columnWidth} data-future-days={count}>
        <colgroup><col style={{ width: '8rem' }} />{dates.map(date => <col key={assignmentDay(date)} />)}</colgroup>
        <thead><tr className="bg-slate-50 dark:bg-slate-800"><th scope="col" className="sticky left-0 z-10 w-32 min-w-32 bg-slate-50 p-2 text-left dark:bg-slate-800">课程</th>{dates.map((date, index) => <th key={assignmentDay(date)} data-assignment-date={assignmentDay(date)} data-assignment-today={index === historyDays ? true : undefined} scope="col" className={`px-1 py-2 text-center ${index === historyDays ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : ''}`}><span className="block whitespace-nowrap">{index === historyDays ? '今天' : date.toLocaleDateString('zh-CN', { weekday: 'short' })}</span><span className="whitespace-nowrap font-normal">{date.getMonth() + 1}/{date.getDate()}</span></th>)}</tr></thead>
        <tbody>{rows.map(({ course, type }) => <tr key={rowKey(course.id, type.id)} data-assignment-course={course.id} data-assignment-type={type.id} className="border-t border-slate-100 dark:border-slate-800">
          <th scope="row" className="sticky left-0 z-10 bg-white p-2 text-left align-top dark:bg-slate-900">
            <div className="flex items-start justify-between gap-1"><button type="button" className="min-h-11 min-w-0 flex-1 break-words rounded-md text-left hover:bg-slate-100 focus-visible:outline-indigo-500 dark:hover:bg-slate-800" style={{ color: course.color }} aria-label={`${course.name} · ${type.name}编号与跳过`} aria-haspopup="dialog" title="点击课程名设置编号与跳过规则" onClick={() => onRules(course.id, type.id)}>{course.name}</button>
              <button type="button" aria-label={`${course.name} · ${type.name}事件类型`} aria-haspopup="dialog" aria-expanded={rowMenu?.courseId === course.id && rowMenu?.typeId === type.id} title={`${type.name} · 修改该行事件类型`} className="task-row-icon shrink-0" style={{ color: type.color }} onClick={e => { const box = e.currentTarget.getBoundingClientRect(); setQuick(null); setRowMenu({ courseId: course.id, typeId: type.id, position: { x: box.left, y: box.bottom } }) }}>{typeIcon(type)}</button>
            </div>
            {schedule.warnings.get(course.id)?.map(w => <span key={w} className="mt-1 block text-[10px] font-normal text-amber-700">{w}</span>)}
          </th>
          {dates.map((date, index) => {
            const daily = byCell.get(`${assignmentDay(date)}/${rowKey(course.id, type.id)}`) || []
            return <td key={assignmentDay(date)} data-task-date={assignmentDay(date)} className={`p-1 align-top ${index === historyDays ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : ''}`}>{daily.length ? daily.map(e => taskButton(e)) : <span aria-label="无任务" title="无任务" className="flex min-h-11 items-center justify-center text-slate-300">—</span>}</td>
          })}
        </tr>)}</tbody>
      </table>
    </div>
    {!rows.length && <p className="p-3 text-xs text-slate-400">暂无课程任务，点击“添加作业 / 实验”开始。</p>}
    <p className="text-xs text-slate-500">默认从今天显示，向左滚动可查看历史任务。点按切换完成，双击打开详情；右键或长按快速调整。点击课程名设置编号与跳过，右侧图标修改该行事件类型。</p>
    {overdue.length > 0 && <details open={overdueOpen} onToggle={e => setOverdueOpen(e.currentTarget.open)} className="rounded-lg border border-rose-200 p-2 dark:border-rose-900"><summary className="cursor-pointer text-xs font-medium text-rose-600">此前逾期未完成 · {overdue.length} 项</summary>{overdue.map(e => taskButton(e, true))}</details>}
    {quick && quickEvent && <CourseTaskQuickMenu key={quick.id} event={quickEvent} kind={courseTaskKind(quickEvent, types)!} schedule={schedule.entries.get(quick.id)} position={quick.position} onClose={() => setQuick(null)} onEdit={() => { setQuick(null); onEdit(quickEvent) }} onRules={() => { setQuick(null); onRules(quickEvent.chainId, quickEvent.typeId) }} onChange={change => onQuickChange(quick.id, change)} />}
    {rowMenu && <TaskMenuSurface position={rowMenu.position} label="整行事件类型" onClose={() => setRowMenu(null)}><p className="px-2 py-1 text-xs text-slate-500">修改这门课程的当前行</p>{types.map(type => <button key={type.id} className="task-menu-item" onClick={() => { onTypeChange(rowMenu.courseId, rowMenu.typeId, type.id); setRowMenu(null) }}>{typeIcon(type)}{type.name}{rowMenu.typeId === type.id && <Check size={12} className="ml-auto" />}</button>)}</TaskMenuSurface>}
  </section>
}
