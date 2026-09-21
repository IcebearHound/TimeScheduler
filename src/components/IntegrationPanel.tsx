import { aiModelSuggestions } from '../integrations/aiPresets'
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import useAgentHistory, { AgentMessage } from '../stores/agentHistoryStore'
import AISettings from './AISettings'
import { applyActions, captureArchive } from '../integrations/archive'
import { AgentReply } from '../integrations/ai'
import { AIProfiles, loadAIProfiles, requestBrowserAgent, saveAIProfiles } from '../integrations/browserAI'
import useUIStore from '../stores/uiStore'
import useLayoutStore from '../stores/layoutStore'
import { navigateToEvent } from '../utils/navigation'
import { Paperclip, FileText, X, Download, Globe, History, Plus, Trash2 } from 'lucide-react'
import { AgentAttachment, attachmentsSchema } from '../integrations/attachments'
import { agentFileAccept, readAgentFile } from '../utils/agentFiles'
import { AgentWebPage } from '../integrations/agentArtifacts'
import { messageLinks, readAgentWebPage, publicWebUrl } from '../utils/agentWeb'
import { downloadAgentFile } from '../utils/agentDownloads'

const useConversation = create<{ models: Record<string, { defaultModel: string; chosenModel: string }>; attachments: AgentAttachment[]; webPages: AgentWebPage[]; proposal: (AgentReply & { revision: string }) | null }>(() => ({ models: {}, attachments: [], webPages: [], proposal: null }))
export default function IntegrationPanel() {
  const { proposal, attachments, webPages } = useConversation()
  const history = useAgentHistory()
  const active = history.threads.find(t => t.id === history.activeId)!
  const messages = active.messages, instruction = active.draft
  const setInstruction = (draft: string) => history.updateThread(active.id, { draft })
  const [historyOpen, setHistoryOpen] = useState(false), [configOpen, setConfigOpen] = useState(false), [search, setSearch] = useState('')
  const switchThread = (id?: string) => { if (id) history.selectThread(id); else history.createThread(); useConversation.setState({ attachments: [], webPages: [], proposal: null }); setError(''); setHistoryOpen(false) }
  const [configs, setConfigs] = useState<AIProfiles>({ profiles: [], activeId: '' })
  const [model, setModel] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const [requestStage, setRequestStage] = useState('正在处理…')
  const fileInput = useRef<HTMLInputElement>(null)
  const configIdentity = useRef('')
  const controller = useRef<AbortController | null>(null), alive = useRef(true), bottom = useRef<HTMLDivElement>(null)
  const chosenModel = (id: string, defaultModel: string) => { const saved = useConversation.getState().models[id]; return saved?.defaultModel === defaultModel ? saved.chosenModel : defaultModel }
  const configure = () => { setConfigOpen(true); setHistoryOpen(false) }
  useEffect(() => {
    alive.current = true
    let canceled = false
    const load = (restore = true) => { void loadAIProfiles().then(value => {
      if (!alive.current || canceled) return
      const current = useAgentHistory.getState().threads.find(t => t.id === active.id)!
      const selected = value.profiles.find(p => p.id === (restore ? current.profileId || value.activeId : value.activeId)) || value.profiles[0]
      const identity = `${selected?.id}:${selected?.model}`
      setConfigs({ ...value, activeId: selected?.id || '' })
      const nextModel = selected ? restore && current.profileId === selected.id && current.model ? current.model : chosenModel(selected.id, selected.model) : ''
      configIdentity.current = identity; setModel(nextModel)
      history.updateThread(active.id, { profileId: selected?.id, model: nextModel })
      if (!value.profiles.length) configure()
    }).catch(e => { if (alive.current && !canceled) setError(e.message) }).finally(() => { if (alive.current && !canceled) setLoading(false) }) }
    const reload = () => load(false)
    setLoading(true); load(); window.addEventListener('ai-profiles-changed', reload)
    return () => { canceled = true; alive.current = false; controller.current?.abort(); window.removeEventListener('ai-profiles-changed', reload) }
  }, [active.id])
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [messages, proposal, busy])
  const jump = (id: string) => { navigateToEvent(id); useUIStore.getState().setRightPanelExpanded(false); if (useLayoutStore.getState().isMobile) { useUIStore.getState().setIsRightPanelOpen(false); useUIStore.getState().setIsAgentOpen(false) } }
  const activeProfile = configs.profiles.find(p => p.id === configs.activeId) || configs.profiles[0]
  const modelOptions = [...new Set([...(aiModelSuggestions[activeProfile?.preset || ''] || []), ...configs.profiles.filter(p => p.baseUrl === activeProfile?.baseUrl).map(p => p.model)])]
  const append = (message: AgentMessage) => history.append(active.id, message)
  const upload = async (files: File[]) => {
    if (!files.length || busy || reading) return
    setReading(true); setError('')
    try {
      const retained = attachments.filter(a => !files.some(f => f.name === a.name))
      if (retained.length + files.length > 5) throw new Error('最多附带 5 个文件，请先移除部分附件')
      const parsed = await Promise.all(files.map(readAgentFile))
      const checked = attachmentsSchema.safeParse([...retained, ...parsed])
      if (!checked.success) throw new Error(checked.error.issues[0]?.message || '附件过大，请分批发送')
      if (alive.current) useConversation.setState({ attachments: checked.data })
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : '文件读取失败') }
    finally { if (alive.current) setReading(false) }
  }
  const send = async () => {
    const profile = configs.profiles.find(p => p.id === configs.activeId) || configs.profiles[0]
    if (!profile) { configure(); return }
    if ((!instruction.trim() && !attachments.length) || busy || reading) return
    const text = instruction.trim() || '请先概述附件内容，再询问我希望如何处理。', history = messages.slice(-12).map(({ generatedFiles, ...m }) => ({ ...m, ...(generatedFiles?.length ? { generatedFileNames: generatedFiles.map(f => f.name) } : {}) }))
    const links = messageLinks(text)
    if (links.length > 3) { setError('每次最多读取 3 个网页链接，请分批发送'); return }
    setInstruction(''); setBusy(true); setError(''); useConversation.setState({ proposal: null }); append({ role: 'user', text, files: attachments.map(a => a.name) })
    const request = new AbortController(); controller.current = request
    const timer = setTimeout(() => request.abort(), 90000)
    try {
      let pages = webPages
      if (links.length) {
        setRequestStage('正在读取网页…')
        pages = await Promise.all(links.map(url => readAgentWebPage(url, request.signal, configs.readerApiKey)))
        if (!alive.current || request.signal.aborted) return
        useConversation.setState({ webPages: pages })
      }
      setRequestStage('Agent 正在处理…')
      const result = await requestBrowserAgent({ ...profile, model }, JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, localTime: new Date().toString(), conversation: history, instruction: text }), captureArchive(), request.signal, attachments, pages)
      if (!alive.current || request.signal.aborted) return
      append({ role: 'assistant', text: result.message + (result.question ? '\n\n' + result.question : ''), ids: result.eventIds, generatedFiles: result.files })
      if (result.intent === 'edit') useConversation.setState({ proposal: result })
      if (result.intent === 'query' && result.eventIds.length) jump(result.eventIds[0])
      if (result.intent === 'import') useUIStore.getState().setIsImportDialogOpen(true)
    } catch (e) { if (alive.current) { setError(e instanceof Error ? e.message : '请求失败'); setInstruction(text) } }
    finally { clearTimeout(timer); controller.current = null; if (alive.current) setBusy(false) }
  }
  return <div className="flex h-full min-h-0 flex-col">
    <div className="agent-thread-bar">
      <span className="min-w-0 flex-1 truncate text-sm" title={active.title}>{active.title}</span>
      <button className="workspace-button" disabled={busy || reading} aria-label="新建对话" onClick={() => switchThread()}><Plus size={16} /></button>
      <button className="workspace-button" disabled={busy || reading} aria-label="历史对话" aria-expanded={historyOpen} onClick={() => setHistoryOpen(!historyOpen)}><History size={16} /></button>
    </div>
    {history.storageError && <p role="alert" className="px-3 text-xs text-rose-600">{history.storageError}</p>}
    {historyOpen && <section aria-label="历史对话记录" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      <input aria-label="搜索历史对话" className="workspace-input" placeholder="搜索对话标题或内容" value={search} onChange={e => setSearch(e.target.value)} />
      <p className="text-xs text-slate-500">仅保存在当前浏览器。消息和生成文件可恢复，上传附件需重新选择。</p>
      {[...history.threads].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).filter(t => (t.title + t.messages.map(m => m.text).join(' ')).toLowerCase().includes(search.toLowerCase())).map(t => <article key={t.id} className="rounded-xl border p-3 dark:border-slate-700" data-history-id={t.id}>
        <input aria-label={'重命名对话：' + t.title} className="workspace-input font-medium" defaultValue={t.title} key={t.title} onBlur={e => history.renameThread(t.id, e.target.value)} onKeyDown={e => { if(e.key === 'Enter') e.currentTarget.blur() }} />
        <p className="my-2 text-xs text-slate-500">{new Date(t.updatedAt).toLocaleString('zh-CN')} · {t.messages.length} 条消息</p>
        <div className="flex gap-2"><button className="workspace-button flex-1" onClick={() => switchThread(t.id)}>{t.id === active.id ? '继续当前对话' : '打开对话'}</button><button className="workspace-button text-rose-600" aria-label={'删除对话：' + t.title} onClick={() => { history.deleteThread(t.id); if(t.id === active.id) useConversation.setState({ attachments: [], webPages: [], proposal: null }) }}><Trash2 size={16} /></button></div>
      </article>)}
    </section>}
    <div className={(historyOpen ? "hidden " : "") + "min-h-0 flex-1 space-y-3 overflow-y-auto p-3"} aria-label="Agent 对话" aria-live="polite">
      {!messages.length && <div className="space-y-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800"><p>查询日程、安排事件，或导入课程表。</p><p className="text-xs text-slate-500">查询先给结果再追问；创建或编辑缺少关键信息时会先询问。修改经预览确认后写入，可撤销。</p></div>}
      {messages.map((m, i) => <div key={i} className={`rounded-xl p-3 text-sm ${m.role === 'user' ? 'ml-5 bg-indigo-50 dark:bg-indigo-950' : 'mr-2 bg-slate-50 dark:bg-slate-800'}`}><p className="mb-1 text-xs text-slate-400">{m.role === 'user' ? '你' : 'Agent'}</p><p className="whitespace-pre-wrap break-words">{m.text}</p>{m.files?.map((name, index) => <span key={index} className="mt-2 flex items-center gap-1 text-xs text-slate-500"><FileText size={13} className="shrink-0" /><span className="break-all">{name}</span></span>)}{m.generatedFiles?.map((file, index) => <button key={index} className="workspace-button mt-2 flex w-full items-center gap-2 text-left" onClick={() => { try { downloadAgentFile(file) } catch { setError('文件生成失败，请让 Agent 重新生成') } }}><Download size={16} className="shrink-0" /><span className="min-w-0 break-all">下载 {file.name}</span></button>)}{m.ids?.map(id => <button key={id} className="workspace-button mt-2 w-full text-left" onClick={() => jump(id)}>定位：{captureArchive().events.find(e => e.id === id)?.name || '事件已删除'}</button>)}</div>)}
      {proposal && <div className="space-y-2 rounded-xl border p-3 dark:border-slate-700"><h4 className="text-sm font-semibold">即将应用 {proposal.actions.length} 项操作</h4>{proposal.actions.map((a, i) => <details key={i} className="text-xs"><summary className="cursor-pointer py-1">{a.op === 'create_event' ? `新增：${a.event.name}` : a.op === 'create_chain' ? `新建事件链：${a.chain.name}` : a.op === 'set_course_task_rules' ? `编号与跳过规则：${captureArchive().eventChains.find(c => c.id === a.id)?.name || a.id}` : `${a.op === 'delete_event' ? '删除' : '修改'}：${captureArchive().events.find(e => e.id === a.id)?.name || a.id}`}</summary><pre className="whitespace-pre-wrap break-all">{JSON.stringify(a, null, 2)}</pre></details>)}<div className="flex flex-wrap gap-2"><button disabled={busy} className="workspace-button primary" onClick={async () => {
        setBusy(true); setError('')
        try {
          const before = captureArchive(), result = await applyActions(proposal.actions, proposal.revision)
          const target = result.snapshot.events.find(e => !before.events.some(v => v.id === e.id)) || result.snapshot.events.find(e => proposal.actions.some(a => a.op === 'update_event' && a.id === e.id))
          useConversation.setState({ proposal: null }); append({ role: 'assistant', text: '已应用到日程，可整体撤销。', ids: target ? [target.id] : [] }); if (target) jump(target.id)
        } catch (e) { setError(e instanceof Error ? e.message : '应用失败') } finally { setBusy(false) }
      }}>确认应用到存档</button><button disabled={busy} className="workspace-button" onClick={() => useConversation.setState({ proposal: null })}>取消预览</button></div></div>}
      {busy && <p role="status" className="text-sm text-slate-500">{requestStage}</p>}{error && <p role="alert" className="break-words text-sm text-rose-600">{error}</p>}<div ref={bottom} />
    </div>
    <div className={"agent-composer " + (historyOpen ? "hidden" : "")}><form className="space-y-2" onSubmit={e => { e.preventDefault(); void send() }}>
      <input ref={fileInput} aria-label="上传 Agent 附件" type="file" multiple accept={agentFileAccept} className="hidden" disabled={busy || reading} onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void upload(files) }} />
      {webPages.length > 0 && <details className="text-xs"><summary className="cursor-pointer text-slate-500">网页来源 · {webPages.length} 个</summary><div className="max-h-24 space-y-2 overflow-y-auto py-2">{webPages.map((page, i) => <div key={i} className="break-all"><Globe size={12} className="mr-1 inline" />{(() => { try { const url = publicWebUrl(page.url); return <a href={url} target="_blank" rel="noreferrer" className="text-indigo-500 underline">{page.url}</a> } catch { return <span>{page.url}</span> } })()}<p className={page.error ? 'text-rose-500' : 'text-slate-500'}>{page.error || (page.truncated ? '已读取部分正文（前 2 万字）' : '已读取正文，可继续追问')}</p></div>)}<button type="button" disabled={busy} className="workspace-button" onClick={() => useConversation.setState({ webPages: [] })}>移除网页上下文</button></div></details>}
      {attachments.length > 0 && <div aria-label="对话附件" className="max-h-32 space-y-1 overflow-y-auto">{attachments.map((a, i) => <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 text-xs dark:bg-slate-800"><FileText size={14} className="shrink-0 text-indigo-500" /><span className="min-w-0 flex-1 truncate" title={a.name}>{a.name}</span><button type="button" className="todo-icon-button" disabled={busy || reading} aria-label={`移除附件：${a.name}`} onClick={() => useConversation.setState({ attachments: attachments.filter((_, index) => index !== i) })}><X size={14} /></button></div>)}<p className="text-[10px] text-slate-500">附件随后续消息一起发送，移除后停止附带。</p></div>}
      {reading && <p role="status" className="text-xs text-slate-500">正在读取附件…</p>}
      <textarea aria-label="发送给 Agent" className="workspace-input" rows={2} value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="明天有哪些课？或：导入课程表" />
      <div className="flex flex-wrap gap-2"><button disabled={busy || reading || loading || (!instruction.trim() && !attachments.length) || !model.trim()} className="workspace-button primary">发送</button><button type="button" disabled={busy || reading} className="workspace-button inline-flex items-center gap-1" onClick={() => fileInput.current?.click()}><Paperclip size={15} />上传文件</button>{busy && <button type="button" className="workspace-button" onClick={() => controller.current?.abort()}>取消请求</button>}<button type="button" disabled={busy} className="workspace-button" onClick={() => useUIStore.getState().setIsImportDialogOpen(true)}>导入课程表</button></div>
      <details className="text-[10px] text-slate-500"><summary className="cursor-pointer">附件、联网与文件格式说明</summary><p className="pt-1 leading-relaxed">支持文本、CSV / Excel、PDF、PNG / JPG / WebP；每个 ≤5 MB，最多 5 个。图片和 PDF 需要所选模型支持。提供链接时通过 Jina Reader 读取公开网页。可生成 TXT / Markdown / CSV / JSON / ICS / Excel。发送会将附件、日程与最近对话提交给所选 AI 服务；附件仅保留在当前页面会话。</p></details>

    </form>
    <div aria-label="Agent 模型与 API" className="agent-model-controls">
      <label className="block text-xs">API 配置<select aria-label="API 配置" className="workspace-input" disabled={busy || loading} value={configs.activeId} onChange={e => { const next = { ...configs, activeId: e.target.value }; const selected = next.profiles.find(p => p.id === next.activeId); configIdentity.current = `${selected?.id}:${selected?.model}`; setConfigs(next); setModel(selected ? chosenModel(selected.id, selected.model) : ''); history.updateThread(active.id, { profileId: selected?.id, model: selected ? chosenModel(selected.id, selected.model) : '' }); void saveAIProfiles(next).catch(e => setError(e.message)) }}>{!configs.profiles.length && <option value="">尚未配置</option>}{configs.profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="block text-xs">模型<input aria-label="当前模型" className="workspace-input" title="选择推荐模型或输入模型名称" list="agent-models" value={model} disabled={busy} onChange={e => { const value = e.target.value; setModel(value); history.updateThread(active.id, { model: value }); if (activeProfile) useConversation.setState(state => ({ models: { ...state.models, [activeProfile.id]: { defaultModel: activeProfile.model, chosenModel: value } } })) }} /><datalist id="agent-models">{modelOptions.map(m => <option key={m} value={m} />)}</datalist></label>

      <button type="button" className="workspace-button" aria-expanded={configOpen} disabled={busy || reading} onClick={() => setConfigOpen(!configOpen)}>API 配置</button>
    </div>
    {configOpen && <div className="pt-3"><AISettings onDone={() => setConfigOpen(false)} /></div>}
    </div>
  </div>
}
