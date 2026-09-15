import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import * as XLSX from 'xlsx'
import { Vault } from '../server/vault'
import { RepositoryProviders, digest } from '../server/providers'
import { ArchiveBridge } from '../server/bridge'
import { proposeActions } from '../server/ai'
import { Snapshot, projectActions, snapshotRevision, validateSnapshot } from '../src/integrations/contracts'
import { assignmentActions, readAssignmentWorkbook, safeSubmissionLink } from '../src/utils/assignmentTable'

const date = '2026-09-15T00:00:00.000Z'
function archive(): Snapshot {
  return { version: 1, semesterStartDate: date, events: [], eventChains: [], eventTypes: [{ id: 'course', name: '课程', emoji: '📚', category: 'course', color: '#123456' }], groups: [{ id: 'group', name: '默认', emoji: '📁', eventIds: [], eventChainIds: [], createdAt: date, updatedAt: date }], groupOrder: ['group'], activeGroupId: 'group' }
}
const row = { course: '数学', name: '作业一', deadline: '2026-09-18T23:59', kind: '作业', link: 'https://example.com/submit', submission: '在线提交', content: '第 3 章', notes: '备注' }
const add = { op: 'create_event', event: { name: '事件', startTime: date, endTime: '2026-09-15T01:00:00.000Z', chainId: '', typeId: 'course', reminders: [], properties: {}, isHighlight: false, priority: 0 } }
function temporary(t: Parameters<Parameters<typeof test>[1]>[0]) {
  const directory = mkdtempSync(join(tmpdir(), 'time-scheduler-integration-'))
  t.after(() => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + '\\') || resolve(directory).startsWith(resolve(tmpdir()) + '/')); rmSync(directory, { recursive: true, force: true }) })
  return directory
}

test('task import reuses chains, extracts hyperlinks, and updates links without duplicating tasks', () => {
  const first = projectActions(archive(), assignmentActions(archive(), [row]), () => crypto.randomUUID())
  assert.equal(first.eventChains.length, 1); assert.equal(first.events.length, 1)
  assert.equal(first.events[0].properties.taskKind, '作业')
  const sheet = XLSX.utils.aoa_to_sheet([['课程', '名称', '提交链接'], ['数学', '作业一', '点此提交']])
  sheet.C2.l = { Target: 'https://example.com/new' }
  const rows = readAssignmentWorkbook({ SheetNames: ['任务'], Sheets: { 任务: sheet } })
  const second = projectActions(first, assignmentActions(first, rows), () => crypto.randomUUID())
  assert.equal(second.events.length, 1); assert.equal(second.eventChains.length, 1)
  assert.equal(second.events[0].properties.submissionUrl, 'https://example.com/new')
  assert.equal(second.events[0].endTime, first.events[0].endTime)
  assert.throws(() => assignmentActions(first, [row, row]), /重复/)
  assert.throws(() => safeSubmissionLink('javascript:alert(1)'), /HTTP/)
  assert.throws(() => assignmentActions(archive(), [{ ...row, deadline: '2026-02-30' }]), /日期不存在/)
  const dates = XLSX.utils.aoa_to_sheet([['课程', '名称', '截止日期'], ['数学', '实验', 0]])
  const parsed = readAssignmentWorkbook({ SheetNames: ['任务'], Sheets: { 任务: dates }, Workbook: { WBProps: { date1904: true } } })
  assert.equal(parsed[0].deadline, '1904-01-01T00:00')
})

test('archive operations reject invalid references and times without mutating their input', () => {
  const initial = archive(), original = JSON.stringify(initial)
  assert.throws(() => projectActions(initial, [add, { op: 'delete_event', id: 'missing' }], () => crypto.randomUUID()), /不存在/)
  assert.equal(JSON.stringify(initial), original)
  assert.throws(() => projectActions(initial, [{ ...add, event: { ...add.event, endTime: date } }], () => 'event'), /结束时间/)
  assert.throws(() => projectActions(initial, [{ ...add, event: { ...add.event, chainId: 'missing' } }], () => 'event'), /不存在/)
  assert.throws(() => validateSnapshot({ ...initial, apiKey: 'must-not-sync' }))
})

test('vault persists authenticated ciphertext only and rejects wrong passwords and tampering', t => {
  const file = join(temporary(t), 'credentials.enc'), password = 'test-only-password-12345', secret = 'test-token-never-in-plaintext'
  const vault = new Vault(file)
  vault.unlock(password); vault.set('token:github', { accessToken: secret })
  const raw = readFileSync(file, 'utf8')
  assert.ok(!raw.includes(secret)); assert.ok(!raw.includes(password)); assert.ok(!raw.includes('accessToken'))
  vault.lock(); assert.throws(() => vault.get('token:github'), /解锁/)
  assert.throws(() => vault.unlock('wrong-password-123'), /口令/)
  vault.unlock(password); assert.deepEqual(vault.get('token:github'), { accessToken: secret }); vault.lock()
  const data = JSON.parse(raw); data.tag = Buffer.alloc(16).toString('base64'); writeFileSync(file, JSON.stringify(data))
  assert.throws(() => vault.unlock(password), /损坏/)
})

test('MCP bridge enforces live browser ownership, revision checks, and browser acknowledgement', async () => {
  const bridge = new ArchiveBridge(), initial = archive()
  assert.throws(() => bridge.read(), /未连接/)
  await bridge.heartbeat('first', initial)
  await assert.rejects(() => bridge.heartbeat('second', initial), /另一个网页/)
  assert.throws(() => bridge.apply([add], 'outdated'), /版本冲突/)
  const revision = bridge.read().revision
  const pending = bridge.apply([add], revision)
  const command = (await bridge.heartbeat('first', initial)).command!
  const changed = projectActions(initial, [add], () => 'new-event')
  await bridge.acknowledge('first', command.id, { snapshot: changed })
  assert.equal((await pending as any).applied, true)
  assert.equal(bridge.read().revision, await snapshotRevision(changed))
  bridge.disconnect(); assert.throws(() => bridge.read(), /未连接/)
})

for (const provider of ['github', 'gitee'] as const) test(`${provider} creates private repository, verifies readback, rejects remote conflicts and public repositories`, async t => {
  const vault = new Vault(join(temporary(t), 'credentials.enc')); vault.unlock('test-only-password-123')
  vault.set(`token:${provider}`, { accessToken: 'test-token' })
  const p = new RepositoryProviders(vault, 'http://127.0.0.1:4318/oauth/gitee/callback')
  let repo: any = null, remote: any = null, puts = 0
  const originalFetch = globalThis.fetch; t.after(() => { globalThis.fetch = originalFetch; vault.lock() })
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    assert.equal((init.headers as any).Authorization, 'Bearer test-token')
    assert.ok(!url.includes('test-token'))
    const path = new URL(url).pathname.replace(provider === 'gitee' ? '/api/v5' : '', '')
    const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
    if (path === '/user') return respond({ login: 'tester' })
    if (path === '/user/repos') { const input = JSON.parse(init.body as string); assert.equal(input.private, true); repo = { private: true, default_branch: 'main', html_url: 'https://example.com/private' }; return respond(repo) }
    if (path === '/repos/tester/test-private') return respond(repo || {}, repo ? 200 : 404)
    if (path.endsWith('/contents/time-scheduler-archive.json')) {
      if (init.method === 'GET') return respond(remote || {}, remote ? 200 : 404)
      const input = JSON.parse(init.body as string)
      assert.equal(init.method, provider === 'gitee' && !remote ? 'POST' : 'PUT')
      assert.equal(input.sha, remote?.sha)
      remote = { sha: `commit-${++puts}`, encoding: 'base64', content: input.content }; return respond({ content: remote })
    }
    throw new Error(`Unexpected ${path}`)
  }) as typeof fetch
  const initial = archive()
  assert.equal((await p.push(provider, 'test-private', initial)).verified, true)
  assert.equal(puts, 1)
  assert.equal((await p.push(provider, 'test-private', initial)).unchanged, true)
  const changed = projectActions(initial, [add], () => 'e')
  await p.push(provider, 'test-private', changed); assert.equal(puts, 2)
  remote.sha = 'other-device-commit'
  await assert.rejects(() => p.push(provider, 'test-private', initial), /远端存档已变化/)
  const pulled = await p.pull(provider, 'test-private'); assert.deepEqual(pulled.snapshot, changed)
  const envelope = { version: 1, snapshot: changed, sha256: 'corrupt' }
  remote.content = Buffer.from(JSON.stringify(envelope)).toString('base64')
  await assert.rejects(() => p.pull(provider, 'test-private'), /核验失败/)
  repo.private = false
  await assert.rejects(() => p.push(provider, 'test-private', initial), /不是私有/)
})

test('Gitee OAuth rejects forged and replayed state; fresh flow cannot reuse a prior login', async t => {
  const vault = new Vault(join(temporary(t), 'credentials.enc')); vault.unlock('test-only-password-123')
  vault.set('oauth:gitee', { clientId: 'test-client', clientSecret: 'test-secret' }); vault.set('token:gitee', { accessToken: 'old-token' })
  const p = new RepositoryProviders(vault, 'http://127.0.0.1:4318/oauth/gitee/callback')
  const flow = await p.start('gitee')
  const state = new URL(flow.url).searchParams.get('state')!
  assert.equal((await p.poll(state)).pending, true)
  await assert.rejects(() => p.callbackGitee('code', 'forged'), /state/)
  const previous = globalThis.fetch; t.after(() => { globalThis.fetch = previous })
  globalThis.fetch = (async (_url: string, init: RequestInit) => { assert.equal((init.body as URLSearchParams).get('client_secret'), 'test-secret'); return new Response(JSON.stringify({ access_token: 'new-token', refresh_token: 'refresh', expires_in: 3600 })) }) as typeof fetch
  await p.callbackGitee('code', state)
  assert.equal((await p.poll(state)).pending, false)
  await assert.rejects(() => p.callbackGitee('code', state), /state/)
})

test('AI adapters send secrets in headers and validate structured actions for all three protocols', async t => {
  const previous = globalThis.fetch; t.after(() => { globalThis.fetch = previous })
  for (const provider of ['openai', 'anthropic', 'gemini'] as const) {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      assert.ok(!url.includes('test-key'))
      assert.equal(init.redirect, 'error')
      const raw = JSON.stringify({ actions: [add] })
      const data = provider === 'openai' ? { choices: [{ message: { content: raw } }] } : provider === 'anthropic' ? { content: [{ type: 'text', text: raw }] } : { candidates: [{ content: { parts: [{ text: raw }] } }] }
      return new Response(JSON.stringify(data))
    }) as typeof fetch
    const actions = await proposeActions({ provider, baseUrl: 'https://example.com/v1', model: 'test', apiKey: 'test-key' }, '添加任务', archive())
    assert.equal(actions[0].op, 'create_event')
  }
  assert.equal(digest('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})
