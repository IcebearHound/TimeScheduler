import { AccountProvider } from '../stores/workspaceStore'
import { browserVault } from './browserVault'
import { Snapshot, snapshotRevision, validateSnapshot } from './contracts'

export interface CloudAccount { provider: AccountProvider; accessToken: string; refreshToken?: string; expiresAt?: number; refreshExpiresAt?: number; login: string; userId?: number; base?: Snapshot; repositoryUrl?: string }
interface PendingLogin { verifier: string; nonce: string; provider: AccountProvider; expires: number }
export const cloudEndpoint = (import.meta.env.VITE_AUTH_SERVICE_URL || '').replace(/\/$/, '')
export class CloudAPIError extends Error { constructor(message: string, readonly status: number) { super(message) } }
export async function cloudRequest(path: string, body?: unknown, token?: string) {
  if (!cloudEndpoint) throw new Error('网站尚未开通账号同步，请稍后再试')
  const url = new URL(cloudEndpoint)
  if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('登录服务地址需要 HTTPS')
  let response: Response
  try { response = await fetch(cloudEndpoint + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body || {}), redirect: 'error', signal: AbortSignal.timeout(30000) }) }
  catch { throw new Error(navigator.onLine ? '暂时无法连接同步服务，稍后会自动重试' : '当前离线，修改已保存在此设备') }
  const data = await response.json()
  if (!response.ok) throw new CloudAPIError(data.error || '同步失败，请稍后重试', response.status)
  return data
}
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
async function challenge(verifier: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))), b => b.toString(16).padStart(2, '0')).join('') }
export async function beginCloudLogin(provider: AccountProvider) {
  const pending: PendingLogin = { provider, verifier: random(), nonce: random(), expires: Date.now() + 600000 }
  await browserVault.set('pending-login', pending)
  const returnTo = new URL(import.meta.env.BASE_URL, location.origin).href
  try {
    const result = await cloudRequest('/oauth/start', { provider, returnTo, challenge: await challenge(pending.verifier), nonce: pending.nonce })
    const url = new URL(result.url)
    if (url.protocol !== 'https:' || url.host !== (provider === 'github' ? 'github.com' : 'gitee.com') || url.pathname !== (provider === 'github' ? '/login/oauth/authorize' : '/oauth/authorize') || url.username || url.password) throw new Error('授权服务返回了无效地址')
    // Same-tab navigation works on mobile and survives page reloads; no popups or device codes.
    location.assign(url.href)
  } catch (error) { await browserVault.remove('pending-login'); throw error }
}
export async function completeCloudLogin(): Promise<CloudAccount | undefined> {
  const params = new URLSearchParams(location.hash.slice(1)), ticket = params.get('ts_oauth'), failure = params.get('ts_oauth_error')
  if (!ticket && !failure) return undefined
  history.replaceState(null, '', location.pathname + location.search)
  const pending = await browserVault.get<PendingLogin>('pending-login')
  if (!pending || pending.expires < Date.now()) throw new Error('登录已过期，请重新登录')
  if (failure) { await browserVault.remove('pending-login'); throw new Error('未完成平台授权，请重新登录') }
  try {
    const data = await cloudRequest('/oauth/exchange', { ticket, verifier: pending.verifier, nonce: pending.nonce })
    if (data.provider !== pending.provider || typeof data.accessToken !== 'string') throw new Error('授权结果不匹配，请重新登录')
    const account: CloudAccount = { provider: data.provider, accessToken: data.accessToken, refreshToken: data.refreshToken, expiresAt: data.expiresAt, refreshExpiresAt: data.refreshExpiresAt, login: '' }
    const user = await repositoryRequest(account, '/user')
    if (typeof user.login !== 'string' || !/^[\w.-]+$/.test(user.login) || !Number.isSafeInteger(user.id) || user.id <= 0) throw new Error('平台未返回有效账号信息')
    account.login = user.login; account.userId = user.id
    const previous = await browserVault.get<CloudAccount>('account')
    if (previous?.provider === account.provider && previous.login === account.login && previous.userId === account.userId) { account.base = previous.base; account.repositoryUrl = previous.repositoryUrl }
    await browserVault.set('account', account)
    return account
  } finally { await browserVault.remove('pending-login') }
}
export async function repositoryRequest(account: CloudAccount, path: string, method = 'GET', body?: unknown) {
  return cloudRequest(`/api/${account.provider}`, { path, method, body }, account.accessToken)
}
export async function refreshCloudAccount(account: CloudAccount) {
  if (account.expiresAt && account.expiresAt < Date.now() + 60000) {
    if (!account.refreshToken || (account.refreshExpiresAt && account.refreshExpiresAt <= Date.now())) throw new CloudAPIError('登录已过期，请重新登录', 401)
    const next = await cloudRequest('/oauth/refresh', { provider: account.provider, refreshToken: account.refreshToken })
    if (next.provider !== account.provider || typeof next.accessToken !== 'string' || !next.accessToken) throw new CloudAPIError('授权结果无效，请重新登录', 401)
    const user = await repositoryRequest({ ...account, accessToken: next.accessToken }, '/user')
    if ((account.userId !== undefined && user.id !== account.userId) || user.login !== account.login) throw new CloudAPIError('账号身份发生变化，请重新登录后同步', 401)
    Object.assign(account, next)
    await browserVault.set('account', account)
  }
}
const repositoryName = 'time-scheduler-private'
export async function ensureCloudRepository(account: CloudAccount) {
  const path = `/repos/${encodeURIComponent(account.login)}/${repositoryName}`
  let repo
  try { repo = await repositoryRequest(account, path) } catch (e) { if (!(e instanceof CloudAPIError) || e.status !== 404) throw e }
  if (!repo) { await repositoryRequest(account, '/user/repos', 'POST', { name: repositoryName, private: true, auto_init: true, description: 'TimeScheduler private archive' }); repo = await repositoryRequest(account, path) }
  if (repo.private !== true) throw new Error('同名仓库不是私有仓库，已停止同步。请将其设为私有后重试')
  if (!repo.default_branch) throw new Error('私有仓库正在初始化，稍后会自动重试')
  return { path, branch: repo.default_branch as string, url: repo.html_url as string }
}
export type CloudRepository = Awaited<ReturnType<typeof ensureCloudRepository>>
const encode = (text: string) => { const bytes = new TextEncoder().encode(text); let binary = ''; for (const b of bytes) binary += String.fromCharCode(b); return btoa(binary) }
export async function readCloudArchive(account: CloudAccount, repo: CloudRepository): Promise<{ snapshot: Snapshot; sha: string } | undefined> {
  let file
  try { file = await repositoryRequest(account, `${repo.path}/contents/time-scheduler-archive.json?ref=${encodeURIComponent(repo.branch)}`) } catch (e) { if (e instanceof CloudAPIError && e.status === 404) return undefined; throw e }
  if (file.encoding !== 'base64' || typeof file.content !== 'string' || file.content.length > 16 * 1024 * 1024 || typeof file.sha !== 'string') throw new Error('云端存档无法读取，请检查仓库文件')
  const raw = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\s/g, '')), c => c.charCodeAt(0))))
  if (raw.version !== 1 || await snapshotRevision(raw.snapshot) !== raw.sha256) throw new Error('云端存档核验失败，已保留此设备的数据')
  return { snapshot: validateSnapshot(raw.snapshot), sha: file.sha }
}
export async function writeCloudArchive(account: CloudAccount, repo: CloudRepository, snapshot: Snapshot, sha?: string) {
  const sha256 = await snapshotRevision(snapshot)
  await repositoryRequest(account, `${repo.path}/contents/time-scheduler-archive.json`, account.provider === 'gitee' && !sha ? 'POST' : 'PUT', { message: 'Sync TimeScheduler archive', branch: repo.branch, content: encode(JSON.stringify({ version: 1, sha256, snapshot })), ...(sha ? { sha } : {}) })
  const verified = await readCloudArchive(account, repo)
  if (!verified || await snapshotRevision(verified.snapshot) !== sha256) throw new Error('同步后的内容尚未核验成功，稍后会重新检查')
  return verified
}
