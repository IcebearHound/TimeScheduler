import useUIStore from '../stores/uiStore'
import AppPanel from './AppPanel'
import { useMemo, useRef, useState } from 'react'
import AssignmentTimeline from './AssignmentTimeline'
import * as XLSX from 'xlsx'
import useEventStore from '../stores/eventStore'
import { Event } from '../types/event'
import { applyActions, captureArchive } from '../integrations/archive'
import { Action, snapshotRevision } from '../integrations/contracts'
import { AssignmentRow, assignmentActions, localDateTime, readAssignmentWorkbook, safeSubmissionLink } from '../utils/assignmentTable'
import { CourseTaskKind, courseTaskCategory, courseTaskCompleted, courseTaskKind, courseTaskKinds, courseTaskStatus, courseTaskTime, nextLabClass, sortedCourseTasks } from '../utils/courseTasks'
import { CourseTaskInput, configureCourseTaskRulesActions, createCourseTaskActions, setCourseRowCategoryActions, setCourseTaskStatusActions, setCourseTaskNumberActions, setCourseTaskKindActions, setCourseTaskSkipActions, updateCourseTaskActions } from '../integrations/courseTasks'
import type { TaskQuickChange } from './CourseTaskQuickMenu'
import CourseTaskIcon from './CourseTaskIcon'
import CourseTaskRulesPanel from './CourseTaskRulesPanel'
import { buildCourseTaskSchedule } from '../utils/courseTaskSchedule'
import { createWeeklyTaskActions } from '../utils/weeklyTasks'

const empty: AssignmentRow = { course: '', name: '', deadline: '', kind: '作业', link: '', submission: '', content: '', notes: '' }
export default function AssignmentPanel() {
  const events = useEventStore(s => s.events), chains = useEventStore(s => s.eventChains), types = useEventStore(s => s.eventTypes)
  const [form, setForm] = useState<AssignmentRow>(empty), [editing, setEditing] = useState<string | null>(null)
  const [message, setMessage] = useState(''), [paste, setPaste] = useState(''), [preview, setPreview] = useState<{ rows: AssignmentRow[]; actions: Action[]; revision: string } | null>(null)
  const [menu, setMenu] = useState(false), [mode, setMode] = useState<'quick' | 'table' | null>(null)
  const [busy, setBusy] = useState(false)
  const [acceptance, setAcceptance] = useState(''), [report, setReport] = useState('')
  const [rulesCourseId, setRulesCourseId] = useState<string | null>(null)
  const [weekly, setWeekly] = useState(false), [repeatCount, setRepeatCount] = useState(16), [intervalWeeks, setIntervalWeeks] = useState(1)
  const [skipHoliday, setSkipHoliday] = useState(false)
  const transaction = useRef(Promise.resolve())
  const enqueue = (job: () => Promise<void>) => { transaction.current = transaction.current.then(() => run(job)) }
  const quickChange = (id: string, change: TaskQuickChange) => {
    const result = transaction.current.then(async () => {
      const current = captureArchive()
      const actions = 'number' in change ? setCourseTaskNumberActions(current, id, change.number) : 'kind' in change ? setCourseTaskKindActions(current, id, change.kind) : 'skipped' in change ? setCourseTaskSkipActions(current, id, change.skipped) : setCourseTaskStatusActions(current, id, change.completed)
      if (actions.length) await applyActions(actions, await snapshotRevision(current))
      setMessage('快捷调整已保存，可撤销')
    })
    transaction.current = result.catch(() => {})
    return result
  }
  const scheduled = ['实验课', '考试'].includes(form.kind)
  const editor = useRef<HTMLFormElement>(null)
  const taskTypes = useMemo(() => [...types.values()], [types])
  const tasks = useMemo(() => sortedCourseTasks([...events.values()], taskTypes), [events, taskTypes])
  const schedule = useMemo(() => buildCourseTaskSchedule(tasks, taskTypes, [...chains.values()]), [tasks, taskTypes, chains])
  const revealEditor = () => { setMode('quick'); setMenu(false); setMessage('') }
  const courses = useMemo(() => { const ids = new Set(tasks.map(e => e.chainId)); return [...chains.values()].filter(c => ids.has(c.id)) }, [chains, tasks])
  const edit = (e: Event) => { setEditing(e.id); setAcceptance(''); setReport(''); setForm({ course: e.chainId, name: e.name, startTime: localDateTime(new Date(e.startTime)), deadline: localDateTime(new Date(e.endTime)), kind: courseTaskKind(e, taskTypes)!, labGroupId: e.properties.labGroupId, link: e.properties.submissionUrl || '', submission: e.properties.submissionMethod || '', content: e.properties.taskContent || '', notes: e.properties.notes || '' }); revealEditor() }
  const startNew = (course = '') => { const row = tasks.filter(e => chains.get(e.chainId)?.name === course); const category = row.length ? courseTaskCategory(courseTaskKind(row[0], taskTypes)!) : '作业'; setEditing(null); setForm({ ...empty, course, kind: category === '实验' ? '实验课' : category }); setAcceptance(''); setReport(''); setWeekly(false); setSkipHoliday(false); revealEditor() }
  const related = form.labGroupId ? tasks.filter(e => e.properties.labGroupId === form.labGroupId && e.id !== editing && e.chainId === events.get(editing || '')?.chainId) : []
  const hasAcceptance = related.some(e => courseTaskKind(e, taskTypes) === '实验验收')
  const hasReport = related.some(e => courseTaskKind(e, taskTypes) === '实验报告')
  const run = async (job: () => Promise<void>) => { setBusy(true); setMessage(''); try { await job() } catch (e) { setMessage(e instanceof Error ? e.message : '操作失败') } finally { setBusy(false) } }
  const prepare = async (book: XLSX.WorkBook) => {
    const rows = readAssignmentWorkbook(book), snapshot = captureArchive()
    setPreview({ rows, actions: assignmentActions(snapshot, rows), revision: await snapshotRevision(snapshot) })
  }
  return <div className="assignment-panel space-y-5">
    <div className="relative flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">作业 / 实验</h3><button type="button" aria-expanded={menu} className="workspace-button" onClick={() => setMenu(!menu)}>＋ 添加作业 / 实验</button>
      {menu && <><button aria-label="关闭添加任务菜单" data-dismiss-layer className="fixed inset-0 z-40" onClick={() => setMenu(false)} /><div role="menu" className="absolute right-0 top-full z-50 mt-1 rounded-xl border bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800"><button role="menuitem" className="workspace-button block w-full" onClick={() => startNew()}>快捷添加</button><button role="menuitem" className="workspace-button mt-1 block w-full" onClick={() => { setMode('table'); setMenu(false) }}>从表格获取</button></div></>}
    </div>
    <div onDoubleClick={e => { if (!(e.target as HTMLElement).closest('button, input, select, textarea, summary, a')) { window.getSelection()?.removeAllRanges(); useUIStore.getState().setRightPanelExpanded(!useUIStore.getState().rightPanelExpanded) } }}><p className="hidden text-[10px] text-slate-400 md:block">双击面板空白处可全屏放大；也可使用右上角放大按钮。</p><AssignmentTimeline courses={courses} tasks={tasks} types={taskTypes} onEdit={edit} onRules={setRulesCourseId} onQuickChange={quickChange} onToggle={event => enqueue(async () => { const current = captureArchive(), e = current.events.find(e => e.id === event.id); if (!e) throw new Error('该任务已删除'); await applyActions(setCourseTaskStatusActions(current, e.id, !courseTaskCompleted(e, courseTaskKind(e, current.eventTypes)!, new Date())), await snapshotRevision(current)); setMessage('已更新完成状态，可撤销') })} onCategoryChange={(id, category) => enqueue(async () => { const current = captureArchive(), actions = setCourseRowCategoryActions(current, id, category); if (actions.length) await applyActions(actions, await snapshotRevision(current)); setMessage(`该行已改为${category}，可撤销`) })} /></div>
    {rulesCourseId && chains.get(rulesCourseId) && <CourseTaskRulesPanel key={rulesCourseId} course={chains.get(rulesCourseId)!} tasks={tasks.filter(e => e.chainId === rulesCourseId)} types={taskTypes} onClose={() => setRulesCourseId(null)} onSave={async rules => { const current = captureArchive(); await applyActions(configureCourseTaskRulesActions(current, rulesCourseId, rules), await snapshotRevision(current)); setMessage('编号与跳过规则已保存，可撤销') }} />}
    <details className="space-y-3"><summary className="cursor-pointer text-sm font-medium">全部课程任务 · {tasks.length} 项（含历史与远期）</summary>
    <div className="space-y-3" aria-label="课程任务线路">
      {!courses.length && <p className="p-6 text-center text-slate-500">暂无课程任务，添加实验课、验收、报告或作业后显示。</p>}
      {courses.map(c => {
        const courseTasks = tasks.filter(e => e.chainId === c.id)
        return <div key={c.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="flex items-center justify-between"><strong style={{ color: c.color }}>{c.name}</strong><button className="workspace-button" onClick={() => startNew(c.name)}>＋ 添加任务</button></div>
          <p className="mt-1 text-xs text-slate-500">{courseTaskKinds.slice(1).map(kind => `${kind === '实验验收' ? '待验收' : kind === '实验报告' ? '待交报告' : kind === '考试' ? '待考试' : '待交作业'} ${courseTasks.filter(e => courseTaskKind(e, taskTypes) === kind && !schedule.entries.get(e.id)?.skipped && !courseTaskCompleted(e, kind, new Date())).length}`).join(' · ')}</p>
          <div className="flex gap-6 overflow-x-auto py-3">
            {courseTasks.map(e => <button key={e.id} onClick={() => edit(e)} className="relative min-w-32 text-left text-xs" title="修改任务详情">
              <span className="absolute left-2 right-[-24px] top-2 h-0.5" style={{ background: c.color }} />
              <span className="relative mb-2 block w-fit bg-white dark:bg-slate-900"><CourseTaskIcon kind={courseTaskKind(e, taskTypes)!} /></span>
              <span className="block font-medium">{e.name}</span><span className="block text-slate-500">{courseTaskTime(e, courseTaskKind(e, taskTypes)!).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <span>{courseTaskKind(e, taskTypes)} · {courseTaskStatus(e, courseTaskKind(e, taskTypes)!, new Date())}</span>
            </button>)}
          </div>
        </div>
      })}
    </div>
    </details>
    {mode === 'quick' && <AppPanel title={editing ? '修改任务详情' : '快捷添加作业 / 实验'} onClose={() => setMode(null)}><form ref={editor} className="assignment-form" onSubmit={event => { event.preventDefault(); void run(async () => {
      const snapshot = captureArchive(), revision = await snapshotRevision(snapshot)
      const group = form.labGroupId || (form.kind === '实验课' ? crypto.randomUUID() : undefined)
      const extraRows: AssignmentRow[] = form.kind === '实验课' ? [
        ...(!hasAcceptance && acceptance ? [{ ...form, kind: '实验验收', deadline: acceptance, startTime: '', labGroupId: group }] : []),
        ...(!hasReport && report ? [{ ...form, kind: '实验报告', deadline: report, startTime: '', labGroupId: group }] : []),
      ] : []
      if (editing) {
        const e = events.get(editing); if (!e) throw new Error('该任务已删除')
        const actions = updateCourseTaskActions(snapshot, editing, { name: form.name, endTime: new Date(form.deadline).toISOString(), ...(scheduled ? { startTime: new Date(form.startTime!).toISOString() } : {}), submissionUrl: safeSubmissionLink(form.link), submissionMethod: form.submission, taskContent: form.content, notes: form.notes })
        const target = snapshot.eventChains.find(c => c.id === form.course)
        if (!target) throw new Error('请选择所属事件链')
        if (actions[0].op === 'update_event') actions[0].changes.chainId = target.id
        if (group && actions[0].op === 'update_event') actions[0].changes.properties = { ...actions[0].changes.properties, labGroupId: group }
        for (const row of extraRows) actions.push(...createCourseTaskActions(snapshot, { courseId: target.id, name: form.name, kind: row.kind as '实验验收' | '实验报告', endTime: new Date(row.deadline).toISOString(), labGroupId: group }))
        await applyActions(actions, revision)
      } else {
        const matches = snapshot.eventChains.filter(c => c.name === form.course.trim())
        if (matches.length > 1) throw new Error('存在同名课程，请先重命名课程链')
        let chain = matches[0]
        const actions: Action[] = []
        if (!chain) {
          const typeId = snapshot.eventTypes.find(t => t.category === 'course')?.id
          if (!typeId) throw new Error('请先创建课程事件类型')
          const stamp = new Date().toISOString()
          chain = { id: crypto.randomUUID(), name: form.course.trim(), typeId, color: '#6366f1', defaultReminders: [], createdAt: stamp, updatedAt: stamp }
          actions.push({ op: 'create_chain', id: chain.id, chain: { name: chain.name, typeId, color: chain.color, defaultReminders: [] } })
        }
        const context = { ...snapshot, eventChains: matches.length ? snapshot.eventChains : [...snapshot.eventChains, chain] }
        const inputs: CourseTaskInput[] = [{ ...form, labGroupId: group }, ...extraRows].map(row => ({ courseId: chain.id, name: row.name, kind: row.kind as CourseTaskKind, endTime: new Date(row.deadline).toISOString(), ...(['实验课', '考试'].includes(row.kind) ? { startTime: new Date(row.startTime!).toISOString() } : {}), ...(row.labGroupId ? { labGroupId: row.labGroupId } : {}), submissionUrl: row.link, submissionMethod: row.submission, taskContent: row.content, notes: row.notes }))
        actions.push(...createWeeklyTaskActions(context, inputs, { count: weekly ? repeatCount : 1, intervalWeeks }))
        if (skipHoliday) actions.push({ op: 'set_course_task_rules', id: chain.id, rules: { ...chain.taskRules, skipHolidays: true } })
        await applyActions(actions, revision)
      }
      setEditing(null); setForm({ ...empty, course: form.course }); setMessage('已保存到事件链，可撤销'); setMode(null)
    }) }}>
      <h3 className="font-semibold assignment-form-wide flex items-center gap-2"><CourseTaskIcon kind={form.kind as CourseTaskKind} />{editing ? '修改任务详情' : '快捷添加课程任务'}</h3>
      {editing && events.get(editing) && <div className="assignment-form-wide rounded-xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-950"><p className="mb-2 text-sm font-semibold">{courseTaskStatus(events.get(editing)!, form.kind as CourseTaskKind, new Date())}</p><button type="button" disabled={busy} className="workspace-button primary w-full" onClick={() => void run(async () => { const current = captureArchive(), e = current.events.find(e => e.id === editing)!; await applyActions(setCourseTaskStatusActions(current, editing, !courseTaskCompleted(e, courseTaskKind(e, current.eventTypes)!, new Date())), await snapshotRevision(current)); setMessage('已更新完成状态') })}>{courseTaskCompleted(events.get(editing)!, form.kind as CourseTaskKind, new Date()) ? '标记为未完成' : form.kind === '实验验收' ? '标记为已验收' : scheduled ? '标记为已完成' : '标记为已提交'}</button></div>}
      {editing ? <label>所属事件链<select aria-label="所属事件链" className="workspace-input" value={form.course} onChange={e => setForm({ ...form, course: e.target.value })}>{[...chains.values()].map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label> : <label>课程<input required list="course-options" className="workspace-input" value={form.course} onChange={e => setForm({ ...form, course: e.target.value })} /><datalist id="course-options">{[...chains.values()].map(c => <option key={c.id} value={c.name} />)}</datalist></label>}
      <label>名称<input required className="workspace-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label>类别<select aria-label="类别" disabled={!!editing} className="workspace-input" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>{courseTaskKinds.map(kind => <option key={kind}>{kind}</option>)}</select></label>
      {scheduled && <label>{form.kind === '考试' ? '考试开始时间' : '上课开始时间'}<input required type="datetime-local" className="workspace-input" value={form.startTime || ''} onChange={e => setForm({ ...form, startTime: e.target.value })} /></label>}
      <label>{form.kind === '考试' ? '考试结束时间' : form.kind === '实验课' ? '上课结束时间' : form.kind === '实验验收' ? '验收截止时间' : form.kind === '实验报告' ? '报告截止时间' : '作业截止时间'}<input required type="datetime-local" className="workspace-input" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></label>
      {!editing && <div className="assignment-form-wide space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-800 dark:bg-indigo-950/30"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={weekly} onChange={e => setWeekly(e.target.checked)} />每周重复</label>{weekly && <div className="grid grid-cols-2 gap-2"><label>间隔周数<input aria-label="间隔周数" className="workspace-input" type="number" min={1} max={12} value={intervalWeeks} onChange={e => setIntervalWeeks(Number(e.target.value))} /></label><label>重复次数（含本次）<input aria-label="重复次数" className="workspace-input" type="number" min={1} max={52} value={repeatCount} onChange={e => setRepeatCount(Number(e.target.value))} /></label></div>}<label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={skipHoliday} onChange={e => setSkipHoliday(e.target.checked)} />该课程遇法定节假日自动跳过作业／实验</label><p className="text-xs text-slate-500">生成固定次数的每周安排，可整体撤销。验收、报告随实验课按相同周数重复。跳过日和编号可在行首调整。</p></div>}
      {form.kind === '实验课' && <div className="assignment-form-wide space-y-2 rounded-lg border p-3 dark:border-slate-700">
        <p className="text-xs text-slate-500">可同时添加验收和报告，分别记录完成状态；未填写的事项不会创建。</p>
        {!hasAcceptance && <><label>新增验收截止时间<input type="datetime-local" className="workspace-input" value={acceptance} onChange={e => setAcceptance(e.target.value)} /></label><button type="button" className="workspace-button" onClick={() => {
          const matches = [...chains.values()].filter(c => editing ? c.id === form.course : c.name === form.course)
          const next = matches.length === 1 && form.startTime ? nextLabClass([...events.values()], taskTypes, matches[0].id, new Date(form.startTime), editing || undefined) : undefined
          if (next) { setAcceptance(localDateTime(new Date(next.startTime))); setMessage('已填入下次实验课的当前开始时间；调课后可手动修改') } else setMessage('没有找到下次实验课，请填写验收截止时间')
        }}>填入下次实验课时间</button></>}
        {!hasReport && <label>新增报告截止时间<input type="datetime-local" className="workspace-input" value={report} onChange={e => setReport(e.target.value)} /></label>}
      </div>}
      {related.length > 0 && <div className="assignment-form-wide"><p className="text-xs text-slate-500">同一次实验的其他事项</p>{related.map(e => <button type="button" key={e.id} className="workspace-button mr-1 mt-1" onClick={() => edit(e)}>{courseTaskKind(e, taskTypes)} · {courseTaskStatus(e, courseTaskKind(e, taskTypes)!, new Date())}</button>)}</div>}
      <label>提交方式<input className="workspace-input" placeholder="如：课堂提交 / 在线平台" value={form.submission} onChange={e => setForm({ ...form, submission: e.target.value })} /></label>
      <label>提交链接<input type="url" className="workspace-input" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} /></label>
      <label>作业 / 实验内容<textarea aria-label="作业 / 实验内容" className="workspace-input" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></label>
      <label>备注<textarea aria-label="备注" className="workspace-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
      <div className="flex flex-wrap gap-2 assignment-form-wide assignment-form-actions"><button disabled={busy} className="workspace-button primary">保存任务</button>{editing && <>
        <button type="button" className="workspace-button" onClick={() => { setEditing(null); setForm(empty); setMode(null) }}>取消编辑</button>
        {form.link && (() => { try { return <a className="workspace-button" target="_blank" rel="noreferrer" href={safeSubmissionLink(form.link)}>打开提交链接</a> } catch { return null } })()}
      </>}</div>
      {message && <p role="status" className="assignment-form-wide text-sm text-indigo-600">{message}</p>}
    </form></AppPanel>}
    {mode === 'table' && <AppPanel title="从表格获取" onClose={() => setMode(null)}><section className="space-y-3">
      <h3 className="font-semibold">从表格批量获取任务与提交链接</h3>
      <p className="text-xs text-slate-500">支持 XLSX、XLS、CSV 或粘贴表格。表头：课程、名称、截止日期、类别、开始时间、实验关联编号、提交链接、提交方式、内容、备注。类别为实验课、实验验收、实验报告、作业或考试；实验课和考试须填开始时间，截止日期填写结束时间。同一次实验可使用相同关联编号。同名事项需填写类别；仅更新链接时可省略时间。</p>
      <input aria-label="导入任务表格" type="file" accept=".xlsx,.xls,.csv" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run(async () => { if (file.size > 10 * 1024 * 1024) throw new Error('表格请小于 10 MB'); await prepare(XLSX.read(await file.arrayBuffer(), { type: 'array' })) }) }} />
      <textarea aria-label="粘贴任务表格" className="workspace-input" rows={3} placeholder={'课程\t名称\t截止日期\t提交链接'} value={paste} onChange={e => setPaste(e.target.value)} />
      <button disabled={busy || !paste.trim()} className="workspace-button" onClick={() => void run(() => prepare(XLSX.read(paste, { type: 'string' })))}>预览粘贴内容</button>
      {preview && <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><h4>导入预览 · {preview.rows.length} 项</h4><div className="max-h-52 overflow-auto">{preview.rows.map((r, i) => <p key={i} className="py-1 text-xs break-all">{r.course} / {r.name} · {r.deadline || '保留截止时间'} · {r.link || '无链接'}</p>)}</div><button disabled={busy} className="workspace-button primary" onClick={() => void run(async () => { await applyActions(preview.actions, preview.revision); setMessage(`已导入 ${preview.rows.length} 项，可整体撤销`); setPreview(null) })}>应用到事件链</button><button className="workspace-button" onClick={() => setPreview(null)}>取消</button></div>}
      {message && <p role="status" className="text-sm text-indigo-600">{message}</p>}
    </section></AppPanel>}
    {!mode && message && <p role="status" className="text-sm text-indigo-600 dark:text-indigo-300">{message}</p>}
  </div>
}
