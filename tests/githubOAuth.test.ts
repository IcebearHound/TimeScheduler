import test from 'node:test'
import assert from 'node:assert/strict'
import worker from '../worker/index'

const env = { APP_URL: 'https://planner.example/TimeScheduler/', AUTH_STATE_SECRET: 'synthetic-state-secret-at-least-32-chars', GITHUB_CLIENT_ID: 'synthetic-id', GITHUB_CLIENT_SECRET: 'synthetic-secret' }
const request = (path: string, body: unknown) => new Request(`https://auth.example${path}`, { method: 'POST', headers: { Origin: 'https://planner.example', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
test('GitHub cancellation is bound to its browser; expired state and substituted callbacks are rejected', async t => {
  const verifier = 'a'.repeat(64), nonce = 'b'.repeat(64)
  const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('hex')
  const start = await (await worker.fetch(request('/oauth/start', { provider: 'github', returnTo: env.APP_URL, challenge, nonce }), env)).json() as any
  const state = new URL(start.url).searchParams.get('state')!
  assert.equal((await worker.fetch(new Request(`https://other.example/oauth/callback/github?state=${state}&code=x`), env)).status, 400)
  assert.equal((await worker.fetch(new Request(`https://auth.example/oauth/callback/gitee?state=${state}&code=x`), env)).status, 400)
  const callback = await worker.fetch(new Request(`https://auth.example/oauth/callback/github?state=${state}&error=access_denied`), env)
  assert.equal(callback.status, 302)
  const ticket = new URLSearchParams(new URL(callback.headers.get('Location')!).hash.slice(1)).get('ts_oauth')!
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Cancellation must not exchange tokens') })
  assert.equal((await worker.fetch(request('/oauth/exchange', { ticket, verifier: 'c'.repeat(64), nonce }), env)).status, 403)
  const denied = await worker.fetch(request('/oauth/exchange', { ticket, verifier, nonce }), env)
  assert.equal(denied.status, 400); assert.match(await denied.text(), /取消/)
  const now = Date.now(); t.mock.method(Date, 'now', () => now + 600001)
  assert.equal((await worker.fetch(new Request(`https://auth.example/oauth/callback/github?state=${state}&code=x`), env)).status, 400)
})
test('GitHub refresh sends the refresh grant, preserves expiry metadata and keeps application secrets private', async t => {
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, 'https://github.com/login/oauth/access_token')
    const body = init.body as URLSearchParams
    assert.equal(body.get('grant_type'), 'refresh_token'); assert.equal(body.get('refresh_token'), 'old-refresh')
    assert.equal(body.get('client_secret'), env.GITHUB_CLIENT_SECRET); assert.equal(body.has('scope'), false)
    return new Response(JSON.stringify({ access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'bearer', expires_in: 28800, refresh_token_expires_in: 15897600 }))
  })
  const response = await worker.fetch(request('/oauth/refresh', { provider: 'github', refreshToken: 'old-refresh' }), env)
  const data = await response.json() as any
  assert.equal(response.status, 200); assert.equal(data.accessToken, 'new-access')
  assert.ok(data.expiresAt > Date.now()); assert.ok(data.refreshExpiresAt > data.expiresAt)
  const config = await (await worker.fetch(request('/config', {}), env)).json() as any
  assert.equal(config.github, true); assert.equal(config.gitee, false)
  assert.equal(config.githubAuthorizationUrl, 'https://github.com/settings/connections/applications/synthetic-id')
  assert.ok(!JSON.stringify(config).includes(env.GITHUB_CLIENT_SECRET))
})
test('Expired GitHub refresh tokens require login instead of repeated background retries', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'bad_refresh_token' })))
  const response = await worker.fetch(request('/oauth/refresh', { provider: 'github', refreshToken: 'expired-refresh' }), env)
  assert.equal(response.status, 401); assert.match(await response.text(), /重新登录/)
})
