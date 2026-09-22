import test from 'node:test'
import assert from 'node:assert/strict'
import { agentHistoryKey, createAgentHistoryStore } from '../src/stores/agentHistoryStore'
const memory = () => { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } } }

test('new conversation reuses the empty active thread without writing or resetting its selections', () => {
  const storage = memory(); let writes = 0
  const store = createAgentHistoryStore({ getItem: storage.getItem, setItem: (key, value) => { writes++; storage.setItem(key, value) } })
  const first = store.getState().activeId
  store.getState().updateThread(first, { profileId: 'saved-profile', model: 'saved-model', draft: '   ' })
  const before = writes
  for (let i = 0; i < 3; i++) assert.equal(store.getState().createThread(), first)
  assert.equal(writes, before)
  assert.equal(store.getState().threads.length, 1)
  assert.equal(store.getState().threads[0].model, 'saved-model')
  store.getState().updateThread(first, { draft: '尚未发送的安排' })
  const second = store.getState().createThread()
  assert.notEqual(second, first)
  assert.equal(store.getState().threads.find(t => t.id === first)!.draft, '尚未发送的安排')
  assert.equal(store.getState().createThread(), second)
  assert.equal(createAgentHistoryStore(storage).getState().threads.length, 2)
})

test('history restores conversations, drafts and model selections with isolated message context', () => {
  const storage = memory(), store = createAgentHistoryStore(storage), first = store.getState().activeId
  store.getState().append(first, { role: 'user', text: '下周实验安排' })
  store.getState().updateThread(first, { draft: '待发送草稿', profileId: 'profile-1', model: 'my-model' })
  const second = store.getState().createThread()
  store.getState().append(second, { role: 'assistant', text: '第二个对话', generatedFiles: [{ name: 'notes.txt', content: '可恢复的文件' }] })
  const restored = createAgentHistoryStore(storage).getState()
  assert.equal(restored.activeId, second)
  assert.equal(restored.threads.find(t => t.id === first)?.draft, '待发送草稿')
  assert.equal(restored.threads.find(t => t.id === first)?.model, 'my-model')
  assert.equal(restored.threads.find(t => t.id === first)?.title, '下周实验安排')
  assert.equal(restored.threads.find(t => t.id === second)?.messages.length, 1)
  assert.equal(restored.threads.find(t => t.id === second)?.messages[0].generatedFiles?.[0].content, '可恢复的文件')
})

test('rename, switching and deletion persist; deleting last conversation leaves a usable draft', () => {
  const storage = memory(), store = createAgentHistoryStore(storage), first = store.getState().activeId
  store.getState().renameThread(first, '  课程计划  ')
  store.getState().createThread(); store.getState().selectThread(first)
  assert.equal(createAgentHistoryStore(storage).getState().threads.find(t => t.id === first)?.title, '课程计划')
  store.getState().deleteThread(first)
  assert.notEqual(store.getState().activeId, first)
  store.getState().deleteThread(store.getState().activeId)
  assert.equal(store.getState().threads.length, 1)
  assert.deepEqual(store.getState().threads[0].messages, [])
})

test('history excludes pending actions and credentials; unreadable history is not overwritten', () => {
  const storage = memory(), store = createAgentHistoryStore(storage), first = store.getState().activeId
  store.setState({ threads: [{ ...store.getState().threads[0], apiKey: 'SECRET', proposal: { actions: [] } } as any] })
  store.getState().append(first, { role: 'user', text: '你好' })
  assert.ok(!storage.getItem(agentHistoryKey)!.includes('SECRET'))
  assert.ok(!storage.getItem(agentHistoryKey)!.includes('proposal'))
  storage.setItem(agentHistoryKey, 'broken-original')
  const broken = createAgentHistoryStore(storage)
  broken.getState().append(broken.getState().activeId, { role: 'user', text: '本次页面消息' })
  assert.ok(broken.getState().storageError)
  assert.equal(storage.getItem(agentHistoryKey), 'broken-original')
})

test('quota failures keep new messages in memory and visibly report persistence failure', () => {
  const store = createAgentHistoryStore({ getItem: () => null, setItem: () => { throw Error('quota') } })
  store.getState().append(store.getState().activeId, { role: 'user', text: '仍保留在页面中' })
  assert.equal(store.getState().threads[0].messages.length, 1)
  assert.match(store.getState().storageError, /保存失败/)
})
