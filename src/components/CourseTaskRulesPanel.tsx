import { useState } from 'react'
import { Hash, SkipForward } from 'lucide-react'
import { CourseTaskRules, Event, EventChain, EventType } from '../types/event'
import AppPanel from './AppPanel'
import CourseTaskIcon from './CourseTaskIcon'
import { CourseTaskCategory, courseTaskCategory, courseTaskKind, courseTaskTime } from '../utils/courseTasks'
import { buildCourseTaskSchedule, holidaySource, taskCalendarDay } from '../utils/courseTaskSchedule'

const anchorKey = (category: CourseTaskCategory) => category === '实验' ? 'labAnchor' : category === '考试' ? 'examAnchor' : 'homeworkAnchor'
export default function CourseTaskRulesPanel({ course, tasks, types, onSave, onClose }: {
  course: EventChain; tasks: Event[]; types: EventType[]; onSave: (rules: CourseTaskRules) => Promise<void>; onClose: () => void
}) {
  const categories = (['实验', '作业', '考试'] as const).filter(category => tasks.some(e => courseTaskCategory(courseTaskKind(e, types)!) === category))
  const [category, setCategory] = useState<CourseTaskCategory>(categories[0] || '作业')
  const [rules, setRules] = useState<CourseTaskRules>(() => {
    const value = { ...course.taskRules }
    for (const c of ['实验', '作业', '考试'] as const) {
      const key = anchorKey(c), anchor = value[key]
      if (anchor && !tasks.some(e => e.id === anchor.eventId && courseTaskCategory(courseTaskKind(e, types)!) === c)) delete value[key]
    }
    return value
  })
  const [extra, setExtra] = useState((rules.extraSkipDates || []).join('\n')), [keep, setKeep] = useState((rules.keepDates || []).join('\n'))
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const dates = (text: string) => [...new Set(text.split(/[\s,，;；]+/).filter(Boolean))]
  const draft = { ...rules, extraSkipDates: dates(extra), keepDates: dates(keep) }
  const key = anchorKey(category), anchor = rules[key], selectedTasks = tasks.filter(e => courseTaskCategory(courseTaskKind(e, types)!) === category)
  const schedule = buildCourseTaskSchedule(tasks, types, [{ ...course, taskRules: draft }])
  return <AppPanel title={`${course.name} · 编号与跳过`} onClose={onClose}>
    <form className="task-rules-form space-y-3 text-sm" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await onSave(draft); onClose() } catch (e) { setError(e instanceof Error ? e.message : '保存失败') } finally { setBusy(false) } }}>
      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <h3 className="mb-2 flex items-center gap-2 font-semibold"><Hash size={12} />自动编号</h3>
        <div className="mb-2 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" aria-label="编号任务类别">{categories.map(c => <button key={c} type="button" aria-pressed={category === c} className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-xs ${category === c ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300' : 'text-slate-500'}`} onClick={() => setCategory(c)}><CourseTaskIcon kind={c === '实验' ? '实验课' : c} />{c}</button>)}</div>
        <label className="flex min-h-10 items-center justify-between gap-2">为{category}编号<input aria-label="自动编号" type="checkbox" checked={!!anchor} onChange={e => { const next = { ...rules }; if (e.target.checked) next[key] = { eventId: selectedTasks[0]?.id || '', number: 0 }; else delete next[key]; setRules(next) }} /></label>
        {anchor && <div className="space-y-2">
          <label className="block text-xs">选择一次任务<select aria-label="编号基准" className="workspace-input mt-1 w-full" value={anchor.eventId} onChange={e => setRules({ ...rules, [key]: { ...anchor, eventId: e.target.value } })}>{selectedTasks.map(e => <option value={e.id} key={e.id}>{taskCalendarDay(courseTaskTime(e, courseTaskKind(e, types)!))} · {courseTaskKind(e, types)} · {e.name}</option>)}</select></label>
          <label className="flex items-center justify-between gap-3 text-xs">将这次设为<input aria-label="这次是第几次" required type="number" min={0} max={100000} step={1} className="workspace-input w-24" value={anchor.number} onChange={e => setRules({ ...rules, [key]: { ...anchor, number: Number(e.target.value) } })} /></label>
          <p className="text-xs text-slate-500">允许从 0 开始，前后自动递推；负数留空。同组实验共用编号，不同类型分别计数。</p>
        </div>}
      </div>
      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <label className="flex min-h-10 items-center gap-2 font-medium"><SkipForward size={12} /><span className="flex-1">遇法定节假日自动跳过</span><input type="checkbox" checked={!!rules.skipHolidays} onChange={e => setRules({ ...rules, skipHolidays: e.target.checked })} /></label>
        <p className="mt-1 text-xs text-slate-500">跳过后不占编号；考试不受节假日规则影响。单次调整可右键或长按灯珠。</p>
        <details className="mt-2"><summary className="cursor-pointer py-2 text-xs text-indigo-600 dark:text-indigo-300">指定日期与假期说明</summary><div className="space-y-2">
          <label className="block text-xs">额外跳过日期<textarea aria-label="额外跳过日期" rows={2} className="workspace-input mt-1 w-full" placeholder="2026-09-21，每行一个日期" value={extra} onChange={e => setExtra(e.target.value)} /></label>
          <label className="block text-xs">照常进行日期<textarea aria-label="照常进行日期" rows={2} className="workspace-input mt-1 w-full" placeholder="需照常上课或提交的日期" value={keep} onChange={e => setKeep(e.target.value)} /></label>
          <p className="text-xs text-slate-500">日期规则作用于当天任务；实验按同组实验课日期判断，无实验课时按最早截止日期。单次手动跳过 / 恢复优先于日期规则。内置北京时间下的中国大陆 2026 年假期，其他年份请手动设置。</p>
          <a href={holidaySource} target="_blank" rel="noreferrer" className="text-xs text-indigo-600">查看 2026 年放假通知</a>
        </div></details>
      </div>
      <section aria-label="编号预览" className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><h3 className="mb-2 text-xs font-semibold">{category}预览 · {selectedTasks.length} 项</h3><div className="max-h-40 space-y-1 overflow-y-auto">{selectedTasks.map(e => { const entry = schedule.entries.get(e.id); return <div key={e.id} className="flex items-center gap-2 py-1 text-xs"><CourseTaskIcon kind={courseTaskKind(e, types)!} /><span className="min-w-0 flex-1"><span className="block truncate">{e.name}</span><span className="text-[10px] text-slate-500">{taskCalendarDay(courseTaskTime(e, courseTaskKind(e, types)!))}</span></span><span className={`shrink-0 rounded px-1.5 py-1 ${entry?.skipped ? 'text-slate-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'}`} title={entry?.reason}>{entry?.skipped ? '跳过' : entry?.sequence !== undefined ? `第 ${entry.sequence} 次` : '未编号'}</span></div> })}</div></section>
      {schedule.warnings.get(course.id)?.map(w => <p key={w} className="text-xs text-amber-700">{w}</p>)}
      {error && <p role="alert" className="text-rose-600">{error}</p>}
      <div className="sticky bottom-0 bg-white py-2 dark:bg-slate-900"><button disabled={busy} className="workspace-button primary w-full">保存编号与跳过规则</button></div>
    </form>
  </AppPanel>
}
