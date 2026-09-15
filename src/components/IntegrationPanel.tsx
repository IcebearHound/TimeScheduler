import { useEffect, useRef, useState } from 'react'
import { applyActions, captureArchive, installArchive } from '../integrations/archive'
import { Action, Snapshot, snapshotRevision } from '../integrations/contracts'
import { connectLocal, connectionStatus, disconnectLocal, isConnected, localRequest } from '../integrations/localClient'

type Provider = 'github' | 'gitee'
interface Status { unlocked: boolean; callback: string; providers?: Record<Provider, { configured: boolean; authorized: boolean }>; ai?: { provider: string; baseUrl: string; model: string } }
export default function IntegrationPanel({ mode, initialProvider = 'github' }: { mode: 'ai' | 'account'; initialProvider?: Provider }) {
  const [connected, setConnected] = useState(isConnected()), [code, setCode] = useState(''), [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status | null>(null), [bridge, setBridge] = useState(connectionStatus()), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  const [ai, setAI] = useState({ provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: '', apiKey: '' })
  const [instruction, setInstruction] = useState(''), [proposal, setProposal] = useState<{ actions: Action[]; revision: string } | null>(null)
  const [provider, setProvider] = useState<Provider>(initialProvider), [clientId, setClientId] = useState(''), [clientSecret, setClientSecret] = useState(''), [repo, setRepo] = useState('time-scheduler-private')
  const [auth, setAuth] = useState<{ provider: Provider; url: string; ticket?: string; userCode?: string; interval?: number; started: number; nextPoll: number; name: string } | null>(null)
  const [remote, setRemote] = useState<{ snapshot: Snapshot; sha: string; provider: Provider; name: string; localRevision: string } | null>(null)
  const alive = useRef(true)
  const refresh = async () => { const s = await localRequest<Status>('/status'); if (alive.current) setStatus(s); return s }
  const run = async (job: () => Promise<void>) => { setBusy(true); setMessage(''); try { await job() } catch (e) { setMessage(e instanceof Error ? e.message : '操作失败') } finally { setBusy(false) } }
  useEffect(() => { alive.current = true; if (isConnected()) void refresh().catch(e => setMessage(e.message)); const timer = setInterval(() => setBridge(connectionStatus()), 1000); return () => { alive.current = false; clearInterval(timer) } }, [])
  const push = async (p: Provider, name: string) => {
    const snapshot = captureArchive(), before = JSON.stringify(snapshot)
    const result = await localRequest('/sync/push', { provider: p, name, snapshot })
    setMessage(`私有仓库存档${result.unchanged ? '内容一致' : '已上传'}，下载回读 SHA-256 核验通过：${result.sha256}${JSON.stringify(captureArchive()) !== before ? '。同步期间本地又有修改，请再次同步。' : ''}`)
  }
  useEffect(() => {
    if (!auth) return
    let stopped = false, timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      if (Date.now() - auth.started > 15 * 60000) { setAuth(null); setMessage('授权等待超时，请重试'); return }
      try {
        let ready = false, interval = 3000
        if (auth.ticket) {
          const result = await localRequest('/oauth/poll', { ticket: auth.ticket }); ready = !result.pending; interval = result.interval || 5000
        } else { const result = await refresh(); ready = !!result.providers?.gitee.authorized }
        if (stopped) return
        if (ready) {
          await refresh(); if (stopped) return; setBusy(true)
          try { await push(auth.provider, auth.name) } finally { setBusy(false); setAuth(null) }
        } else timer = setTimeout(poll, interval)
      } catch (e) { if (!stopped) { setAuth(null); setMessage(e instanceof Error ? e.message : '授权失败') } }
    }
    timer = setTimeout(poll, Math.max(1000, auth.nextPoll - Date.now()))
    return () => { stopped = true; clearTimeout(timer) }
  }, [auth])

  return <div className="space-y-6">
    {mode === 'account' && <section className="space-y-1"><h3 className="font-semibold">{provider === 'github' ? 'GitHub' : 'Gitee'} 登录与同步</h3><p className="text-sm text-slate-500">连接并解锁本机凭据库后，可授权登录、自动创建私有仓库并同步存档。已保存的授权可直接用于后续同步。</p></section>}
    <section className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
      <h3 className="font-semibold">本机连接与加密凭据库</h3>
      <p className="text-xs text-slate-500">先在项目目录运行 <code>npm run local</code>，输入终端显示的配对码连接当前存档。{mode === 'ai' ? <>外部 AI 使用 MCP 时运行 <code>npm run mcp</code>，它已包含本机服务。</> : '登录凭据由本机服务加密保存，授权完成后自动建库并同步核验。'}</p>
      <p className="text-xs">{bridge}</p>
      {!connected ? <div className="flex flex-wrap gap-2"><input aria-label="本机配对码" className="workspace-input flex-1" value={code} placeholder="8 位配对码" autoComplete="off" onChange={e => setCode(e.target.value)} /><button disabled={busy || !code} className="workspace-button primary" onClick={() => void run(async () => { await connectLocal(code); setCode(''); setConnected(true); await refresh() })}>连接此存档（允许 MCP 读写）</button></div> : <>
        {!status?.unlocked ? <div className="flex flex-wrap gap-2"><input aria-label="本地加密口令" type="password" autoComplete="off" className="workspace-input flex-1" value={password} placeholder="本地加密口令，至少 12 个字符" onChange={e => setPassword(e.target.value)} /><button disabled={busy || password.length < 12} className="workspace-button primary" onClick={() => void run(async () => { const secret = password; setPassword(''); await localRequest('/vault/unlock', { password: secret }); await refresh() })}>创建 / 解锁凭据库</button></div> : <button disabled={busy || !!auth} className="workspace-button" onClick={() => void run(async () => { await localRequest('/vault/lock'); setAI(a => ({ ...a, apiKey: '' })); setClientSecret(''); await refresh() })}>锁定凭据库</button>}
        <button disabled={busy || !!auth} className="workspace-button" onClick={() => void run(async () => { await disconnectLocal(); setConnected(false); setStatus(null); setProposal(null); setRemote(null); setAI(a => ({ ...a, apiKey: '' })); setClientSecret('') })}>断开并锁定</button>
      </>}
      <p className="text-xs text-slate-500">密钥、登录令牌和刷新令牌仅以 AES-256-GCM 密文保存在本机。口令和解密密钥仅留在进程内存，不进入浏览器存档或同步仓库。请妥善保管口令。</p>
    </section>
    {status?.unlocked && <>
      {mode === 'ai' && (
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
      )}
      {mode === 'account' && (
      <section className="space-y-3 border-t pt-4 dark:border-slate-700">
        <h3 className="font-semibold">GitHub / Gitee 私有仓库同步</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>平台<select aria-label="平台" disabled={busy || !!auth} className="workspace-input" value={provider} onChange={e => { setProvider(e.target.value as Provider); setClientId(''); setClientSecret(''); setRemote(null) }}><option value="github">GitHub</option><option value="gitee">Gitee</option></select></label>
          <label>私有仓库名称<input disabled={busy || !!auth} className="workspace-input" value={repo} onChange={e => { setRepo(e.target.value); setRemote(null) }} /></label>
        </div>
        <p className="text-sm">{status.providers?.[provider]?.authorized ? '已授权' : '未授权'} · {status.providers?.[provider]?.configured ? '应用已配置' : '请先完成一次性应用配置'}</p>
        <details><summary className="cursor-pointer text-sm">首次使用：配置平台 OAuth 应用</summary><div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500">{provider === 'github' ? '在 GitHub Developer settings → OAuth Apps 创建应用并启用 Device Flow，填写 Client ID。授权需要 repo 范围以创建和读写私有仓库。' : `在 Gitee 创建第三方应用，回调地址填写 ${status.callback}，权限选择 user_info、projects。应用密钥只在本机服务端使用。`}</p>
          <label className="block">Client ID<input className="workspace-input" autoComplete="off" value={clientId} onChange={e => setClientId(e.target.value)} /></label>
          {provider === 'gitee' && <label className="block">Client Secret<input type="password" autoComplete="off" className="workspace-input" value={clientSecret} onChange={e => setClientSecret(e.target.value)} /></label>}
          <button disabled={busy || !clientId || (provider === 'gitee' && !clientSecret)} className="workspace-button" onClick={() => void run(async () => { await localRequest('/oauth/config', { provider, clientId, ...(clientSecret ? { clientSecret } : {}) }); setClientId(''); setClientSecret(''); await refresh(); setMessage('OAuth 应用配置已加密保存') })}>加密保存应用配置</button>
        </div></details>
        <p className="text-xs text-slate-500">授权后自动创建私有仓库、上传存档，再下载核验。远端有其他设备的更新时停止上传，先下载预览再决定是否恢复。同步仓库仅包含日程数据。</p>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy || !!auth || !status.providers?.[provider]?.configured} className="workspace-button primary" onClick={() => void run(async () => { const data = await localRequest('/oauth/start', { provider }); setAuth({ ...data, provider, name: repo, started: Date.now(), nextPoll: Date.now() + (data.interval || 3000) }); setMessage('打开下方授权页面完成登录；本面板将自动等待并同步') })}>授权登录 → 自动建库并同步</button>
          <button disabled={busy || !!auth || !status.providers?.[provider]?.authorized} className="workspace-button" onClick={() => void run(() => push(provider, repo))}>同步并核验</button>
          <button disabled={busy || !!auth || !status.providers?.[provider]?.authorized} className="workspace-button" onClick={() => void run(async () => { const localRevision = await snapshotRevision(captureArchive()); const data = await localRequest('/sync/pull', { provider, name: repo }); setRemote({ ...data, provider, name: repo, localRevision }) })}>下载远端预览</button>
          <button disabled={busy || !!auth || !status.providers?.[provider]?.authorized} className="workspace-button" onClick={() => void run(async () => { await localRequest('/oauth/forget', { provider }); await refresh(); setMessage('已删除本机登录令牌；如需撤销平台授权，请前往平台应用设置') })}>退出本机登录</button>
        </div>
        {auth && <div role="status" className="rounded-xl bg-indigo-50 p-3 dark:bg-slate-800">{auth.userCode && <p>设备验证码：<strong className="select-all text-lg">{auth.userCode}</strong></p>}<a className="workspace-button primary" href={auth.url} target="_blank" rel="noreferrer">打开 {auth.provider} 授权页面</a><button className="workspace-button" onClick={() => { setAuth(null); setMessage('已停止等待授权') }}>停止等待</button><p className="mt-2 text-xs">授权成功后将自动建私有仓库并同步核验。请保持此面板打开。</p></div>}
        {remote && <div className="rounded-xl border p-3 dark:border-slate-700"><h4>远端存档预览</h4><p className="text-sm">{remote.snapshot.events.length} 个事件 · {remote.snapshot.eventChains.length} 条事件链 · {remote.snapshot.groups.length} 个事件组</p><p className="text-xs text-slate-500">恢复会替换当前完整存档，可撤销。请先检查事件摘要。</p><div className="max-h-40 overflow-auto">{remote.snapshot.events.map(e => <p key={e.id} className="text-xs">{e.name} · {new Date(e.startTime).toLocaleString()} — {new Date(e.endTime).toLocaleString()}</p>)}</div><button disabled={busy} className="workspace-button primary" onClick={() => void run(async () => { const before = JSON.stringify(captureArchive()); if (await snapshotRevision(captureArchive()) !== remote.localRevision) throw new Error('本地存档已变化，请重新下载预览'); await localRequest('/sync/check', { provider: remote.provider, name: remote.name, sha: remote.sha }); if (JSON.stringify(captureArchive()) !== before) throw new Error('本地存档已变化，请重新下载预览'); installArchive(remote.snapshot); await localRequest('/sync/accept', { provider: remote.provider, name: remote.name, sha: remote.sha }); setRemote(null); setMessage('已恢复远端存档，可撤销') })}>恢复该存档</button><button className="workspace-button" onClick={() => setRemote(null)}>取消</button></div>}
      </section>
      )}
    </>}
    {mode === 'ai' && <section className="border-t pt-4 text-xs text-slate-500 dark:border-slate-700"><h3 className="mb-2 font-semibold">外部 AI 的 MCP 接入</h3><p>启动命令：<code>npm run mcp</code>（工作目录设为本项目）。工具：<code>get_archive</code> 读取存档与版本，<code>apply_actions</code> 按版本应用事件操作。网页需保持打开并完成配对，修改即时落入当前存档。</p></section>}
    {busy && <p role="status" className="text-sm">正在处理，请稍候…</p>}
    {message && <p role="status" className="break-all rounded-lg bg-indigo-50 p-3 text-sm text-indigo-700 dark:bg-slate-800 dark:text-indigo-200">{message}</p>}
  </div>
}
