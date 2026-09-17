import { aiModelSuggestions } from '../integrations/aiPresets'
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { applyActions, captureArchive } from '../integrations/archive'
import { AgentReply } from '../integrations/ai'
import { AIProfiles, loadAIProfiles, requestBrowserAgent, saveAIProfiles } from '../integrations/browserAI'
import useUIStore from '../stores/uiStore'
import useLayoutStore from '../stores/layoutStore'
import { navigateToEvent } from '../utils/navigation'
import MCPConnectionPanel from './MCPConnectionPanel'

type Message = { role: 'user' | 'assistant'; text: string; ids?: string[] }
const useConversation = create<{ models: Record<string, { defaultModel: string; chosenModel: string }>; messages: Message[]; proposal: (AgentReply & { revision: string }) | null }>(() => ({ models: {}, messages: [], proposal: null }))
export default function IntegrationPanel() {
  const { messages, proposal } = useConversation()
  const [configs, setConfigs] = useState<AIProfiles>({ profiles: [], activeId: '' })
  const [model, setModel] = useState(''), [instruction, setInstruction] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const configIdentity = useRef('')
  const controller = useRef<AbortController | null>(null), alive = useRef(true), bottom = useRef<HTMLDivElement>(null)
  const chosenModel = (id: string, defaultModel: string) => { const saved = useConversation.getState().models[id]; return saved?.defaultModel === defaultModel ? saved.chosenModel : defaultModel }
  const configure = () => { useUIStore.getState().setSettingsSection('ai'); useUIStore.getState().setIsSettingsOpen(true) }
  useEffect(() => {
    alive.current = true
    const load = () => { void loadAIProfiles().then(value => {
      if (!alive.current) return
      const selected = value.profiles.find(p => p.id === value.activeId) || value.profiles[0]
      const identity = `${selected?.id}:${selected?.model}`
      setConfigs(value)
      if (configIdentity.current !== identity) { configIdentity.current = identity; setModel(selected ? chosenModel(selected.id, selected.model) : '') }
      if (!value.profiles.length) { useUIStore.getState().addToast('首次使用 Agent，请先配置 API Key'); configure() }
    }).catch(e => { if (alive.current) setError(e.message) }).finally(() => { if (alive.current) setLoading(false) }) }
    load(); window.addEventListener('ai-profiles-changed', load)
    return () => { alive.current = false; controller.current?.abort(); window.removeEventListener('ai-profiles-changed', load) }
  }, [])
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [messages, proposal, busy])
  const jump = (id: string) => { navigateToEvent(id); useUIStore.getState().openRightPanelTab('ai'); useUIStore.getState().setRightPanelExpanded(false); if (useLayoutStore.getState().isMobile) useUIStore.getState().setIsRightPanelOpen(false) }
  const activeProfile = configs.profiles.find(p => p.id === configs.activeId) || configs.profiles[0]
  const modelOptions = [...new Set([...(aiModelSuggestions[activeProfile?.preset || ''] || []), ...configs.profiles.filter(p => p.baseUrl === activeProfile?.baseUrl).map(p => p.model)])]
  const append = (message: Message) => useConversation.setState(s => ({ messages: [...s.messages, message] }))
  const send = async () => {
    const profile = configs.profiles.find(p => p.id === configs.activeId) || configs.profiles[0]
    if (!profile) { configure(); return }
    if (!instruction.trim() || busy) return
    const text = instruction.trim(), history = messages.slice(-12)
    setInstruction(''); setBusy(true); setError(''); useConversation.setState({ proposal: null }); append({ role: 'user', text })
    const request = new AbortController(); controller.current = request
    const timer = setTimeout(() => request.abort(), 90000)
    try {
      const result = await requestBrowserAgent({ ...profile, model }, JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, localTime: new Date().toString(), conversation: history, instruction: text }), captureArchive(), request.signal)
      if (!alive.current || request.signal.aborted) return
      append({ role: 'assistant', text: result.message + (result.question ? '\n\n' + result.question : ''), ids: result.eventIds })
      if (result.intent === 'edit') useConversation.setState({ proposal: result })
      if (result.intent === 'query' && result.eventIds.length) jump(result.eventIds[0])
      if (result.intent === 'import') useUIStore.getState().setIsImportDialogOpen(true)
    } catch (e) { if (alive.current) { setError(e instanceof Error ? e.message : '请求失败'); setInstruction(text) } }
    finally { clearTimeout(timer); controller.current = null; if (alive.current) setBusy(false) }
  }
  return <div className="flex h-full min-h-0 flex-col">
    <div className="shrink-0 space-y-2 border-b p-3 dark:border-slate-700">
      <div className="flex items-center justify-between"><h3 className="font-semibold">日程 Agent</h3><button className="workspace-button" onClick={configure}>AI 设置</button></div>
      <label className="block text-xs">API 配置<select aria-label="API 配置" className="workspace-input" disabled={busy || loading} value={configs.activeId} onChange={e => { const next = { ...configs, activeId: e.target.value }; const selected = next.profiles.find(p => p.id === next.activeId); configIdentity.current = `${selected?.id}:${selected?.model}`; setConfigs(next); setModel(selected ? chosenModel(selected.id, selected.model) : ''); void saveAIProfiles(next).catch(e => setError(e.message)) }}>{!configs.profiles.length && <option value="">尚未配置</option>}{configs.profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="block text-xs">当前模型（可选择或输入）<input aria-label="当前模型" className="workspace-input" list="agent-models" value={model} disabled={busy} onChange={e => { const value = e.target.value; setModel(value); if (activeProfile) useConversation.setState(state => ({ models: { ...state.models, [activeProfile.id]: { defaultModel: activeProfile.model, chosenModel: value } } })) }} /><datalist id="agent-models">{modelOptions.map(m => <option key={m} value={m} />)}</datalist></label>
    </div>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-label="Agent 对话" aria-live="polite">
      {!messages.length && <div className="space-y-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800"><p>查询日程、安排事件，或导入课程表。</p><p className="text-xs text-slate-500">查询先给结果再追问；创建或编辑缺少关键信息时会先询问。修改经预览确认后写入，可撤销。</p></div>}
      {messages.map((m, i) => <div key={i} className={`rounded-xl p-3 text-sm ${m.role === 'user' ? 'ml-5 bg-indigo-50 dark:bg-indigo-950' : 'mr-2 bg-slate-50 dark:bg-slate-800'}`}><p className="mb-1 text-xs text-slate-400">{m.role === 'user' ? '你' : 'Agent'}</p><p className="whitespace-pre-wrap break-words">{m.text}</p>{m.ids?.map(id => <button key={id} className="workspace-button mt-2 w-full text-left" onClick={() => jump(id)}>定位：{captureArchive().events.find(e => e.id === id)?.name || '事件已删除'}</button>)}</div>)}
      {proposal && <div className="space-y-2 rounded-xl border p-3 dark:border-slate-700"><h4 className="text-sm font-semibold">即将应用 {proposal.actions.length} 项操作</h4>{proposal.actions.map((a, i) => <details key={i} className="text-xs"><summary className="cursor-pointer py-1">{a.op === 'create_event' ? `新增：${a.event.name}` : a.op === 'create_chain' ? `新建事件链：${a.chain.name}` : `${a.op === 'delete_event' ? '删除' : '修改'}：${captureArchive().events.find(e => e.id === a.id)?.name || a.id}`}</summary><pre className="whitespace-pre-wrap break-all">{JSON.stringify(a, null, 2)}</pre></details>)}<div className="flex flex-wrap gap-2"><button disabled={busy} className="workspace-button primary" onClick={async () => {
        setBusy(true); setError('')
        try {
          const before = captureArchive(), result = await applyActions(proposal.actions, proposal.revision)
          const target = result.snapshot.events.find(e => !before.events.some(v => v.id === e.id)) || result.snapshot.events.find(e => proposal.actions.some(a => a.op === 'update_event' && a.id === e.id))
          useConversation.setState({ proposal: null }); append({ role: 'assistant', text: '已应用到日程，可整体撤销。', ids: target ? [target.id] : [] }); if (target) jump(target.id)
        } catch (e) { setError(e instanceof Error ? e.message : '应用失败') } finally { setBusy(false) }
      }}>确认应用到存档</button><button disabled={busy} className="workspace-button" onClick={() => useConversation.setState({ proposal: null })}>取消预览</button></div></div>}
      {busy && <p role="status" className="text-sm text-slate-500">正在处理…</p>}{error && <p role="alert" className="break-words text-sm text-rose-600">{error}</p>}      <details className="text-xs" onToggle={e => setAdvanced(e.currentTarget.open)}><summary className="cursor-pointer">外部 MCP 连接</summary>{advanced && <MCPConnectionPanel />}</details><div ref={bottom} />
    </div>
    <form className="shrink-0 space-y-2 border-t p-3 dark:border-slate-700" onSubmit={e => { e.preventDefault(); void send() }}>
      <textarea aria-label="发送给 Agent" className="workspace-input" rows={3} value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="明天有哪些课？或：导入课程表" />
      <div className="flex flex-wrap gap-2"><button disabled={busy || loading || !instruction.trim() || !model.trim()} className="workspace-button primary">发送</button>{busy && <button type="button" className="workspace-button" onClick={() => controller.current?.abort()}>取消请求</button>}<button type="button" disabled={busy} className="workspace-button" onClick={() => useUIStore.getState().setIsImportDialogOpen(true)}>导入课程表</button><button type="button" disabled={busy} className="workspace-button" onClick={() => useConversation.setState({ messages: [], proposal: null })}>清空对话</button></div>
      <p className="text-[10px] text-slate-500">发送会将当前日程与最近对话提交给所选 AI 服务。</p>

    </form>
  </div>
}
