import { useEffect, useRef, useState } from 'react'
import { applyActions, captureArchive } from '../integrations/archive'
import { Action } from '../integrations/contracts'
import { connectLocal, connectionStatus, disconnectLocal, isConnected, localRequest } from '../integrations/localClient'

interface Status { unlocked: boolean; ai?: { provider: string; baseUrl: string; model: string } }
export default function IntegrationPanel() {
  const [connected, setConnected] = useState(isConnected()), [code, setCode] = useState(''), [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status | null>(null), [bridge, setBridge] = useState(connectionStatus()), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  const [ai, setAI] = useState({ provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: '', apiKey: '' })
  const [instruction, setInstruction] = useState(''), [proposal, setProposal] = useState<{ actions: Action[]; revision: string } | null>(null)
  const alive = useRef(true)
  const refresh = async () => { const s = await localRequest<Status>('/status'); if (alive.current) setStatus(s); return s }
  const run = async (job: () => Promise<void>) => { setBusy(true); setMessage(''); try { await job() } catch (e) { setMessage(e instanceof Error ? e.message : '操作失败') } finally { setBusy(false) } }
  useEffect(() => { alive.current = true; if (isConnected()) void refresh().catch(e => setMessage(e.message)); const timer = setInterval(() => setBridge(connectionStatus()), 1000); return () => { alive.current = false; clearInterval(timer) } }, [])
  return <div className="space-y-6">
    <section className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
      <h3 className="font-semibold">本机连接与加密凭据库</h3>
      <p className="text-xs text-slate-500">先在项目目录运行 <code>npm run local</code>，输入终端显示的配对码连接当前存档。外部 AI 使用 MCP 时运行 <code>npm run mcp</code>，它已包含本机服务。</p>
      <p className="text-xs">{bridge}</p>
      {!connected ? <div className="flex flex-wrap gap-2"><input aria-label="本机配对码" className="workspace-input flex-1" value={code} placeholder="8 位配对码" autoComplete="off" onChange={e => setCode(e.target.value)} /><button disabled={busy || !code} className="workspace-button primary" onClick={() => void run(async () => { await connectLocal(code); setCode(''); setConnected(true); await refresh() })}>连接此存档（允许 MCP 读写）</button></div> : <>
        {!status?.unlocked ? <div className="flex flex-wrap gap-2"><input aria-label="本地加密口令" type="password" autoComplete="off" className="workspace-input flex-1" value={password} placeholder="本地加密口令，至少 12 个字符" onChange={e => setPassword(e.target.value)} /><button disabled={busy || password.length < 12} className="workspace-button primary" onClick={() => void run(async () => { const secret = password; setPassword(''); await localRequest('/vault/unlock', { password: secret }); await refresh() })}>创建 / 解锁凭据库</button></div> : <button disabled={busy} className="workspace-button" onClick={() => void run(async () => { await localRequest('/vault/lock'); setAI(a => ({ ...a, apiKey: '' }));  await refresh() })}>锁定凭据库</button>}
        <button disabled={busy} className="workspace-button" onClick={() => void run(async () => { await disconnectLocal(); setConnected(false); setStatus(null); setProposal(null);  setAI(a => ({ ...a, apiKey: '' })) })}>断开并锁定</button>
      </>}
      <p className="text-xs text-slate-500">密钥、登录令牌和刷新令牌仅以 AES-256-GCM 密文保存在本机。口令和解密密钥仅留在进程内存，不进入浏览器存档或同步仓库。请妥善保管口令。</p>
    </section>
    {status?.unlocked && <>
      <section className="space-y-3">
        <h3 className="font-semibold">AI API 接入</h3>
        {status.ai && <p className="text-xs text-slate-500">当前：{status.ai.provider} / {status.ai.model} · {status.ai.baseUrl}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label>协议<select className="workspace-input" value={ai.provider} onChange={e => { const p = e.target.value; setAI({ ...ai, provider: p, baseUrl: p === 'anthropic' ? 'https://api.anthropic.com/v1' : p === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' : 'https://api.openai.com/v1', model: '' }) }}><option value="openai">OpenAI 兼容（DeepSeek / 通义 / 本地模型等）</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option></select></label>
          <label>API 基础地址<input className="workspace-input" value={ai.baseUrl} onChange={e => setAI({ ...ai, baseUrl: e.target.value })} /></label>
          <label>模型名称<input className="workspace-input" value={ai.model} onChange={e => setAI({ ...ai, model: e.target.value })} /></label>
          <label>API 密钥<input type="password" autoComplete="off" className="workspace-input" value={ai.apiKey} onChange={e => setAI({ ...ai, apiKey: e.target.value })} /></label>
        </div>
        <button disabled={busy || !ai.model || !ai.apiKey} className="workspace-button" onClick={() => void run(async () => { await localRequest('/ai/config', ai); setAI({ ...ai, apiKey: '' }); await refresh(); setMessage('AI 配置已加密保存在本机') })}>加密保存 API 配置</button>
        <label className="block">用自然语言安排日程<textarea rows={3} className="workspace-input" value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="例如：给高等数学添加本周五 23:59 截止的第三次作业，提交方式是课程平台" /></label>
        <p className="text-xs text-slate-500">生成预览会将当前存档发送至已配置的 AI API。预览确认后写入当前存档，可整体撤销。</p>
        <button disabled={busy || !instruction.trim() || !status.ai} className="workspace-button primary" onClick={() => void run(async () => { setProposal(null); setProposal(await localRequest('/ai/propose', { instruction: `用户时区：${Intl.DateTimeFormat().resolvedOptions().timeZone}。${instruction}`, snapshot: captureArchive() })) })}>生成操作预览</button>
        {proposal && <div className="rounded-xl border p-3 dark:border-slate-700"><h4>即将应用 {proposal.actions.length} 项操作</h4><div className="max-h-64 space-y-2 overflow-auto">{proposal.actions.map((a, i) => <div key={i} className="border-b py-2 text-xs dark:border-slate-700"><strong>{a.op === 'create_event' ? `新增：${a.event.name}` : a.op === 'create_chain' ? `新建事件链：${a.chain.name}` : `${a.op === 'delete_event' ? '删除' : '修改'}：${captureArchive().events.find(e => e.id === a.id)?.name || a.id}`}</strong><pre className="whitespace-pre-wrap break-all">{JSON.stringify(a, null, 2)}</pre></div>)}</div><button disabled={busy} className="workspace-button primary" onClick={() => void run(async () => { await applyActions(proposal.actions, proposal.revision); setProposal(null); setMessage('AI 操作已写入当前存档，可整体撤销') })}>确认应用到存档</button><button className="workspace-button" onClick={() => setProposal(null)}>取消</button></div>}
      </section>
    </>}
    <section className="border-t pt-4 text-xs text-slate-500 dark:border-slate-700"><h3 className="mb-2 font-semibold">外部 AI 的 MCP 接入</h3><p>启动命令：<code>npm run mcp</code>（工作目录设为本项目）。工具：<code>get_archive</code> 读取存档与版本，<code>apply_actions</code> 按版本应用事件操作。网页需保持打开并完成配对，修改即时落入当前存档。</p></section>
    {busy && <p role="status" className="text-sm">正在处理，请稍候…</p>}
    {message && <p role="status" className="break-all rounded-lg bg-indigo-50 p-3 text-sm text-indigo-700 dark:bg-slate-800 dark:text-indigo-200">{message}</p>}
  </div>
}
