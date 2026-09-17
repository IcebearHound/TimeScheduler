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

for (const provider of ['openai', 'anthropic', 'gemini'] as const) test(`Agent ${provider} sends text, image and PDF attachments in provider format`, async t => {
  const attachments = [
    { kind: 'text' as const, name: '安排.txt', text: '星期一 19:00 实验' },
    { kind: 'image' as const, name: '课表.png', mimeType: 'image/png' as const, data: 'aGVsbG8=' },
    { kind: 'pdf' as const, name: '课程.pdf', mimeType: 'application/pdf' as const, data: 'JVBERi0xLjc=' },
  ]
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const body = JSON.parse(String(init?.body))
    const parts = provider === 'gemini' ? body.contents[0].parts : body.messages.at(-1).content
    assert.equal(parts.length, 3)
    assert.equal(JSON.parse(parts[0].text).attachments[0].text, attachments[0].text)
    if (provider === 'openai') {
      assert.equal(parts[1].image_url.url, 'data:image/png;base64,aGVsbG8=')
      assert.equal(parts[2].file.filename, '课程.pdf')
      assert.equal(parts[2].file.file_data, 'data:application/pdf;base64,JVBERi0xLjc=')
    } else if (provider === 'anthropic') {
      assert.equal(parts[1].type, 'image'); assert.equal(parts[2].type, 'document')
      assert.equal(parts[2].source.media_type, 'application/pdf')
    } else {
      assert.equal(parts[1].inline_data.mime_type, 'image/png')
      assert.equal(parts[2].inline_data.data, 'JVBERi0xLjc=')
    }
    const raw = JSON.stringify({ intent: 'query', message: '已读取附件' })
    return new Response(JSON.stringify(provider === 'anthropic' ? { content: [{ type: 'text', text: raw }] } : provider === 'gemini' ? { candidates: [{ content: { parts: [{ text: raw }] } }] } : { choices: [{ message: { content: raw } }] }))
  })
  assert.equal((await proposeAgent({ provider, baseUrl: 'https://example.com/v1', model: 'test', apiKey: 'synthetic' }, '读取附件', snapshot, { attachments })).message, '已读取附件')
})

test('relay forwards validated attachments and rejects invalid attachment types before contacting provider', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    calls++
    const body = JSON.parse(String(init?.body))
    assert.equal(JSON.parse(body.messages[1].content).attachments[0].text, '周一晚实验课')
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: 'query', message: '附件摘要' }) } }] }))
  })
  const send = (attachments: unknown) => worker.fetch(new Request('https://relay.example/ai/propose', { method: 'POST', headers: { Origin: 'https://planner.example', 'Content-Type': 'application/json', Authorization: 'Bearer synthetic' }, body: JSON.stringify({ mode: 'agent', preset: 'deepseek', instruction: '读取附件', snapshot, attachments }) }), { APP_URL: 'https://planner.example/', AUTH_STATE_SECRET: '' })
  assert.equal((await send([{ kind: 'text', name: '任务.txt', text: '周一晚实验课' }])).status, 200)
  assert.equal((await send([{ kind: 'image', name: '图片.svg', mimeType: 'image/svg+xml', data: 'aGVsbG8=' }])).status, 400)
  assert.equal(calls, 1)
})
