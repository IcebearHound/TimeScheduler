import { useState } from 'react'

export default function AgentChoices({ choices, disabled, onReply }: { choices: string[]; disabled: boolean; onReply: (text: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState('')
  return <form className="mt-3 space-y-2" aria-label="回答 Agent 追问" onSubmit={e => {
    e.preventDefault()
    const text = [selected, detail.trim()].filter(Boolean).join('\n补充：')
    if (text && !disabled) onReply(text)
  }}>
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="mb-2 text-xs text-slate-500">选择一项，也可以自行补充</legend>
      {choices.map((choice, i) => <label key={i} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 ${selected === choice ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'dark:border-slate-600'}`}>
        <input type="radio" name="agent-choice" className="mt-1" checked={selected === choice} onChange={() => setSelected(choice)} /><span className="min-w-0 break-words">{choice}</span>
      </label>)}
      <label className="flex items-center gap-2 rounded-lg border p-2 dark:border-slate-600"><input type="radio" name="agent-choice" checked={selected === ''} onChange={() => setSelected('')} />自行填写</label>
      <textarea aria-label="补充说明" className="workspace-input" rows={2} value={detail} onChange={e => setDetail(e.target.value)} placeholder="补充课程名、时间，或填写自己的回答…" />
      <button type="submit" className="workspace-button primary" disabled={!selected && !detail.trim()}>提交回答</button>
    </fieldset>
  </form>
}
