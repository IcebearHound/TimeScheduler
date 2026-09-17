import { useEffect, useRef, useState } from 'react'
import { applyActions, captureArchive } from '../integrations/archive'
import { Action } from '../integrations/contracts'
import { AIConfig } from '../integrations/ai'
import { aiPresets } from '../integrations/aiPresets'
import { aiRelayEndpoint, BrowserAIConfig, forgetBrowserAI, loadBrowserAI, proposeBrowserActions, saveBrowserAI } from '../integrations/browserAI'
import MCPConnectionPanel from './MCPConnectionPanel'

const initial: BrowserAIConfig = { ...aiPresets.deepseek, preset: 'deepseek', apiKey: '', transport: aiRelayEndpoint ? 'relay' : 'direct' }
export default function IntegrationPanel() {
  const [config, setConfig] = useState(initial), [saved, setSaved] = useState<BrowserAIConfig | null>(null)
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const [instruction, setInstruction] = useState(''), [advancedMCP, setAdvancedMCP] = useState(false)
  const [proposal, setProposal] = useState<{ actions: Action[]; revision: string } | null>(null)
  const controller = useRef<AbortController | null>(null), alive = useRef(true)
  useEffect(() => {
    alive.current = true
    void loadBrowserAI().then(value => { if (alive.current && value) { setSaved(value); setConfig({ ...value, apiKey: '' }) } }).catch(() => { if (alive.current) setMessage('无法读取本机密钥，请重新输入 API Key') }).finally(() => { if (alive.current) setLoading(false) })
    return () => { alive.current = false; controller.current?.abort() }
  }, [])
  const storedKey = saved?.provider === config.provider && saved.baseUrl === config.baseUrl && saved.preset === config.preset ? saved.apiKey : ''
  const available = !!(config.apiKey.trim() || storedKey)
  const change = (next: Partial<BrowserAIConfig>) => { setConfig(c => ({ ...c, ...next })); setProposal(null); setMessage('') }
  const run = async (job: () => Promise<void>) => {
    setBusy(true); setMessage('')
    try { await job() } catch (error) { if (alive.current) setMessage(error instanceof Error ? error.message : '操作失败，请重试') }
    finally { if (alive.current) setBusy(false) }
  }
  const save = async () => {
    const next = { ...config, apiKey: config.apiKey.trim() || storedKey }
    await saveBrowserAI(next)
    if (alive.current) { setSaved(next); setConfig(c => ({ ...c, apiKey: '' })) }
    return next
  }
  const generate = async () => {
    setProposal(null)
    const next = await save()
    if (!alive.current) return
    const snapshot = captureArchive(), request = new AbortController()
    controller.current = request
    const timer = setTimeout(() => request.abort(), 90000)
    try {
      const result = await proposeBrowserActions(next, `用户时区：${Intl.DateTimeFormat().resolvedOptions().timeZone}。${instruction}`, snapshot, request.signal)
      if (alive.current && !request.signal.aborted) setProposal(result)
    } finally { clearTimeout(timer); if (controller.current === request) controller.current = null }
  }
  return <div className="space-y-5">
    <section className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
      <h3 className="font-semibold">填入 API Key，即可安排日程</h3>
      <p className="text-sm text-slate-500">选择密钥所属的服务商，地址和模型会自动填写。手机和电脑都可直接使用。</p>
      <fieldset disabled={busy || loading} className="space-y-3 disabled:opacity-60">
        <label className="block text-sm">AI 服务商<select className="workspace-input" value={config.preset} onChange={e => { const preset = e.target.value; change({ ...(aiPresets[preset] || { provider: 'openai', baseUrl: '', model: '' }), preset, apiKey: '', transport: preset === 'custom' ? 'direct' : initial.transport }) }}>{Object.entries(aiPresets).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}<option value="custom">自定义兼容 API</option></select></label>
        <label className="block text-sm">API Key<input type="password" className="workspace-input" value={config.apiKey} autoComplete="off" spellCheck={false} placeholder={storedKey ? '已加密保存；输入可替换' : '粘贴该服务商的 API Key'} onChange={e => change({ apiKey: e.target.value })} /></label>
        {storedKey && <p className="text-xs text-emerald-600">此设备已保存密钥，可直接生成预览。</p>}
        <details open={config.preset === 'custom' ? true : undefined} className="text-xs"><summary className="cursor-pointer py-2">高级设置（模型、地址与连接方式）</summary><div className="space-y-3 pt-2">
          <label className="block">协议<select className="workspace-input" disabled={config.preset !== 'custom'} value={config.provider} onChange={e => change({ provider: e.target.value as AIConfig['provider'] })}><option value="openai">OpenAI 兼容</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option></select></label>
          <label className="block">API 基础地址<input className="workspace-input" disabled={config.preset !== 'custom'} value={config.baseUrl} onChange={e => change({ baseUrl: e.target.value })} /></label>
          <label className="block">模型名称<input className="workspace-input" value={config.model} onChange={e => change({ model: e.target.value })} /></label>
          <label className="block">连接方式<select className="workspace-input" value={config.transport} onChange={e => change({ transport: e.target.value as BrowserAIConfig['transport'] })}><option value="direct">浏览器直连服务商</option>{aiRelayEndpoint && config.preset !== 'custom' && <option value="relay">通过网站转发</option>}</select></label>
        </div></details>
        <div className="flex flex-wrap gap-2"><button className="workspace-button" disabled={!available || !config.model || !config.baseUrl} onClick={() => void run(async () => { await save(); setMessage('API Key 已加密保存在此设备') })}>保存密钥</button>{saved && <button className="workspace-button" onClick={() => void run(async () => { await forgetBrowserAI(); setSaved(null); setConfig(c => ({ ...c, apiKey: '' })); setProposal(null); setMessage('已清除此设备的 AI 密钥') })}>清除已保存密钥</button>}</div>
      </fieldset>
      <p className="text-xs text-slate-500">密钥只在此浏览器加密保存，不写入日程、备份或同步仓库。</p>
    </section>
    <section className="space-y-3">
      <label className="block text-sm font-medium">用自然语言安排日程<textarea disabled={busy || loading} rows={4} className="workspace-input" value={instruction} onChange={e => { setInstruction(e.target.value); setProposal(null) }} placeholder="例如：给高等数学添加本周五 23:59 截止的第三次作业，提交方式是课程平台" /></label>
      <p className="text-xs text-slate-500">生成预览会将当前存档发送给 {aiPresets[config.preset]?.label || '指定的 AI 服务'}。{config.transport === 'relay' ? '密钥与请求经过网站转发服务，仅用于本次调用，不在服务端保存。' : '请求从此浏览器直接发送给服务商。'}确认后才写入日程，可整体撤销。</p>
      <div className="flex gap-2"><button disabled={busy || loading || !available || !instruction.trim() || !config.model || !config.baseUrl} className="workspace-button primary" onClick={() => void run(generate)}>生成操作预览</button>{busy && controller.current && <button className="workspace-button" onClick={() => controller.current?.abort()}>取消请求</button>}</div>
      {proposal && <div className="space-y-3 rounded-xl border p-3 dark:border-slate-700"><h4>即将应用 {proposal.actions.length} 项操作</h4><ul className="max-h-64 space-y-2 overflow-auto">{proposal.actions.map((a, i) => <li key={i} className="border-b py-2 text-sm dark:border-slate-700"><strong>{a.op === 'create_event' ? `新增：${a.event.name}` : a.op === 'create_chain' ? `新建事件链：${a.chain.name}` : `${a.op === 'delete_event' ? '删除' : '修改'}：${captureArchive().events.find(e => e.id === a.id)?.name || a.id}`}</strong><details className="text-xs"><summary className="cursor-pointer py-1">查看操作详情</summary><pre className="whitespace-pre-wrap break-all">{JSON.stringify(a, null, 2)}</pre></details></li>)}</ul><button disabled={busy} className="workspace-button primary" onClick={() => void run(async () => { await applyActions(proposal.actions, proposal.revision); setProposal(null); setMessage('AI 操作已写入当前存档，可整体撤销') })}>确认应用到存档</button><button disabled={busy} className="workspace-button" onClick={() => setProposal(null)}>取消预览</button></div>}
    </section>
    {(busy || loading) && <p role="status" className="text-sm">{loading ? '正在读取本机配置…' : '正在处理，请稍候…'}</p>}
    {message && <p role="status" className="break-words rounded-lg bg-indigo-50 p-3 text-sm text-indigo-700 dark:bg-slate-800 dark:text-indigo-200">{message}</p>}
    <details className="border-t pt-3 text-xs dark:border-slate-700" onToggle={e => setAdvancedMCP(e.currentTarget.open)}><summary className="cursor-pointer py-2">高级：外部 MCP 客户端连接</summary>{advancedMCP && <MCPConnectionPanel />}</details>
  </div>
}
