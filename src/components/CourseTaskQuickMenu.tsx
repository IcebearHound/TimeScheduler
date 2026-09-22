import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Circle, Hash, MoreHorizontal, SkipForward, X } from 'lucide-react'
import { Event } from '../types/event'
import { CourseTaskKind, courseTaskCompleted, courseTaskKinds } from '../utils/courseTasks'
import { TaskScheduleEntry } from '../utils/courseTaskSchedule'
import useDismissiblePanel from '../utils/useDismissiblePanel'
import CourseTaskIcon from './CourseTaskIcon'

export type TaskQuickChange = { completed: boolean } | { number: number | null } | { kind: CourseTaskKind } | { skipped: boolean }
export type TaskMenuPosition = { x: number; y: number }

export function TaskMenuSurface({ position, label, onClose, children }: { position: TaskMenuPosition; label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useDismissiblePanel(ref, true, onClose)
  useLayoutEffect(() => {
    const el = ref.current!
    const place = () => {
      const viewport = window.visualViewport
      const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0
      const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight
      el.style.maxHeight = `${height - 16}px`
      el.style.width = `${Math.min(268, width - 16)}px`
      el.style.left = `${Math.max(left + 8, Math.min(position.x, left + width - el.offsetWidth - 8))}px`
      el.style.top = `${Math.max(top + 8, Math.min(position.y, top + height - el.offsetHeight - 8))}px`
    }
    const observer = new ResizeObserver(place); observer.observe(el); place()
    window.addEventListener('resize', place); window.visualViewport?.addEventListener('resize', place); window.visualViewport?.addEventListener('scroll', place)
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.visualViewport?.removeEventListener('resize', place); window.visualViewport?.removeEventListener('scroll', place) }
  }, [position.x, position.y])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    ref.current?.focus({ preventScroll: true })
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  return createPortal(<>
    <div className="fixed inset-0 z-[9998]" onPointerDown={onClose} onContextMenu={e => { e.preventDefault(); onClose() }} />
    <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} data-task-quick-menu className="task-quick-menu fixed z-[9999] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-700 shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" onContextMenu={e => e.preventDefault()} onKeyDown={e => {
      if (e.key !== 'Tab') return
      const items = Array.from(ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)'))
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }}>{children}</div>
  </>, document.body)
}

export default function CourseTaskQuickMenu({ event, kind, schedule, position, onClose, onEdit, onRules, onChange }: {
  event: Event; kind: CourseTaskKind; schedule?: TaskScheduleEntry; position: TaskMenuPosition
  onClose: () => void; onEdit: () => void; onRules: () => void; onChange: (change: TaskQuickChange) => Promise<void>
}) {
  const [number, setNumber] = useState(String(schedule?.sequence ?? 0)), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const completed = courseTaskCompleted(event, kind, new Date())
  const apply = async (change: TaskQuickChange) => {
    setBusy(true); setError('')
    try { await onChange(change); onClose() } catch (e) { setError(e instanceof Error ? e.message : '保存失败'); setBusy(false) }
  }
  return <TaskMenuSurface position={position} label="任务快捷操作" onClose={onClose}>
    <div className="mb-1 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800"><CourseTaskIcon kind={kind} /><strong className="min-w-0 flex-1 truncate text-xs" title={event.name}>{event.name}</strong><button className="task-row-icon" aria-label="关闭任务快捷操作" onClick={onClose}><X size={12} /></button></div>
    <button disabled={busy} className="task-menu-item" onClick={() => void apply({ completed: !completed })}>{completed ? <Circle size={12} /> : <Check size={12} />}{completed ? '标记为未完成' : kind === '实验验收' ? '标记为已验收' : ['作业', '实验报告'].includes(kind) ? '标记为已提交' : '标记为已完成'}</button>
    <form className="my-1 rounded-lg bg-slate-50 p-2 dark:bg-slate-800" onSubmit={e => { e.preventDefault(); if (number.trim()) void apply({ number: Number(number) }) }}>
      <label className="mb-1 flex items-center gap-1.5 text-xs" htmlFor="task-quick-number"><Hash size={12} />本次编号</label>
      <div className="flex gap-1.5"><input id="task-quick-number" aria-label="快捷编号" type="number" min={0} max={100000} step={1} required disabled={busy || schedule?.skipped} className="workspace-input min-w-0 flex-1" value={number} onChange={e => setNumber(e.target.value)} /><button className="workspace-button" disabled={busy || schedule?.skipped}>应用</button></div>
      <p className="mt-1 text-[10px] text-slate-500">{schedule?.skipped ? '恢复本次后可设置编号' : '向前后自动编号，负数留空'}</p>
      {schedule?.sequence !== undefined && <button type="button" disabled={busy} className="mt-1 text-xs text-slate-500 underline" onClick={() => void apply({ number: null })}>清除该类编号</button>}
    </form>
    <label className="flex min-h-10 items-center gap-2 px-2 text-xs"><CourseTaskIcon kind={kind} />类型<select aria-label="快捷任务类型" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-transparent p-2 dark:border-slate-700 dark:bg-slate-900" disabled={busy} value={kind} onChange={e => void apply({ kind: e.target.value as CourseTaskKind })}>{courseTaskKinds.map(k => <option key={k}>{k}</option>)}</select></label>
    <button disabled={busy} className="task-menu-item" onClick={() => void apply({ skipped: !schedule?.skipped })}><SkipForward size={12} />{schedule?.skipped ? '恢复本次' : '跳过本次'}</button>
    {kind.startsWith('实验') && event.properties.labGroupId && <p className="px-2 pb-1 text-[10px] text-slate-500">跳过 / 恢复会同时调整同组实验事项</p>}
    <div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-800"><button className="task-menu-item" onClick={onRules}><Hash size={12} />编号与跳过规则</button><button className="task-menu-item" onClick={onEdit}><MoreHorizontal size={12} />打开详情</button></div>
    {error && <p role="alert" className="p-2 text-xs text-rose-600">{error}</p>}
  </TaskMenuSurface>
}
