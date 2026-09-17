import test from 'node:test'
import assert from 'node:assert/strict'
import worker from '../worker/index'
import { Snapshot } from '../src/integrations/contracts'
import { aiPresets } from '../src/integrations/aiPresets'
const date = '2026-09-16T00:00:00.000Z'
const initial: Snapshot = { version: 1, semesterStartDate: date, events: [], eventChains: [], eventTypes: [{ id: 'course', name: '课程', emoji: '📚', category: 'course', color: '#123456' }], groups: [{ id: 'default', name: '默认事件组', emoji: '📁', eventIds: [], eventChainIds: [], createdAt: date, updatedAt: date }], groupOrder: ['default'], activeGroupId: 'default' }

const env = { APP_URL: 'https://planner.example/TimeScheduler/', AUTH_STATE_SECRET: '' }
const request = (body: unknown, origin = 'https://planner.example') => new Request('https://relay.example/ai/propose', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: 'Bearer synthetic-api-key' }, body: JSON.stringify(body) })
const action = { op: 'create_event', event: { name: 'AI 新任务', startTime: date, endTime: '2026-09-16T01:00:00.000Z', chainId: '', typeId: 'course', properties: {}, reminders: [], priority: 0, isHighlight: false } }
for (const preset of Object.keys(aiPresets)) test(`hosted AI ${preset} uses preset origin and user key without OAuth or persistence`, async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    calls++
    assert.ok(url.startsWith(aiPresets[preset].baseUrl + '/'))
    assert.ok(!url.includes('synthetic-api-key'))
    const headers = init.headers as Record<string, string>
    assert.ok(Object.values(headers).some(value => value.includes('synthetic-api-key')))
    assert.equal(init.redirect, 'error')
    assert.ok(!(init.body as string).includes('synthetic-api-key'))
    const raw = JSON.stringify({ actions: [action] })
    return new Response(JSON.stringify(preset === 'anthropic' ? { content: [{ type: 'text', text: raw }] } : preset === 'gemini' ? { candidates: [{ content: { parts: [{ text: raw }] } }] } : { choices: [{ message: { content: raw } }] }))
  })
  const response = await worker.fetch(request({ preset, instruction: '添加任务', snapshot: initial, baseUrl: 'https://attacker.example' }), env)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.deepEqual(await response.json(), { actions: [action] })
  assert.equal(calls, 1)
})
test('AI relay rejects foreign origins, arbitrary providers, invalid snapshots and dangling references', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ actions: [{ op: 'delete_event', id: 'missing' }] }) } }] })) })
  assert.equal((await worker.fetch(request({ preset: 'deepseek', instruction: 'x', snapshot: initial }, 'https://evil.example'), env)).status, 403)
  for (const preset of ['custom', '__proto__', 'constructor']) assert.equal((await worker.fetch(request({ preset, instruction: 'x', snapshot: initial }), env)).status, 400)
  assert.equal((await worker.fetch(request({ preset: 'deepseek', instruction: 'x', snapshot: {} }), env)).status, 400)
  assert.equal(calls, 0)
  const invalid = await worker.fetch(request({ preset: 'deepseek', instruction: 'x', snapshot: initial }), env)
  assert.equal(invalid.status, 400)
  assert.ok(!(await invalid.text()).includes('synthetic-api-key'))
  assert.equal(calls, 1)
})
