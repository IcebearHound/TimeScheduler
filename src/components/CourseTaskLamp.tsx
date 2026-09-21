import { useEffect, useRef } from 'react'
import { Event } from '../types/event'
import { CourseTaskKind, courseTaskCategory, courseTaskCompleted, courseTaskStatus, courseTaskTime } from '../utils/courseTasks'
import CourseTaskIcon from './CourseTaskIcon'
import { TaskScheduleEntry } from '../utils/courseTaskSchedule'

export default function CourseTaskLamp({ event, kind, now, detail = false, schedule, onToggle, onEdit }: {
  event: Event; kind: CourseTaskKind; now: Date; detail?: boolean
  onToggle: (event: Event) => void; onEdit: (event: Event) => void
  schedule?: TaskScheduleEntry
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const cancel = () => { clearTimeout(timer.current); timer.current = undefined }
  useEffect(() => () => clearTimeout(timer.current), [event.id])
  const category = courseTaskCategory(kind), completed = courseTaskCompleted(event, kind, now)
  const status = schedule?.skipped ? '已跳过' : courseTaskStatus(event, kind, now), when = courseTaskTime(event, kind)
  const tone = schedule?.skipped ? 'bg-slate-100 text-slate-400 ring-slate-300 dark:bg-slate-800' : completed ? 'bg-emerald-100 text-emerald-700 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
    : kind === '考试' ? 'bg-rose-100 text-rose-700 ring-rose-400 dark:bg-rose-950 dark:text-rose-300'
    : status === '已逾期' ? 'bg-rose-100 text-rose-700 ring-rose-300 dark:bg-rose-950 dark:text-rose-300'
    : ['今日截止', '进行中'].includes(status) ? 'bg-amber-100 text-amber-700 ring-amber-300 dark:bg-amber-950 dark:text-amber-300'
    : 'bg-indigo-100 text-indigo-700 ring-indigo-300 dark:bg-indigo-950 dark:text-indigo-300'
  const label = `${kind}${schedule?.sequence ? ` · 第 ${schedule.sequence} 次` : ''} · ${event.name} · ${when.toLocaleString('zh-CN')} · ${status}${schedule?.reason ? `（${schedule.reason}）` : ''}`
  return <button type="button" data-task-lamp={event.id} data-status={status} data-completed={completed} data-task-category={category}
    aria-pressed={completed} aria-label={label} title={`${label}\n单击切换完成状态；双击或右键打开详情`}
    onClick={e => {
      e.stopPropagation()
      cancel()
      if (schedule?.skipped) { onEdit(event); return }
      if (e.detail === 0) { onToggle(event); return }
      // Wait for the browser's second click before writing a single-click change.
      if (e.detail === 1) timer.current = setTimeout(() => { timer.current = undefined; onToggle(event) }, 500)
    }}
    onDoubleClick={e => { e.stopPropagation(); cancel(); onEdit(event) }}
    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); cancel(); onEdit(event) }}
    onKeyDown={e => { if (e.key === 'ContextMenu' || e.key === 'F10' && e.shiftKey) { e.preventDefault(); cancel(); onEdit(event) } }}
    className={`flex min-h-11 w-full rounded-lg hover:bg-slate-100 focus-visible:outline-indigo-500 dark:hover:bg-slate-800 ${detail ? 'items-start gap-2 p-2 text-left text-xs' : 'items-center justify-center'}`}>
    <span data-lamp-color={schedule?.skipped ? 'skipped' : completed ? 'completed' : status === '已逾期' ? 'overdue' : ['今日截止', '进行中'].includes(status) ? 'today' : 'pending'} className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${tone}`}>
      <CourseTaskIcon kind={category === '实验' ? '实验课' : category} />
      {(schedule?.sequence || schedule?.skipped) && <sub data-task-sequence={schedule.sequence} className="absolute -bottom-1 -right-1 rounded bg-white px-1 text-[10px] font-bold leading-4 shadow-sm dark:bg-slate-900">{schedule.skipped ? '跳' : schedule.sequence}</sub>}
    </span>
    {detail && <span className="min-w-0 break-words"><span className="block font-medium">{event.name}</span><span className="block text-slate-500">{kind} · {when.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span><span className="text-slate-500">{status}</span></span>}
  </button>
}
