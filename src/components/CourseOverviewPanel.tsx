import { useEffect, useMemo, useState } from 'react'
import { Pencil, CalendarClock } from 'lucide-react'
import useEventStore from '../stores/eventStore'
import useUIStore from '../stores/uiStore'
import { CourseTaskRules } from '../types/event'
import { buildCourseOverview, overviewKinds, sequenceLabel } from '../utils/courseOverview'
import { applyActions, captureArchive } from '../integrations/archive'
import { snapshotRevision } from '../integrations/contracts'
import AppPanel from './AppPanel'
import CourseTaskIcon from './CourseTaskIcon'

type Progress = NonNullable<CourseTaskRules['completedProgress']>
const formatDeadline = (date: Date | string) => new Date(date).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })
export default function CourseOverviewPanel() {
  const events = useEventStore(s => s.events), types = useEventStore(s => s.eventTypes), chains = useEventStore(s => s.eventChains)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id) }, [])
  const courses = useMemo(() => buildCourseOverview([...events.values()], [...types.values()], [...chains.values()], now), [events, types, chains, now])
  const [editing, setEditing] = useState<string | null>(null), [draft, setDraft] = useState<Progress>({})
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const selected = courses.find(c => c.course.id === editing)
  const openTask = (id: string) => { useUIStore.getState().setSelectedEvent(id); useUIStore.getState().openRightPanelTab('details') }
  return <section className="space-y-4" aria-label="课程概览">
    <div><h3 className="font-semibold">课程概览</h3><p className="mt-1 text-xs text-slate-500">下次待办优先显示逾期项 · 截止时间为北京时间</p></div>
    {!courses.length && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">暂无课程，请先添加课程或课程任务。</p>}
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}>
      {courses.map(({ course, items }) => <article key={course.id} data-course-overview={course.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <header className="mb-3 flex items-center gap-2"><span className="h-5 w-1 shrink-0 rounded-full" style={{ background: course.color }} /><h4 className="min-w-0 flex-1 break-words font-semibold">{course.name}</h4><button className="sidebar-panel-action" aria-label={`${course.name} · 调整完成进度`} title="调整完成进度" onClick={() => { setEditing(course.id); setDraft({ ...course.taskRules?.completedProgress }); setError('') }}><Pencil size={14} /></button></header>
        <p className="mb-1 text-[11px] text-slate-500">最新已完成</p>
        <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-50 p-2 dark:bg-slate-800" aria-label="最新已完成编号">
          {items.map(item => <div key={item.key} className="min-w-0 p-1" data-progress={item.key}><p className="text-[11px] text-slate-500">{item.label}{item.manual && <span className="ml-1 text-amber-600">手动</span>}</p><p className="mt-1 break-words text-xs font-semibold">{item.progress}</p></div>)}
        </div>
        <div className="space-y-2">{items.map(item => <div key={item.key} data-next-deadline={item.key} className={`rounded-xl border p-2.5 ${item.overdue ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30' : 'border-slate-100 dark:border-slate-800'}`}>
          <div className="mb-1 flex items-center gap-1.5 text-xs"><CourseTaskIcon kind={item.kind} /><span className="font-medium">下次{item.label}</span>{item.overdue && <span className="ml-auto font-semibold text-rose-600">已逾期</span>}</div>
          {item.next ? <button className="block min-h-11 w-full text-left" onClick={() => openTask(item.next!.id)} aria-label={`查看${item.kind}：${item.next.name}`}><span className={`flex items-start gap-1 text-sm font-semibold ${item.overdue ? 'text-rose-700 dark:text-rose-300' : 'text-indigo-700 dark:text-indigo-300'}`}><CalendarClock size={14} className="mt-0.5 shrink-0" />{formatDeadline(item.next.endTime)}</span><span className="mt-1 block break-words text-xs text-slate-500">{item.nextNumber !== undefined ? `${sequenceLabel(item.prefix, item.nextNumber)} · ` : ''}{item.next.name}{item.pendingCount > 1 ? ` · 另有 ${item.pendingCount - 1} 项待办` : ''}</span></button> : <p className="py-2 text-xs text-slate-400">暂无待办</p>}
        </div>)}</div>
      </article>)}
    </div>
    {selected && <AppPanel title={`${selected.course.name} · 完成进度`} onClose={() => setEditing(null)}><form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('')
      try {
        const snapshot = captureArchive(), course = snapshot.eventChains.find(c => c.id === editing)
        if (!course) throw new Error('课程已删除')
        await applyActions([{ op: 'set_course_task_rules', id: course.id, rules: { ...course.taskRules, completedProgress: draft } }], await snapshotRevision(snapshot))
        setEditing(null)
      } catch (error) { setError(error instanceof Error ? error.message : '保存失败') } finally { setBusy(false) }
    }}>
      <p className="text-sm text-slate-500">自动统计已完成任务的最新编号。手动调整仅修正概览显示，不改变任务状态或截止日期；可随时恢复自动统计。</p>
      {overviewKinds.map(item => <div key={item.key} className="space-y-2 rounded-xl border p-3 dark:border-slate-700"><label className="block text-sm font-medium">{item.label}进度<select aria-label={`${item.label}统计方式`} className="workspace-input mt-2 w-full" value={draft[item.key] === undefined ? 'auto' : draft[item.key] === null ? 'none' : 'manual'} onChange={e => { const next = { ...draft }; if (e.target.value === 'auto') delete next[item.key]; else next[item.key] = e.target.value === 'none' ? null : selected.items.find(i => i.key === item.key)?.number ?? 0; setDraft(next) }}><option value="auto">自动统计</option><option value="manual">手动指定编号</option><option value="none">暂无完成</option></select></label>{typeof draft[item.key] === 'number' && <label className="block text-xs">最新完成编号<input required aria-label={`${item.label}完成编号`} type="number" min={0} max={100000} step={1} className="workspace-input mt-1 w-full" value={Number.isFinite(draft[item.key]) ? draft[item.key]! : ''} onChange={e => setDraft({ ...draft, [item.key]: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>}</div>)}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <div className="flex flex-wrap gap-2"><button disabled={busy} className="workspace-button primary">保存完成进度</button><button type="button" className="workspace-button" onClick={() => setDraft({})}>全部恢复自动</button></div>
    </form></AppPanel>}
  </section>
}
