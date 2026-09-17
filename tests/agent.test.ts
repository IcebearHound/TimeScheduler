import test from 'node:test'
import assert from 'node:assert/strict'
import { agentSystemPrompt, parseAgentReply, proposeAgent } from '../src/integrations/ai'
import { Snapshot } from '../src/integrations/contracts'
import worker from '../worker/index'
const date = '2026-09-17T00:00:00.000Z'
const snapshot: Snapshot = { version: 1, semesterStartDate: date, events: [], eventChains: [], eventTypes: [{ id: 'course', name: '课程', emoji: '📚', category: 'course', color: '#123456' }], groups: [{ id: 'default', name: '默认事件组', emoji: '📁', eventIds: [], eventChainIds: [], createdAt: date, updatedAt: date }], groupOrder: ['default'], activeGroupId: 'default' }
const action = { op: 'create_event', event: { name: '实验', startTime: date, endTime: '2026-09-17T01:00:00.000Z', chainId: '', typeId: 'course', properties: {}, reminders: [], priority: 0, isHighlight: false } }
test('queries, clarification and import cannot mutate the archive; edit cannot ask and execute together', () => {
  for (const intent of ['query', 'clarify', 'import']) {
    assert.equal(parseAgentReply({ intent, message: '回复', actions: [] }, snapshot).actions.length, 0)
    assert.throws(() => parseAgentReply({ intent, message: '回复', actions: [action] }, snapshot))
  }
  assert.throws(() => parseAgentReply({ intent: 'edit', message: '修改', question: '哪一天？', actions: [action] }, snapshot))
  assert.throws(() => parseAgentReply({ intent: 'query', message: '找到事件', eventIds: ['invented'] }, snapshot))
  assert.ok(agentSystemPrompt().includes('先按合理范围给出结果'))
  assert.ok(agentSystemPrompt().includes('不能猜测并先执行'))
})
for (const provider of ['openai', 'anthropic', 'gemini'] as const) test(`Agent ${provider} preserves replies and follow-up questions`, async t => {
  const reply = { intent: 'query', message: '没有找到明天的课程。', question: '要查看本周吗？', actions: [], eventIds: [] }
  t.mock.method(globalThis, 'fetch', async () => {
    const raw = JSON.stringify(reply)
    return new Response(JSON.stringify(provider === 'anthropic' ? { content: [{ type: 'text', text: raw }] } : provider === 'gemini' ? { candidates: [{ content: { parts: [{ text: raw }] } }] } : { choices: [{ message: { content: raw } }] }))
  })
  assert.deepEqual(await proposeAgent({ provider, baseUrl: 'https://example.com/v1', model: 'test', apiKey: 'synthetic' }, '有什么课', snapshot), reply)
})
test('hosted Agent preserves clarification without requiring a nonempty action list', async t => {
  const reply = { intent: 'clarify', message: '实验安排在哪一天、几点？', actions: [], eventIds: [] }
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] })))
  const request = new Request('https://relay.example/ai/propose', { method: 'POST', headers: { Origin: 'https://planner.example', 'Content-Type': 'application/json', Authorization: 'Bearer synthetic' }, body: JSON.stringify({ mode: 'agent', preset: 'deepseek', instruction: '添加实验', snapshot }) })
  const result = await worker.fetch(request, { APP_URL: 'https://planner.example/', AUTH_STATE_SECRET: '' })
  assert.equal(result.status, 200); assert.deepEqual(await result.json(), reply)
})
