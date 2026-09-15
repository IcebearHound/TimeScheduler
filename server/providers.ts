import { randomBytes, createHash } from 'node:crypto'
import { Vault } from './vault'
import { Snapshot, validateSnapshot } from '../src/integrations/contracts'

export type Provider = 'github' | 'gitee'
export interface OAuthConfig { clientId: string; clientSecret?: string }
interface Credentials { accessToken: string; refreshToken?: string; expiresAt?: number }
const api = { github: 'https://api.github.com', gitee: 'https://gitee.com/api/v5' }
export function digest(value: string) { return createHash('sha256').update(value).digest('hex') }

async function jsonFetch(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30000), redirect: 'error' })
  if (!response.ok) throw new Error(`平台请求失败（HTTP ${response.status}）`)
  return response.json() as Promise<any>
}
export class RepositoryProviders {
  private devices = new Map<string, { code: string; expires: number; nextPoll: number; interval: number }>()
  private states = new Map<string, { expires: number; phase: 'pending' | 'exchanging' | 'complete' | 'failed' }>()
  constructor(private vault: Vault, readonly callback: string) {}
  cancel() { this.devices.clear(); this.states.clear() }
  async start(provider: Provider) {
    const config = this.vault.get<OAuthConfig>(`oauth:${provider}`)
    if (!config?.clientId) throw new Error('请先配置 OAuth 应用 ID')
    if (provider === 'github') {
      const data = await jsonFetch('https://github.com/login/device/code', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: config.clientId, scope: 'repo' }) })
      if (!data.device_code || !data.user_code) throw new Error('设备授权未启用，请在 GitHub OAuth App 中启用 Device Flow')
      const ticket = randomBytes(24).toString('hex'), interval = Math.max(5, data.interval || 5) * 1000
      this.devices.set(ticket, { code: data.device_code, expires: Date.now() + Math.min(data.expires_in || 900, 1800) * 1000, nextPoll: Date.now() + interval, interval })
      return { ticket, userCode: data.user_code, url: 'https://github.com/login/device', interval }
    }
    if (!config.clientSecret) throw new Error('Gitee 授权需要本地加密保存的应用密钥')
    const state = randomBytes(32).toString('hex')
    this.states.set(state, { expires: Date.now() + 600000, phase: 'pending' })
    const query = new URLSearchParams({ client_id: config.clientId, redirect_uri: this.callback, response_type: 'code', scope: 'user_info projects', state })
    return { url: `https://gitee.com/oauth/authorize?${query}`, ticket: state, interval: 3000 }
  }
  async poll(ticket: string) {
    const authorization = this.states.get(ticket)
    if (authorization) {
      if (authorization.expires < Date.now() || authorization.phase === 'failed') { this.states.delete(ticket); throw new Error('Gitee 授权失败或过期，请重试') }
      if (authorization.phase === 'complete') { this.states.delete(ticket); return { pending: false } }
      return { pending: true, interval: 3000 }
    }
    const device = this.devices.get(ticket)
    if (!device || device.expires < Date.now()) { this.devices.delete(ticket); throw new Error('授权已过期，请重试') }
    if (Date.now() < device.nextPoll) return { pending: true, interval: device.interval }
    device.nextPoll = Date.now() + device.interval
    const config = this.vault.get<OAuthConfig>('oauth:github')!
    const data = await jsonFetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: config.clientId, device_code: device.code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }) })
    if (data.error === 'authorization_pending') return { pending: true, interval: device.interval }
    if (data.error === 'slow_down') { device.interval += 5000; device.nextPoll = Date.now() + device.interval; return { pending: true, interval: device.interval } }
    this.devices.delete(ticket)
    if (!data.access_token || data.error) throw new Error('授权被拒绝或已过期')
    this.vault.set('token:github', { accessToken: data.access_token })
    return { pending: false }
  }
  async callbackGitee(code: string, state: string) {
    const entry = this.states.get(state)
    if (!entry || entry.expires < Date.now() || entry.phase !== 'pending') throw new Error('无效或已过期的 OAuth state')
    entry.phase = 'exchanging'
    const config = this.vault.get<OAuthConfig>('oauth:gitee')!
    try {
    const data = await jsonFetch('https://gitee.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: config.clientId, client_secret: config.clientSecret!, redirect_uri: this.callback }) })
    if (!data.access_token) throw new Error('Gitee 未返回访问令牌')
    this.vault.set('token:gitee', { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + (data.expires_in || 86400) * 1000 })
    entry.phase = 'complete'
    } catch (error) { entry.phase = 'failed'; throw error }
  }
  private async credentials(provider: Provider): Promise<Credentials> {
    let token = this.vault.get<Credentials>(`token:${provider}`)
    if (!token?.accessToken) throw new Error('请先授权登录')
    if (provider === 'gitee' && token.expiresAt && token.expiresAt < Date.now() + 60000) {
      if (!token.refreshToken) throw new Error('授权已过期，请重新登录')
      const data = await jsonFetch('https://gitee.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refreshToken }) })
      if (!data.access_token) throw new Error('刷新授权失败，请重新登录')
      token = { accessToken: data.access_token, refreshToken: data.refresh_token || token.refreshToken, expiresAt: Date.now() + (data.expires_in || 86400) * 1000 }
      this.vault.set(`token:${provider}`, token)
    }
    return token
  }
  private async request(provider: Provider, path: string, method = 'GET', body?: unknown, missingOK = false) {
    const token = await this.credentials(provider)
    const response = await fetch(api[provider] + path, { method, headers: { Authorization: `Bearer ${token.accessToken}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'TimeScheduler-local' }, body: body ? JSON.stringify(body) : undefined, redirect: 'error', signal: AbortSignal.timeout(30000) })
    if (missingOK && response.status === 404) return null
    if (!response.ok) throw new Error(`${provider} 请求失败（HTTP ${response.status}）；请检查授权范围或稍后重试`)
    return response.json() as Promise<any>
  }
  async ensureRepository(provider: Provider, name: string, create = true) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(name)) throw new Error('仓库名仅支持字母、数字、下划线、点和连字符')
    const user = await this.request(provider, '/user')
    const path = `/repos/${encodeURIComponent(user.login)}/${encodeURIComponent(name)}`
    let repo = await this.request(provider, path, 'GET', undefined, true)
    if (!repo && !create) throw new Error('远端仓库不存在，请先授权并上传存档')
    if (!repo) repo = await this.request(provider, '/user/repos', 'POST', { name, private: true, auto_init: true, description: 'TimeScheduler private archive' })
    // Re-read: never trust a successful creation response alone to guarantee privacy.
    repo = await this.request(provider, path)
    if (repo.private !== true) throw new Error('目标仓库不是私有仓库，已停止同步')
    if (!repo.default_branch) throw new Error('仓库尚未初始化，请稍后重试')
    return { path, branch: repo.default_branch as string, url: repo.html_url as string, key: `${provider}:${user.login}:${name}` }
  }
  private async remote(provider: Provider, repo: Awaited<ReturnType<RepositoryProviders['ensureRepository']>>) {
    return this.request(provider, `${repo.path}/contents/time-scheduler-archive.json?ref=${encodeURIComponent(repo.branch)}`, 'GET', undefined, true)
  }
  private decode(remote: any) {
    if (!remote || remote.encoding !== 'base64' || typeof remote.content !== 'string' || remote.content.length > 16 * 1024 * 1024) throw new Error('远端存档内容缺失或过大')
    let envelope: any
    try { envelope = JSON.parse(Buffer.from(remote.content, 'base64').toString('utf8')) } catch { throw new Error('远端存档不是有效 JSON') }
    if (envelope.version !== 1 || typeof envelope.sha256 !== 'string' || digest(JSON.stringify(envelope.snapshot)) !== envelope.sha256) throw new Error('远端存档 SHA-256 核验失败')
    return validateSnapshot(envelope.snapshot)
  }
  async push(provider: Provider, name: string, input: unknown) {
    const snapshot = validateSnapshot(input), repo = await this.ensureRepository(provider, name)
    const remote = await this.remote(provider, repo), baseline = this.vault.get<string>(`sync:${repo.key}`)
    const hash = digest(JSON.stringify(snapshot))
    if (remote && digest(JSON.stringify(this.decode(remote))) === hash) {
      this.vault.set(`sync:${repo.key}`, remote.sha)
      return { verified: true, sha256: hash, url: repo.url, unchanged: true }
    }
    if (remote ? remote.sha !== baseline : !!baseline) throw new Error('远端存档已变化，或本机尚未同步过该仓库。请先下载预览并恢复远端存档，以免覆盖其他设备的数据')
    const envelope = JSON.stringify({ version: 1, sha256: hash, snapshot })
    const path = `${repo.path}/contents/time-scheduler-archive.json`
    await this.request(provider, path, provider === 'github' || remote ? 'PUT' : 'POST', { message: 'Sync TimeScheduler archive', content: Buffer.from(envelope).toString('base64'), branch: repo.branch, ...(remote ? { sha: remote.sha } : {}) })
    const check = await this.remote(provider, repo)
    if (digest(JSON.stringify(this.decode(check))) !== hash) throw new Error('上传后读取核验失败；请重新同步核验')
    this.vault.set(`sync:${repo.key}`, check.sha)
    return { verified: true, sha256: hash, url: repo.url, unchanged: false }
  }
  async pull(provider: Provider, name: string) {
    const repo = await this.ensureRepository(provider, name, false), remote = await this.remote(provider, repo)
    if (!remote) throw new Error('该仓库尚无存档，请先上传')
    return { snapshot: this.decode(remote), sha: remote.sha, url: repo.url }
  }
  async accept(provider: Provider, name: string, sha: string, commit = true) {
    const repo = await this.ensureRepository(provider, name, false), remote = await this.remote(provider, repo)
    if (!remote || remote.sha !== sha) throw new Error('远端又有更新，请重新下载')
    this.decode(remote); if (commit) this.vault.set(`sync:${repo.key}`, sha)
  }
  status() { return Object.fromEntries((['github', 'gitee'] as const).map(p => [p, { configured: !!this.vault.get<OAuthConfig>(`oauth:${p}`)?.clientId, authorized: !!this.vault.get<Credentials>(`token:${p}`)?.accessToken }])) }
}
