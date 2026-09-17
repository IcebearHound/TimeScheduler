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

const empty: AssignmentRow = { course: '', name: '', deadline: '', kind: '作业', link: '', submission: '', content: '', notes: '' }
export default function AssignmentPanel() {
  const events = useEventStore(s => s.events), chains = useEventStore(s => s.eventChains), types = useEventStore(s => s.eventTypes)
  const [form, setForm] = useState<AssignmentRow>(empty), [editing, setEditing] = useState<string | null>(null)
  const [message, setMessage] = useState(''), [paste, setPaste] = useState(''), [preview, setPreview] = useState<{ rows: AssignmentRow[]; actions: Action[]; revision: string } | null>(null)
  const [menu, setMenu] = useState(false), [mode, setMode] = useState<'quick' | 'table' | null>(null)
  const [busy, setBusy] = useState(false)
  const editor = useRef<HTMLFormElement>(null)
  const tasks = useMemo(() => [...events.values()].filter(e => e.properties.taskKind).sort((a, b) => +a.endTime - +b.endTime), [events])
  const revealEditor = () => { setMode('quick'); setMenu(false) }
  const courses = useMemo(() => [...chains.values()].filter(c => types.get(c.typeId)?.category === 'course' || [...events.values()].some(e => e.chainId === c.id && e.properties.taskKind)), [chains, types, events])
  const edit = (e: Event) => { setEditing(e.id); setForm({ course: chains.get(e.chainId)?.name || '', name: e.name, deadline: localDateTime(new Date(e.endTime)), kind: e.properties.taskKind || '作业', link: e.properties.submissionUrl || '', submission: e.properties.submissionMethod || '', content: e.properties.taskContent || '', notes: e.properties.notes || '' }); revealEditor() }
  const run = async (job: () => Promise<void>) => { setBusy(true); setMessage(''); try { await job() } catch (e) { setMessage(e instanceof Error ? e.message : '操作失败') } finally { setBusy(false) } }
  const prepare = async (book: XLSX.WorkBook) => {
    const rows = readAssignmentWorkbook(book), snapshot = captureArchive()
    setPreview({ rows, actions: assignmentActions(snapshot, rows), revision: await snapshotRevision(snapshot) })
  }
  return <div className="assignment-panel space-y-5">
    <div className="relative flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">作业 / 实验</h3><button type="button" aria-expanded={menu} className="workspace-button" onClick={() => setMenu(!menu)}>＋ 添加作业 / 实验</button>
      {menu && <><button aria-label="关闭添加任务菜单" data-dismiss-layer className="fixed inset-0 z-40" onClick={() => setMenu(false)} /><div role="menu" className="absolute right-0 top-full z-50 mt-1 rounded-xl border bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800"><button role="menuitem" className="workspace-button block w-full" onClick={() => { setEditing(null); setForm(empty); revealEditor() }}>快捷添加</button><button role="menuitem" className="workspace-button mt-1 block w-full" onClick={() => { setMode('table'); setMenu(false) }}>从表格获取</button></div></>}
    </div>
    <div onDoubleClick={e => { if (!(e.target as HTMLElement).closest('button, input, select, textarea, summary, a')) { window.getSelection()?.removeAllRanges(); useUIStore.getState().setRightPanelExpanded(!useUIStore.getState().rightPanelExpanded) } }}><p className="text-[10px] text-slate-400">双击面板空白处可全屏放大；也可使用右上角放大按钮。</p><AssignmentTimeline courses={courses} tasks={tasks} onEdit={edit} /></div>
    <details className="space-y-3"><summary className="cursor-pointer text-sm font-medium">全部课程任务 · {tasks.length} 项（含历史与远期）</summary>
    <div className="space-y-3" aria-label="课程任务线路">
      {!courses.length && <p className="p-6 text-center text-slate-500">暂无课程，添加任务时填写课程名称即可创建事件链。</p>}
      {courses.map(c => {
        const tasks = [...events.values()].filter(e => e.chainId === c.id && e.properties.taskKind).sort((a, b) => +a.endTime - +b.endTime)
        return <div key={c.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="flex items-center justify-between"><strong style={{ color: c.color }}>{c.name}</strong><button className="workspace-button" onClick={() => { setEditing(null); setForm({ ...empty, course: c.name }); revealEditor() }}>＋ 添加任务</button></div>
          <div className="flex gap-6 overflow-x-auto py-3">
            {!tasks.length && <span className="text-xs text-slate-400">尚无作业 / 实验</span>}
            {tasks.map(e => <button key={e.id} onClick={() => edit(e)} className="relative min-w-32 text-left text-xs" title="修改任务详情">
              <span className="absolute left-2 right-[-24px] top-2 h-0.5" style={{ background: c.color }} />
              <span className={`relative mb-2 block h-4 w-4 rounded-full border-2 border-white ring-2 ${e.properties.completed === 'true' ? 'bg-emerald-500 ring-emerald-300' : +e.endTime < Date.now() ? 'bg-rose-500 ring-rose-300' : 'bg-indigo-500 ring-indigo-300'}`} />
              <span className="block font-medium">{e.name}</span><span className="block text-slate-500">{new Date(e.endTime).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <span>{e.properties.completed === 'true' ? '已完成' : +e.endTime < Date.now() ? '已逾期' : e.properties.taskKind}</span>
            </button>)}
          </div>
        </div>
      })}
    </div>
    </details>
    {mode === 'quick' && <AppPanel title={editing ? '修改任务详情' : '快捷添加作业 / 实验'} onClose={() => setMode(null)}><form ref={editor} className="assignment-form" onSubmit={event => { event.preventDefault(); void run(async () => {
      const snapshot = captureArchive(), revision = await snapshotRevision(snapshot)
      if (editing) {
        const e = events.get(editing); if (!e) throw new Error('该任务已删除')
        const end = new Date(form.deadline)
        await applyActions([{ op: 'update_event', id: editing, changes: { name: form.name, endTime: end.toISOString(), startTime: new Date(+end - 1800000).toISOString(), properties: { ...e.properties, taskKind: form.kind, submissionUrl: safeSubmissionLink(form.link), submissionMethod: form.submission, taskContent: form.content, notes: form.notes } } }], revision)
      } else await applyActions(assignmentActions(snapshot, [form]), revision)
      setEditing(null); setForm({ ...empty, course: form.course }); setMessage('已保存到事件链，可撤销'); setMode(null)
    }) }}>
      <h3 className="font-semibold assignment-form-wide">{editing ? '修改任务详情' : '快捷添加作业 / 实验'}</h3>
      <label>课程<input required disabled={!!editing} list="course-options" className="workspace-input" value={form.course} onChange={e => setForm({ ...form, course: e.target.value })} /><datalist id="course-options">{courses.map(c => <option key={c.id} value={c.name} />)}</datalist></label>
      <label>名称<input required className="workspace-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label>类别<select className="workspace-input" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}><option>作业</option><option>实验</option><option>项目</option><option>其他</option></select></label>
      <label>验收截止时间<input required type="datetime-local" className="workspace-input" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></label>
      <label>提交方式<input className="workspace-input" placeholder="如：课堂提交 / 在线平台" value={form.submission} onChange={e => setForm({ ...form, submission: e.target.value })} /></label>
      <label>提交链接<input type="url" className="workspace-input" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} /></label>
      <label>作业 / 实验内容<textarea aria-label="作业 / 实验内容" className="workspace-input" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></label>
      <label>备注<textarea aria-label="备注" className="workspace-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
      <div className="flex flex-wrap gap-2 assignment-form-wide"><button disabled={busy} className="workspace-button primary">保存任务</button>{editing && <>
        <button type="button" className="workspace-button" onClick={() => { setEditing(null); setForm(empty); setMode(null) }}>取消编辑</button>
        <button type="button" disabled={busy} className="workspace-button" onClick={() => void run(async () => { const e = events.get(editing)!; await applyActions([{ op: 'update_event', id: editing, changes: { properties: { ...e.properties, completed: e.properties.completed === 'true' ? 'false' : 'true' } } }], await snapshotRevision(captureArchive())); setMessage('已更新完成状态') })}>切换完成状态</button>
        {form.link && (() => { try { return <a className="workspace-button" target="_blank" rel="noreferrer" href={safeSubmissionLink(form.link)}>打开提交链接</a> } catch { return null } })()}
      </>}</div>
      {message && <p role="status" className="assignment-form-wide text-sm text-indigo-600">{message}</p>}
    </form></AppPanel>}
    {mode === 'table' && <AppPanel title="从表格获取" onClose={() => setMode(null)}><section className="space-y-3">
      <h3 className="font-semibold">从表格批量获取任务与提交链接</h3>
      <p className="text-xs text-slate-500">支持 XLSX、XLS、CSV 或粘贴表格，读取所有工作表及单元格超链接。表头：课程、名称、截止日期、类别、提交链接、提交方式、内容、备注。仅更新已有任务的链接时，可省略截止日期。</p>
      <input aria-label="导入任务表格" type="file" accept=".xlsx,.xls,.csv" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run(async () => { if (file.size > 10 * 1024 * 1024) throw new Error('表格请小于 10 MB'); await prepare(XLSX.read(await file.arrayBuffer(), { type: 'array' })) }) }} />
      <textarea aria-label="粘贴任务表格" className="workspace-input" rows={3} placeholder={'课程\t名称\t截止日期\t提交链接'} value={paste} onChange={e => setPaste(e.target.value)} />
      <button disabled={busy || !paste.trim()} className="workspace-button" onClick={() => void run(() => prepare(XLSX.read(paste, { type: 'string' })))}>预览粘贴内容</button>
      {preview && <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><h4>导入预览 · {preview.rows.length} 项</h4><div className="max-h-52 overflow-auto">{preview.rows.map((r, i) => <p key={i} className="py-1 text-xs break-all">{r.course} / {r.name} · {r.deadline || '保留截止时间'} · {r.link || '无链接'}</p>)}</div><button disabled={busy} className="workspace-button primary" onClick={() => void run(async () => { await applyActions(preview.actions, preview.revision); setMessage(`已导入 ${preview.rows.length} 项，可整体撤销`); setPreview(null) })}>应用到事件链</button><button className="workspace-button" onClick={() => setPreview(null)}>取消</button></div>}
      {message && <p role="status" className="text-sm text-indigo-600">{message}</p>}
    </section></AppPanel>}
    {!mode && message && <p role="status" className="text-sm text-indigo-600 dark:text-indigo-300">{message}</p>}
  </div>
}
