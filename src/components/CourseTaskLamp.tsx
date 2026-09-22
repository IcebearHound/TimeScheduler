import { useEffect, useRef, useState } from 'react'
import { Event } from '../types/event'
import { CourseTaskKind, completionProperties, courseTaskCategory, courseTaskCompleted, courseTaskStatus, courseTaskTime } from '../utils/courseTasks'
import CourseTaskIcon from './CourseTaskIcon'
import { TaskScheduleEntry } from '../utils/courseTaskSchedule'

export default function CourseTaskLamp({ event, kind, now, detail = false, schedule, courseName, onToggle, onEdit, onMenu }: {
  event: Event; kind: CourseTaskKind; now: Date; detail?: boolean; courseName?: string
  onToggle: (event: Event, completed: boolean) => Promise<void>; onEdit: (event: Event) => void
  schedule?: TaskScheduleEntry
  onMenu: (event: Event, position: { x: number; y: number }) => void
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const pendingCommit = useRef<() => Promise<void>>()
  const [preview, setPreview] = useState<boolean>()
  const generation = useRef(0)
  const hold = useRef<ReturnType<typeof setTimeout>>(), start = useRef<{ x: number; y: number }>(), suppressClick = useRef(false)
  const cancel = () => { clearTimeout(timer.current); timer.current = undefined; pendingCommit.current = undefined; generation.current++; setPreview(undefined) }
  const cancelHold = () => { clearTimeout(hold.current); hold.current = undefined }
  useEffect(() => () => {
    clearTimeout(timer.current); clearTimeout(hold.current); generation.current++
    // Leaving the panel after a single click must not discard the requested change.
    if (timer.current) void pendingCommit.current?.()
  }, [event.id])
  const category = courseTaskCategory(kind), completed = preview ?? courseTaskCompleted(event, kind, now)
  const displayEvent = preview === undefined ? event : { ...event, properties: completionProperties(event, preview, now, kind === '实验课' || kind === '考试') }
  const status = schedule?.skipped ? '已跳过' : courseTaskStatus(displayEvent, kind, now), when = courseTaskTime(event, kind)
  const toggle = (delay: number) => {
    const next = !completed, version = ++generation.current
    setPreview(next)
    const commit = async () => {
      timer.current = undefined
      pendingCommit.current = undefined
      try { await onToggle(event, next) } catch { /* The parent reports the save error; restore the persisted colour below. */ }
      finally { if (version === generation.current) setPreview(undefined) }
    }
    if (delay) { pendingCommit.current = commit; timer.current = setTimeout(() => void commit(), delay) }
    else void commit()
  }
  const tone = schedule?.skipped ? 'bg-slate-100 text-slate-400 ring-slate-300 dark:bg-slate-800' : completed ? 'bg-emerald-100 text-emerald-700 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
    : kind === '考试' ? 'bg-rose-100 text-rose-700 ring-rose-400 dark:bg-rose-950 dark:text-rose-300'
    : status === '已逾期' ? 'bg-rose-100 text-rose-700 ring-rose-300 dark:bg-rose-950 dark:text-rose-300'
    : ['今日截止', '进行中'].includes(status) ? 'bg-amber-100 text-amber-700 ring-amber-300 dark:bg-amber-950 dark:text-amber-300'
    : 'bg-indigo-100 text-indigo-700 ring-indigo-300 dark:bg-indigo-950 dark:text-indigo-300'
  const label = `${kind}${schedule?.sequence !== undefined ? ` · 第 ${schedule.sequence} 次` : ''}${courseName ? ` · ${courseName}` : ''} · ${event.name} · ${when.toLocaleString('zh-CN')} · ${status}${schedule?.reason ? `（${schedule.reason}）` : ''}`
  return <button type="button" data-task-lamp={event.id} data-status={status} data-completed={completed} data-task-category={category}
    aria-pressed={completed} aria-label={label} aria-haspopup="dialog" title={`${label}\n单击切换完成状态；双击打开详情；右键或长按快捷调整`}
    onPointerDown={e => {
      suppressClick.current = false; cancelHold()
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return
      start.current = { x: e.clientX, y: e.clientY }
      const position = start.current
      hold.current = setTimeout(() => { cancel(); suppressClick.current = true; onMenu(event, position) }, 550)
    }}
    onPointerMove={e => { if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) cancelHold() }}
    onPointerUp={cancelHold} onPointerCancel={cancelHold}
    onClick={e => {
      e.stopPropagation()
      cancel()
      if (suppressClick.current && e.detail !== 0) return
      if (schedule?.skipped) { const box = e.currentTarget.getBoundingClientRect(); onMenu(event, { x: box.left, y: box.bottom }); return }
      if (e.detail === 0) { toggle(0); return }
      // Paint immediately; only persistence waits so a double click can cancel without a write.
      if (e.detail === 1) toggle(500)
    }}
    onDoubleClick={e => { e.stopPropagation(); cancel(); onEdit(event) }}
    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); cancel(); cancelHold(); suppressClick.current = true; onMenu(event, { x: e.clientX, y: e.clientY }) }}
    onKeyDown={e => { if (e.key === 'ContextMenu' || e.key === 'F10' && e.shiftKey) { e.preventDefault(); cancel(); const box = e.currentTarget.getBoundingClientRect(); onMenu(event, { x: box.left, y: box.bottom }) } }}
    className={`flex min-h-11 w-full rounded-lg hover:bg-slate-100 focus-visible:outline-indigo-500 dark:hover:bg-slate-800 ${detail ? 'items-start gap-2 p-2 text-left text-xs' : 'items-center justify-center'}`}>
    <span data-lamp-color={schedule?.skipped ? 'skipped' : completed ? 'completed' : status === '已逾期' ? 'overdue' : ['今日截止', '进行中'].includes(status) ? 'today' : 'pending'} className={`relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${tone}`}>
      <CourseTaskIcon kind={category === '实验' ? '实验课' : category} />
      {(schedule?.sequence !== undefined || schedule?.skipped) && <sub data-task-sequence={schedule.sequence} className="absolute -bottom-1.5 -right-1.5 rounded bg-white px-0.5 text-[9px] font-semibold leading-3 shadow-sm dark:bg-slate-900">{schedule.skipped ? '跳' : schedule.sequence}</sub>}
    </span>
    {detail && <span className="min-w-0 break-words"><span className="block font-medium">{event.name}</span><span className="block text-slate-500">{kind} · {when.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span><span className="text-slate-500">{status}</span></span>}
  </button>
}
