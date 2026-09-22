import { useState } from 'react'
import AppPanel from './AppPanel'
import type { AssignmentRow } from '../utils/assignmentTable'
import type { TaskNumberSuggestion } from '../utils/taskNumberDetection'

export default function TaskNumberImportPanel({ rows, suggestions, onConfirm, onClose }: {
  rows: AssignmentRow[]; suggestions: TaskNumberSuggestion[]; onConfirm: (rows: AssignmentRow[]) => Promise<void>; onClose: () => void
}) {
  const [choices, setChoices] = useState(() => suggestions.map(s => ({ ...s, enabled: s.number !== undefined, value: s.number === undefined ? '' : String(s.number) })))
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const confirm = async (useNumbers: boolean) => {
    setError(''); setBusy(true)
    try {
      const confirmed = rows.map((row, index) => {
        const choice = useNumbers && choices.find(c => c.row === index && c.enabled)
        if (!choice) return row
        const number = Number(choice.value)
        if (!choice.value.trim() || !Number.isInteger(number) || number < 0 || number > 100000) throw new Error(`${row.name}：请输入 0–100000 的整数编号`)
        return { ...row, confirmedNumber: number }
      })
      await onConfirm(confirmed)
    } catch (e) { setError(e instanceof Error ? e.message : '编号确认失败') } finally { setBusy(false) }
  }
  return <AppPanel title="确认表格任务编号" onClose={onClose}>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); void confirm(true) }}>
      <p className="text-sm text-slate-600 dark:text-slate-300">识别到 {suggestions.length} 项可能的编号。请核对、修改或取消勾选，确认后再预览导入。</p>
      <p className="text-xs text-slate-500">编号允许从 0 开始，将作为同一课程对应任务类别的自动编号基准，前后任务随之递推。同组实验请在表格中填写相同“实验关联编号”。</p>
      {choices.map((choice, index) => <div key={choice.row} data-number-row={choice.row} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={choice.enabled} onChange={e => { setError(''); setChoices(all => all.map((c, i) => i === index ? { ...c, enabled: e.target.checked } : c)) }} /><span className="min-w-0 break-words">{rows[choice.row].course} · {rows[choice.row].name}</span></label>
        <p className="my-2 break-words text-xs text-slate-500">{choice.source}</p>
        <label className="flex items-center gap-2 text-xs"><span className="shrink-0">确认编号</span><input aria-label={`第 ${choice.row + 1} 项编号`} disabled={!choice.enabled} required={choice.enabled} type="number" min={0} max={100000} step={1} className="workspace-input w-24" value={choice.value} onChange={e => { setError(''); setChoices(all => all.map((c, i) => i === index ? { ...c, value: e.target.value } : c)) }} /></label>
      </div>)}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <div className="sticky bottom-0 flex flex-wrap gap-2 bg-white py-2 dark:bg-slate-900"><button disabled={busy} className="workspace-button primary">确认编号并预览</button><button disabled={busy} type="button" className="workspace-button" onClick={() => void confirm(false)}>不导入编号</button></div>
    </form>
  </AppPanel>
}
