import { useEffect, useState } from 'react'
import { aiPresets } from '../integrations/aiPresets'
import { AIProfile, AIProfiles, aiRelayEndpoint, loadAIProfiles, saveAIProfiles } from '../integrations/browserAI'
import useUIStore from '../stores/uiStore'
import MCPConnectionPanel from './MCPConnectionPanel'

const blank = (): AIProfile => ({ ...aiPresets.deepseek, id: crypto.randomUUID(), name: '', preset: 'deepseek', apiKey: '', transport: aiRelayEndpoint ? 'relay' : 'direct' })
export default function AISettings() {
  const [data, setData] = useState<AIProfiles>({ profiles: [], activeId: '' })
  const [form, setForm] = useState(blank), [key, setKey] = useState('')
  const [busy, setBusy] = useState(true), [message, setMessage] = useState('')
  const [showMCP, setShowMCP] = useState(false)
  const [readerKey, setReaderKey] = useState('')
  useEffect(() => { let active = true; loadAIProfiles().then(value => { if (active) setData(value) }).catch(e => { if (active) setMessage(e.message) }).finally(() => { if (active) setBusy(false) }); return () => { active = false } }, [])
  const stored = data.profiles.find(p => p.id === form.id)
  const save = async (value: AIProfiles) => { await saveAIProfiles(value); setData(value) }
  const run = async (fn: () => Promise<void>) => { setBusy(true); setMessage(''); try { await fn() } catch (e) { setMessage(e instanceof Error ? e.message : '保存失败') } finally { setBusy(false) } }
  return <section id="ai-settings" className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
    <h3 className="font-semibold">API 配置</h3>
    <p className="text-xs text-slate-500">可保存多组服务商、密钥和模型，在 Agent 中切换。密钥仅在此浏览器加密保存，不进入日程备份或云同步。</p>
    <div className="space-y-2">{data.profiles.map(p => <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><span className="min-w-0 flex-1 break-all text-sm">{p.name} · {p.model}{p.id === data.activeId ? '（默认）' : ''}</span><button disabled={busy} className="workspace-button" onClick={() => { setForm({ ...p, apiKey: '' }); setKey('') }}>编辑</button><button disabled={busy} className="workspace-button" onClick={() => void run(async () => { const profiles = data.profiles.filter(v => v.id !== p.id); await save({ ...data, profiles, activeId: data.activeId === p.id ? profiles[0]?.id || '' : data.activeId }); if (form.id === p.id) { setForm(blank()); setKey('') } })}>删除</button></div>)}</div>
    <button disabled={busy} className="workspace-button" onClick={() => { setForm(blank()); setKey(''); setMessage('') }}>＋ 添加 API Key</button>
    <fieldset disabled={busy} className="space-y-3">
      <label className="block text-sm">配置名称<input className="workspace-input" placeholder="例如：个人 DeepSeek" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label className="block text-sm">AI 服务商<select className="workspace-input" value={form.preset} onChange={e => { const preset = e.target.value; setForm({ ...form, ...(aiPresets[preset] || { provider: 'openai', baseUrl: '', model: '' }), preset, apiKey: '', transport: preset === 'custom' ? 'direct' : aiRelayEndpoint ? 'relay' : 'direct' }); setKey('') }}>{Object.entries(aiPresets).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}<option value="custom">自定义兼容 API</option></select></label>
      <label className="block text-sm">API Key<input type="password" autoComplete="off" spellCheck={false} className="workspace-input" value={key} placeholder={stored && stored.baseUrl === form.baseUrl ? '已加密保存；留空保留' : '粘贴 API Key'} onChange={e => setKey(e.target.value)} /></label>
      <label className="block text-sm">模型名称<input className="workspace-input" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} /></label>
      <details open={form.preset === 'custom' ? true : undefined}><summary className="cursor-pointer text-sm">高级连接设置</summary><div className="space-y-3 pt-3">
        <label className="block text-sm">协议<select disabled={form.preset !== 'custom'} className="workspace-input" value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value as AIProfile['provider'] })}><option value="openai">OpenAI 兼容</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option></select></label>
        <label className="block text-sm">API 基础地址<input disabled={form.preset !== 'custom'} className="workspace-input" value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })} /></label>
        <label className="block text-sm">连接方式<select className="workspace-input" value={form.transport} onChange={e => setForm({ ...form, transport: e.target.value as AIProfile['transport'] })}><option value="direct">浏览器直连</option>{aiRelayEndpoint && form.preset !== 'custom' && <option value="relay">网站转发</option>}</select></label>
      </div></details>
      <button className="workspace-button primary" onClick={() => void run(async () => {
        const apiKey = key.trim() || (stored?.baseUrl === form.baseUrl && stored.provider === form.provider ? stored.apiKey : '')
        if (!apiKey) throw new Error('请填写 API Key')
        const profile = { ...form, name: form.name.trim() || aiPresets[form.preset]?.label || '自定义配置', model: form.model.trim(), apiKey }
        await save({ ...data, profiles: [...data.profiles.filter(p => p.id !== form.id), profile], activeId: profile.id }); setForm({ ...profile, apiKey: '' }); setKey(''); setMessage('已加密保存，可返回 Agent 使用')
      })}>保存配置</button>
      {data.profiles.length > 0 && <button className="workspace-button ml-2" onClick={() => { useUIStore.getState().setIsSettingsOpen(false); useUIStore.getState().openRightPanelTab('ai') }}>返回 Agent</button>}
    </fieldset>
    {message && <p role="status" className="text-sm text-indigo-600 dark:text-indigo-300">{message}</p>}
    <details className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><summary className="cursor-pointer text-sm font-medium">网页读取服务</summary><div className="space-y-3 pt-3"><p className="text-xs text-slate-500">Agent 使用 Jina Reader 读取你提供的公开网页链接。匿名访问受额度和网络限制；可填写独立的 Reader Key。网页链接发送给读取服务，正文再提交给所选模型。</p><label className="block text-sm">Jina Reader Key<input type="password" autoComplete="off" className="workspace-input" value={readerKey} placeholder={data.readerApiKey ? '已加密保存；留空保留' : '可选：匿名访问失败时填写'} onChange={e => setReaderKey(e.target.value)} /></label><div className="flex flex-wrap gap-2"><button disabled={busy || !readerKey.trim()} className="workspace-button" onClick={() => void run(async () => { await save({ ...data, readerApiKey: readerKey.trim() }); setReaderKey(''); setMessage('网页读取密钥已加密保存') })}>保存网页密钥</button>{data.readerApiKey && <button disabled={busy} className="workspace-button" onClick={() => void run(async () => { await save({ ...data, readerApiKey: undefined }); setReaderKey(''); setMessage('网页读取密钥已移除') })}>移除网页密钥</button>}</div></div></details>
    <details className="rounded-lg border border-slate-200 p-3 dark:border-slate-700" onToggle={e => setShowMCP(e.currentTarget.open)}><summary className="cursor-pointer text-sm font-medium">外部 MCP 连接</summary><div className="pt-3">{showMCP && <MCPConnectionPanel />}</div></details>
  </section>
}
