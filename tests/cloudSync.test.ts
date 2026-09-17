import test from 'node:test'
import assert from 'node:assert/strict'
import worker, { Env } from '../worker/index'
import { mergeArchives, SyncConflict } from '../src/integrations/syncMerge'
import { projectActions, Snapshot } from '../src/integrations/contracts'

const date = '2026-09-16T00:00:00.000Z'
const initial: Snapshot = { version: 1, semesterStartDate: date, events: [], eventChains: [], eventTypes: [{ id: 'course', name: '课程', emoji: '📚', category: 'course', color: '#123456' }], groups: [{ id: 'default', name: '默认事件组', emoji: '📁', eventIds: [], eventChainIds: [], createdAt: date, updatedAt: date }], groupOrder: ['default'], activeGroupId: 'default' }
const add = (name: string) => ({ op: 'create_event', event: { name, startTime: date, endTime: '2026-09-16T01:00:00.000Z', chainId: '', typeId: 'course', properties: {}, reminders: [], priority: 0, isHighlight: false } })
test('auto sync merges independent offline edits and preserves deletions without reviving events', () => {
  const base = projectActions(initial, [add('初始任务')], () => 'e1')
  const local = projectActions(base, [add('手机新增')], () => 'phone')
  const remote = projectActions(base, [add('电脑新增')], () => 'desktop')
  const merged = mergeArchives(base, local, remote)
  assert.equal(merged.events.length, 3)
  assert.deepEqual(new Set(merged.groups[0].eventIds), new Set(['e1', 'phone', 'desktop']))
  const deleted = projectActions(base, [{ op: 'delete_event', id: 'e1' }], () => 'unused')
  assert.equal(mergeArchives(base, deleted, base).events.length, 0)
  const changed = projectActions(base, [{ op: 'update_event', id: 'e1', changes: { name: '另一设备修改' } }], () => 'unused')
  assert.throws(() => mergeArchives(base, deleted, changed), SyncConflict)
  assert.deepEqual(mergeArchives(undefined, initial, remote), remote)
})
test('auto sync merges different fields but asks about competing changes to the same field', () => {
  const base = projectActions(initial, [add('初始任务')], () => 'e')
  const left = projectActions(base, [{ op: 'update_event', id: 'e', changes: { name: '新名称' } }], () => 'unused')
  const right = projectActions(base, [{ op: 'update_event', id: 'e', changes: { properties: { notes: '备注' } } }], () => 'unused')
  assert.equal(mergeArchives(base, left, right).events[0].name, '新名称')
  assert.equal(mergeArchives(base, left, right).events[0].properties.notes, '备注')
  right.events[0].name = '冲突的名称'
  assert.throws(() => mergeArchives(base, left, right), SyncConflict)
})

const env: Env = { APP_URL: 'https://planner.example/TimeScheduler/', AUTH_STATE_SECRET: 'synthetic-state-secret-at-least-32-chars', GITHUB_CLIENT_ID: 'synthetic-github-id', GITHUB_CLIENT_SECRET: 'synthetic-github-secret', GITEE_CLIENT_ID: 'synthetic-gitee-id', GITEE_CLIENT_SECRET: 'synthetic-gitee-secret' }
const request = (path: string, body: unknown, origin = 'https://planner.example', token?: string) => new Request(`https://auth.example${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
for (const provider of ['github', 'gitee'] as const) test(`${provider} hosted OAuth binds callback to browser verifier, rejects forged state and never redirects tokens`, async t => {
  const verifier = 'a'.repeat(64), nonce = 'b'.repeat(64)
  const challenge = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))), b => b.toString(16).padStart(2, '0')).join('')
  const args = { provider, returnTo: env.APP_URL, challenge, nonce }
  assert.equal((await worker.fetch(request('/oauth/start', args, 'https://untrusted.example'), env)).status, 403)
  assert.equal((await worker.fetch(request('/oauth/start', { ...args, returnTo: 'https://untrusted.example/' }), env)).status, 400)
  const start = await (await worker.fetch(request('/oauth/start', args), env)).json() as any
  const state = new URL(start.url).searchParams.get('state')!
  const authorization = new URL(start.url)
  assert.equal(authorization.searchParams.get('redirect_uri'), `https://auth.example/oauth/callback/${provider}`)
  if (provider === 'github') {
    assert.equal(authorization.searchParams.get('code_challenge'), Buffer.from(challenge, 'hex').toString('base64url'))
    assert.equal(authorization.searchParams.get('code_challenge')!.length, 43)
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256')
    assert.equal(authorization.searchParams.get('prompt'), 'select_account')
    assert.equal(authorization.searchParams.get('scope'), 'repo offline_access')
  } else assert.equal(authorization.searchParams.has('code_challenge'), false)
  const forged = await worker.fetch(new Request(`https://auth.example/oauth/callback/${provider}?state=forged&code=test-code`), env)
  assert.equal(forged.status, 400)
  const callback = await worker.fetch(new Request(`https://auth.example/oauth/callback/${provider}?state=${encodeURIComponent(state)}&code=test-code`), env)
  assert.equal(callback.status, 302)
  const location = callback.headers.get('Location')!
  assert.ok(location.startsWith(env.APP_URL)); assert.ok(!location.includes('test-code'))
  const ticket = new URLSearchParams(new URL(location).hash.slice(1)).get('ts_oauth')!
  assert.equal((await worker.fetch(request('/oauth/exchange', { ticket, verifier: 'wrong', nonce }), env)).status, 403)
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original })
  let exchanges = 0
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    assert.ok(!url.includes('secret')); assert.equal(init.redirect, 'error')
    const params = init.body as URLSearchParams
    assert.equal(params.get('code_verifier'), provider === 'github' ? verifier : null)
    assert.equal(params.get('redirect_uri'), `https://auth.example/oauth/callback/${provider}`)
    assert.equal(params.get('code'), 'test-code'); assert.equal(params.get('client_secret'), `synthetic-${provider}-secret`)
    return new Response(JSON.stringify(++exchanges === 1 ? { access_token: 'synthetic-login-token', refresh_token: 'synthetic-refresh-token' } : { error: 'invalid_grant' }))
  }) as typeof fetch
  const exchange = await worker.fetch(request('/oauth/exchange', { ticket, verifier, nonce }), env)
  assert.equal(exchange.status, 200); assert.equal(exchange.headers.get('Cache-Control'), 'no-store')
  assert.equal((await exchange.json() as any).accessToken, 'synthetic-login-token')
  assert.equal((await worker.fetch(request('/oauth/exchange', { ticket, verifier, nonce }), env)).status, 400)
})
test('hosted relay refuses arbitrary URLs and non-scheduler writes, and forces private repository creation', async t => {
  for (const path of ['https://evil.example', '//evil.example', '/repos/user/other-repo', '/user/emails']) {
    assert.ok((await worker.fetch(request('/api/github', { path, method: 'POST' }, 'https://planner.example', 'test-token'), env)).status >= 400)
  }
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original })
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    assert.equal(url, 'https://api.github.com/user/repos')
    const body = JSON.parse(init.body as string)
    assert.equal(body.private, true); assert.equal(body.name, 'time-scheduler-private')
    assert.equal((init.headers as any).Authorization, 'Bearer test-token')
    return new Response(JSON.stringify({ private: true }))
  }) as typeof fetch
  assert.equal((await worker.fetch(request('/api/github', { path: '/user/repos', method: 'POST', body: { private: false, name: 'other' } }, 'https://planner.example', 'test-token'), env)).status, 200)
})
