import { useEffect, useState } from 'react'
import { Github, Cloud, CheckCircle, RefreshCw, WifiOff } from 'lucide-react'
import useCloudSyncStore from '../stores/cloudSyncStore'
import { AccountProvider } from '../stores/workspaceStore'
import { beginCloudLogin, cloudEndpoint, cloudRequest } from '../integrations/cloudAPI'
import { logoutCloud, resolveSyncConflict, syncNow } from '../integrations/autoSync'

export default function CloudAccountPanel({ initialProvider }: { initialProvider: AccountProvider }) {
  const sync = useCloudSyncStore()
  const [available, setAvailable] = useState<Record<AccountProvider, boolean> | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => { let active = true; if (cloudEndpoint) void cloudRequest('/config').then(result => { if (active) setAvailable(result) }).catch(() => { if (active) setError('登录服务暂时不可用，请稍后重试') }); return () => { active = false } }, [])
  const run = async (job: () => Promise<void>) => { setBusy(true); setError(''); try { await job() } catch (e) { setError(e instanceof Error ? e.message : '操作未完成，请重试') } finally { setBusy(false) } }
  const providers = [initialProvider, initialProvider === 'github' ? 'gitee' : 'github'] as AccountProvider[]
  return <div className="space-y-6">
    <div className="rounded-2xl bg-indigo-50 p-5 dark:bg-slate-800">
      <Cloud className="mb-3 h-8 w-8 text-indigo-500" />
      <h3 className="text-lg font-semibold">登录账号，日程随身同步</h3>
      <p className="mt-2 text-sm text-slate-500">登录后自动创建私有仓库。换一台手机或电脑登录同一账号，即可找回日程；离线也能编辑，联网后自动同步。</p>
    </div>
    {sync.login ? <section className="space-y-3 rounded-xl border p-4 dark:border-slate-700">
      <p className="font-semibold">{sync.provider === 'github' ? 'GitHub' : 'Gitee'} · {sync.login}</p>
      <p role="status" className="flex items-center gap-2 text-sm">{sync.status === 'synced' ? <CheckCircle size={16} className="text-emerald-500" /> : sync.status === 'offline' ? <WifiOff size={16} /> : <RefreshCw size={16} className={sync.status === 'syncing' ? 'animate-spin' : ''} />}{sync.message}</p>
      {sync.lastSynced && <p className="text-xs text-slate-500">上次同步：{new Date(sync.lastSynced).toLocaleString()}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="workspace-button" disabled={busy || sync.status === 'syncing' || !!sync.conflict} onClick={() => void run(syncNow)}>立即同步</button>
        {sync.repositoryUrl && /^https:\/\/(github\.com|gitee\.com)\//.test(sync.repositoryUrl) && <a className="workspace-button" href={sync.repositoryUrl} target="_blank" rel="noreferrer">查看私有仓库</a>}
        <button className="workspace-button" disabled={busy || sync.status === 'syncing'} onClick={() => void run(logoutCloud)}>退出登录</button>
      </div>
      {sync.conflict && <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-900/20"><p>两台设备同时修改了同一项内容，自动同步已暂停。</p><p className="text-xs">{sync.conflict.message}。选择后会保留一份本机恢复备份。</p><button className="workspace-button" disabled={busy} onClick={() => void run(() => resolveSyncConflict('local'))}>保留此设备版本</button><button className="workspace-button" disabled={busy} onClick={() => void run(() => resolveSyncConflict('remote'))}>采用云端版本</button></div>}
    </section> : sync.status === 'error' && <p role="alert" className="text-sm text-rose-600">{sync.message}</p>}
    {(!sync.login || sync.status === 'error') && <section className="space-y-3">
      {providers.map(provider => {
        const Icon = provider === 'github' ? Github : Cloud
        return <button key={provider} disabled={busy || !available?.[provider]} onClick={() => void run(() => beginCloudLogin(provider))} className="workspace-button flex w-full items-center justify-center gap-3 py-3 text-base primary"><Icon size={20} />使用 {provider === 'github' ? 'GitHub' : 'Gitee'} 账号登录</button>
      })}
      {!cloudEndpoint || (available && !available.github && !available.gitee) ? <p role="status" className="text-sm text-slate-500">网站暂未开通账号同步，你仍可正常使用和保存日程。服务开通后即可登录。</p> : !available && !error ? <p className="text-xs text-slate-500">正在连接登录服务…</p> : null}
    </section>}
    <p className="text-xs text-slate-500">登录令牌加密保存在当前浏览器，仅用于你的私有仓库。退出登录不会删除日程；清除网站数据后需要重新登录。</p>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
  </div>
}
