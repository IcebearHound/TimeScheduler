import { useState } from 'react'
import { CourseTaskRules, Event, EventChain, EventType } from '../types/event'
import AppPanel from './AppPanel'
import { courseTaskCategory, courseTaskKind, courseTaskTime } from '../utils/courseTasks'
import { buildCourseTaskSchedule, holidaySource, taskCalendarDay } from '../utils/courseTaskSchedule'

export default function CourseTaskRulesPanel({ course, tasks, types, onSave, onClose }: {
  course: EventChain; tasks: Event[]; types: EventType[]; onSave: (rules: CourseTaskRules) => Promise<void>; onClose: () => void
}) {
  const current = course.taskRules || {}, initial = current.labAnchor || current.homeworkAnchor || current.examAnchor
  const [numbering, setNumbering] = useState(!!initial), [anchorId, setAnchorId] = useState(initial?.eventId || tasks[0]?.id || '')
  const [number, setNumber] = useState(initial?.number || 1), [skip, setSkip] = useState(!!current.skipHolidays)
  const [extra, setExtra] = useState((current.extraSkipDates || []).join('\n')), [keep, setKeep] = useState((current.keepDates || []).join('\n'))
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const dates = (text: string) => [...new Set(text.split(/[\s,，;；]+/).filter(Boolean))]
  const rules: CourseTaskRules = { ...current, skipHolidays: skip, extraSkipDates: dates(extra), keepDates: dates(keep) }
  if (!numbering) { delete rules.labAnchor; delete rules.homeworkAnchor; delete rules.examAnchor }
  else {
    const anchor = tasks.find(e => e.id === anchorId), kind = anchor && courseTaskKind(anchor, types)
    if (kind) rules[courseTaskCategory(kind) === '实验' ? 'labAnchor' : kind === '考试' ? 'examAnchor' : 'homeworkAnchor'] = { eventId: anchorId, number }
  }
  const schedule = buildCourseTaskSchedule(tasks, types, [{ ...course, taskRules: rules }])
  return <AppPanel title={`${course.name} · 编号与跳过`} onClose={onClose}>
    <form className="space-y-4 text-sm" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await onSave(rules); onClose() } catch (e) { setError(e instanceof Error ? e.message : '保存失败') } finally { setBusy(false) } }}>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={numbering} onChange={e => setNumbering(e.target.checked)} />自动编号</label>
      {numbering && <div className="space-y-2"><label className="block">编号基准<select aria-label="编号基准" className="workspace-input" value={anchorId} onChange={e => { setAnchorId(e.target.value); const item = tasks.find(t => t.id === e.target.value)!; const kind = courseTaskKind(item, types)!; setNumber((kind === '考试' ? current.examAnchor : kind === '作业' ? current.homeworkAnchor : current.labAnchor)?.number || 1) }}>{tasks.map(e => <option value={e.id} key={e.id}>{taskCalendarDay(courseTaskTime(e, courseTaskKind(e, types)!))} · {courseTaskKind(e, types)} · {e.name}</option>)}</select></label>
        <label className="block">这次是第几次<input aria-label="这次是第几次" required type="number" min={1} max={100000} step={1} className="workspace-input" value={number} onChange={e => setNumber(Number(e.target.value))} /></label>
        <p className="text-xs text-slate-500">从基准向前、向后编号。同组实验课、验收和报告共用编号；作业与实验分别计数。</p></div>}
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={skip} onChange={e => setSkip(e.target.checked)} />遇法定节假日自动跳过</label>
      <p className="text-xs text-slate-500">按北京时间判断，内置中国大陆 2026 年放假日期（含调休假期，不含补班日）。其他年份请填写跳过日期。学校自行调课可用“照常进行日期”覆盖。考试不会因法定节假日自动跳过。</p>
      <a href={holidaySource} target="_blank" rel="noreferrer" className="text-xs text-indigo-600">查看国务院 2026 年放假通知</a>
      <label className="block">额外跳过日期<textarea aria-label="额外跳过日期" className="workspace-input" placeholder="2026-09-21，每行一个日期" value={extra} onChange={e => setExtra(e.target.value)} /></label>
      <label className="block">照常进行日期<textarea aria-label="照常进行日期" className="workspace-input" placeholder="填写需要照常上课或交作业的假期日期" value={keep} onChange={e => setKeep(e.target.value)} /></label>
      <p className="text-xs text-slate-500">实验按该组实验课日期判断，未关联实验课则按最早截止日期；作业按截止日期。已跳过的记录保留、不占编号、不进入 TODO；关闭规则可恢复。</p>
      {schedule.warnings.get(course.id)?.map(w => <p key={w} className="text-xs text-amber-700">{w}</p>)}
      <div aria-label="编号预览" className="max-h-48 space-y-1 overflow-auto rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800">{tasks.map(e => { const entry = schedule.entries.get(e.id); return <p key={e.id}>{taskCalendarDay(courseTaskTime(e, courseTaskKind(e, types)!))} · {e.name} · {entry?.skipped ? `跳过（${entry.reason}）` : entry?.sequence ? `第 ${entry.sequence} 次` : '未编号'}</p> })}</div>
      {error && <p role="alert" className="text-rose-600">{error}</p>}
      <button disabled={busy} className="workspace-button primary">保存编号与跳过规则</button>
    </form>
  </AppPanel>
}
