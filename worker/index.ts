import { aiPresets } from '../src/integrations/aiPresets'
import { calendarRoute, CalendarEnv } from './calendar'
export { CalendarFeedObject } from './calendar'
import { aiConfigSchema, proposeActions, proposeAgent } from '../src/integrations/ai'
import { attachmentsSchema } from '../src/integrations/attachments'
import { webPagesSchema } from '../src/integrations/agentArtifacts'
import { projectActions, validateSnapshot } from '../src/integrations/contracts'
/** OAuth, AI and restricted repository relay; calendar feeds use isolated Durable Objects. */
export interface Env extends CalendarEnv {
  APP_URL: string
  AUTH_STATE_SECRET: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
  GITEE_CLIENT_ID?: string
  GITEE_CLIENT_SECRET?: string
}
type Provider = 'github' | 'gitee'
class ExpiredAuthorization extends Error {}
interface Flow { kind: 'state' | 'ticket'; provider: Provider; returnTo: string; redirectUri: string; challenge: string; nonce: string; expires: number; code?: string; error?: string }
const encoder = new TextEncoder()
const encode64 = (bytes: Uint8Array) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
const decode64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
const providerName = (value: unknown): Provider => { if (value !== 'github' && value !== 'gitee') throw new Error('不支持的账号平台'); return value }
const credentials = (env: Env, provider: Provider) => ({ clientId: provider === 'github' ? env.GITHUB_CLIENT_ID : env.GITEE_CLIENT_ID, clientSecret: provider === 'github' ? env.GITHUB_CLIENT_SECRET : env.GITEE_CLIENT_SECRET })
async function stateKey(env: Env) {
  if (!env.AUTH_STATE_SECRET || env.AUTH_STATE_SECRET.length < 32) throw new Error('网站登录服务尚未配置完成')
  return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', encoder.encode(env.AUTH_STATE_SECRET)), 'AES-GCM', false, ['encrypt', 'decrypt'])
}
async function seal(env: Env, flow: Flow) {
  const iv = crypto.getRandomValues(new Uint8Array(12)), data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode('TimeScheduler OAuth v1') }, await stateKey(env), encoder.encode(JSON.stringify(flow))))
  return `${encode64(iv)}.${encode64(data)}`
}
async function open(env: Env, value: unknown, kind: Flow['kind']): Promise<Flow> {
  if (typeof value !== 'string' || value.length > 12000) throw new Error('登录请求无效，请重新登录')
  try {
    const [iv, data, extra] = value.split('.')
    if (extra) throw new Error('invalid')
    const flow: Flow = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode64(iv), additionalData: encoder.encode('TimeScheduler OAuth v1') }, await stateKey(env), decode64(data))))
    if (flow.kind !== kind || flow.expires < Date.now() || flow.returnTo !== new URL(env.APP_URL).href) throw new Error('expired')
    providerName(flow.provider)
    return flow
  } catch { throw new Error('登录已过期或验证失败，请重新登录') }
}
async function hash(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), b => b.toString(16).padStart(2, '0')).join('') }
async function tokenRequest(provider: Provider, parameters: Record<string, string>) {
  const response = await fetch(provider === 'github' ? 'https://github.com/login/oauth/access_token' : 'https://gitee.com/oauth/token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(parameters), redirect: 'error', signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error('平台授权暂时失败，请重新登录')
  const data = await response.json() as any
  if (data.error === 'bad_refresh_token') throw new ExpiredAuthorization('登录已过期，请重新登录')
  if (data.error === 'incorrect_client_credentials' || data.error === 'redirect_uri_mismatch') throw new Error('网站授权配置不匹配，请联系网站管理员')
  if (typeof data.access_token !== 'string' || !data.access_token || data.error || (data.token_type && data.token_type.toLowerCase() !== 'bearer')) throw new Error('平台授权无效或已使用，请重新登录')
  const lifetime = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0 ? Date.now() + Number(value) * 1000 : undefined
  return { provider, accessToken: data.access_token, ...(typeof data.refresh_token === 'string' ? { refreshToken: data.refresh_token } : {}), ...(lifetime(data.expires_in) ? { expiresAt: lifetime(data.expires_in) } : {}), ...(lifetime(data.refresh_token_expires_in) ? { refreshExpiresAt: lifetime(data.refresh_token_expires_in) } : {}) }
}
async function body(request: Request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new Error('请求格式无效')
  if (Number(request.headers.get('Content-Length') || 0) > 12 * 1024 * 1024) throw new Error('存档过大')
  const reader = request.body?.getReader(); if (!reader) return {}
  const chunks: Uint8Array[] = []; let length = 0
  while (true) { const part = await reader.read(); if (part.done) break; length += part.value.length; if (length > 12 * 1024 * 1024) { await reader.cancel(); throw new Error('存档过大') }; chunks.push(part.value) }
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return JSON.parse(new TextDecoder().decode(bytes))
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname.startsWith('/calendar/')) return calendarRoute(request, env)
    const headers = new Headers({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Type': 'application/json; charset=utf-8' })
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers })
    try {
      const app = new URL(env.APP_URL), url = new URL(request.url)
      if (app.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(app.hostname)) throw new Error('网站地址需要 HTTPS')
      const callback = /^\/oauth\/callback\/(github|gitee)$/.exec(url.pathname)
      if (request.method === 'GET' && callback) {
        const flow = await open(env, url.searchParams.get('state'), 'state')
        if (flow.provider !== callback[1] || flow.redirectUri !== `${url.origin}${url.pathname}`) throw new Error('授权回调不匹配，请重新登录')
        const destination = new URL(flow.returnTo)
        if (url.searchParams.has('error')) destination.hash = new URLSearchParams({ ts_oauth: await seal(env, { ...flow, kind: 'ticket', error: url.searchParams.get('error') === 'access_denied' ? 'access_denied' : 'authorization_failed' }) }).toString()
        else {
          const code = url.searchParams.get('code')
          if (!code || code.length > 4096) throw new Error('缺少授权结果')
          destination.hash = new URLSearchParams({ ts_oauth: await seal(env, { ...flow, kind: 'ticket', code }) }).toString()
        }
        headers.set('Location', destination.href)
        return new Response(null, { status: 302, headers })
      }
      // Reject requests from other sites, including HTML form submissions and Origin:null.
      if (request.headers.get('Origin') !== app.origin) return json({ error: '此网站无权使用登录服务' }, 403)
      headers.set('Access-Control-Allow-Origin', app.origin); headers.set('Vary', 'Origin')
      if (request.method === 'OPTIONS') {
        headers.set('Access-Control-Allow-Methods', 'POST'); headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        return new Response(null, { status: 204, headers })
      }
      if (request.method !== 'POST') return json({ error: '请求方法无效' }, 405)
      const input = await body(request)
      if (url.pathname === '/ai/propose') {
        const preset = typeof input.preset === 'string' && Object.hasOwn(aiPresets, input.preset) ? aiPresets[input.preset] : undefined
        if (!preset) return json({ error: '网站 AI 转发仅支持内置服务商' }, 400)
        const authorization = request.headers.get('Authorization')
        if (!authorization?.startsWith('Bearer ') || authorization.length > 5007) return json({ error: '请填写 API Key' }, 401)
        const config = aiConfigSchema.safeParse({ ...preset, apiKey: authorization.slice(7), model: input.model || preset.model })
        if (!config.success || typeof input.instruction !== 'string' || !input.instruction.trim() || input.instruction.length > 20000) return json({ error: 'AI 请求参数无效' }, 400)
        // Fixed provider origins only: never forward credentials to a caller-supplied URL.
        let snapshot
        try { snapshot = validateSnapshot(input.snapshot) } catch { return json({ error: '存档格式无效' }, 400) }
        if (input.mode === 'agent') {
          try {
            const attachments = attachmentsSchema.parse(input.attachments || [])
            const webPages = webPagesSchema.parse(input.webPages || [])
            const reply = await proposeAgent(config.data, input.instruction, snapshot, { signal: request.signal, attachments, webPages })
            if (reply.actions.length) projectActions(snapshot, reply.actions, () => crypto.randomUUID())
            return json(reply)
          } catch (error) { return json({ error: error instanceof Error && !['TypeError', 'SyntaxError', 'ZodError'].includes(error.name) ? error.message : 'AI 返回无效结果，请重试' }, 400) }
        }
        let actions
        try { actions = await proposeActions(config.data, input.instruction, snapshot) }
        catch (error) { return json({ error: error instanceof Error && !['TypeError', 'SyntaxError', 'ZodError'].includes(error.name) ? error.message : 'AI 服务返回无效结果或暂时无法连接，请重试' }, 400) }
        try { projectActions(snapshot, actions, () => crypto.randomUUID()) } catch { return json({ error: 'AI 操作包含无效时间或不存在的事件，请重新描述' }, 400) }
        return json({ actions })
      }
      if (url.pathname === '/config') return json({ github: !!(env.AUTH_STATE_SECRET?.length >= 32 && env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET), gitee: !!(env.AUTH_STATE_SECRET?.length >= 32 && env.GITEE_CLIENT_ID && env.GITEE_CLIENT_SECRET), ...(env.GITHUB_CLIENT_ID ? { githubAuthorizationUrl: `https://github.com/settings/connections/applications/${encodeURIComponent(env.GITHUB_CLIENT_ID)}` } : {}) })
      if (url.pathname === '/oauth/start') {
        const provider = providerName(input.provider), config = credentials(env, provider)
        if (!config.clientId || !config.clientSecret) return json({ error: '该平台登录暂未开通，请稍后再试' }, 503)
        if (input.returnTo !== app.href || !/^[a-f0-9]{64}$/.test(input.challenge || '') || !/^[a-f0-9]{64}$/.test(input.nonce || '')) return json({ error: '登录验证参数无效' }, 400)
        const flow: Flow = { kind: 'state', provider, returnTo: app.href, redirectUri: `${url.origin}/oauth/callback/${provider}`, challenge: input.challenge, nonce: input.nonce, expires: Date.now() + 600000 }
        const query = new URLSearchParams({ client_id: config.clientId, redirect_uri: flow.redirectUri, response_type: 'code', scope: provider === 'github' ? 'repo offline_access' : 'user_info projects', state: await seal(env, flow) })
        if (provider === 'github') {
          // GitHub requires the base64url SHA-256 digest (43 characters), not our hex binding.
          query.set('code_challenge', encode64(Uint8Array.from(input.challenge.match(/../g) as string[], value => parseInt(value, 16))))
          query.set('code_challenge_method', 'S256')
          query.set('prompt', 'select_account')
        }
        return json({ url: `${provider === 'github' ? 'https://github.com/login/oauth/authorize' : 'https://gitee.com/oauth/authorize'}?${query}` })
      }
      if (url.pathname === '/oauth/exchange') {
        const flow = await open(env, input.ticket, 'ticket')
        if (typeof input.verifier !== 'string' || input.verifier.length !== 64 || flow.nonce !== input.nonce || flow.challenge !== await hash(input.verifier)) return json({ error: '登录验证失败，请从此设备重新登录' }, 403)
        if (flow.error) return json({ error: flow.error === 'access_denied' ? '你已取消 GitHub/Gitee 授权，日程仍保存在此设备，可随时重新登录' : '平台未完成授权，请重新登录' }, 400)
        const config = credentials(env, flow.provider)
        if (!config.clientId || !config.clientSecret || !flow.code || flow.redirectUri !== `${url.origin}/oauth/callback/${flow.provider}`) throw new Error('授权配置不完整或已变更，请重新登录')
        return json(await tokenRequest(flow.provider, { grant_type: 'authorization_code', code: flow.code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: flow.redirectUri, ...(flow.provider === 'github' ? { code_verifier: input.verifier } : {}) }))
      }
      if (url.pathname === '/oauth/refresh') {
        const provider = providerName(input.provider), config = credentials(env, provider)
        if (!config.clientId || !config.clientSecret || typeof input.refreshToken !== 'string' || input.refreshToken.length > 5000) throw new Error('登录已过期，请重新登录')
        return json(await tokenRequest(provider, { grant_type: 'refresh_token', refresh_token: input.refreshToken, client_id: config.clientId, client_secret: config.clientSecret }))
      }
      const api = /^\/api\/(github|gitee)$/.exec(url.pathname)
      if (api) {
        const provider = api[1] as Provider, authorization = request.headers.get('Authorization')
        if (!authorization?.startsWith('Bearer ') || authorization.length > 6000) return json({ error: '请重新登录账号' }, 401)
        if (typeof input.path !== 'string' || !input.path.startsWith('/') || input.path.startsWith('//')) return json({ error: '不支持此同步请求' }, 400)
        const target = new URL(input.path, 'https://api.invalid'), method = input.method || 'GET'
        if (target.origin !== 'https://api.invalid' || target.hash || [...target.searchParams.keys()].some(k => k !== 'ref')) return json({ error: '不支持此同步请求' }, 400)
        const repo = /^\/repos\/[\w.-]+\/time-scheduler-private$/.test(target.pathname)
        const contents = /^\/repos\/[\w.-]+\/time-scheduler-private\/contents\/time-scheduler-archive\.json$/.test(target.pathname)
        let payload: unknown
        if (method === 'GET' && (target.pathname === '/user' || repo || contents)) { /* read-only */ }
        else if (target.pathname === '/user/repos' && method === 'POST') payload = { name: 'time-scheduler-private', private: true, auto_init: true, description: 'TimeScheduler private archive' }
        else if (contents && ['PUT', 'POST'].includes(method)) {
          const b = input.body
          if (typeof b?.content !== 'string' || b.content.length > 10 * 1024 * 1024 || typeof b.branch !== 'string' || b.branch.length > 200 || (b.sha !== undefined && typeof b.sha !== 'string')) throw new Error('存档参数无效')
          payload = { message: 'Sync TimeScheduler archive', content: b.content, branch: b.branch, ...(b.sha ? { sha: b.sha } : {}) }
        } else return json({ error: '该接口仅允许同步专用私有仓库' }, 403)
        const response = await fetch((provider === 'github' ? 'https://api.github.com' : 'https://gitee.com/api/v5') + target.pathname + target.search, { method, headers: { Authorization: authorization, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'TimeScheduler' }, ...(payload ? { body: JSON.stringify(payload) } : {}), redirect: 'error', signal: AbortSignal.timeout(25000) })
        if (!response.ok) return json({ error: response.status === 401 ? '登录已过期，请重新登录' : response.status === 409 ? '另一台设备刚更新了存档，正在重新同步' : response.status === 403 || response.status === 429 ? '平台暂时限制了同步请求，请稍后重试' : '平台同步请求未完成' }, response.status)
        return new Response(response.body, { status: response.status, headers })
      }
      return json({ error: '接口不存在' }, 404)
    } catch (error) { return json({ error: error instanceof Error && !['TypeError', 'SyntaxError'].includes(error.name) ? error.message : '登录或同步暂时失败，请重试' }, error instanceof ExpiredAuthorization ? 401 : 400) }
  },
}
