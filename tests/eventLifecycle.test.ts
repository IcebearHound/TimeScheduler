import test from 'node:test'
import assert from 'node:assert/strict'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } })
const { default: events } = await import('../src/stores/eventStore')
const { default: groups } = await import('../src/stores/eventGroupStore')
const { captureArchive, installArchive } = await import('../src/integrations/archive')
const stamp = '2026-10-26T01:00:00.000Z'
const entry = (id: string, chainId = '') => ({ id, name: id, typeId: 'course', chainId, startTime: stamp, endTime: '2026-10-26T02:00:00.000Z', reminders: [], properties: { location: '教室 A' }, isHighlight: false, priority: 0, createdAt: stamp, updatedAt: stamp })
function reset() {
  installArchive({ version: 1, semesterStartDate: stamp, events: [entry('one', 'chain'), entry('two')], eventChains: [{ id: 'chain', name: '课程链', typeId: 'course', color: '#2563eb', defaultReminders: [], createdAt: stamp, updatedAt: stamp }], eventTypes: [{ id: 'course', name: '课程', category: 'course', color: '#2563eb', emoji: '📚' }], groups: [{ id: 'group', name: '分组', emoji: '📁', eventIds: ['one', 'two'], eventChainIds: ['chain'], createdAt: stamp, updatedAt: stamp }], groupOrder: ['group'], activeGroupId: 'group' })
  events.setState({ undoStack: [], redoStack: [], canUndo: false, canRedo: false })
  return captureArchive()
}

test('deleting events and chains keeps backups valid and restores all group references on undo', () => {
  for (const remove of [() => events.getState().deleteEvent('one'), () => events.getState().deleteEvents(['one', 'two']), () => events.getState().deleteEventChain('chain'), () => events.getState().deleteEventChains(['chain'])]) {
    const before = reset()
    remove()
    const after = captureArchive()
    assert.ok(!after.groups[0].eventIds.includes('one'))
    events.getState().undo(); assert.deepEqual(captureArchive(), before)
    events.getState().redo(); assert.deepEqual(captureArchive(), after)
  }
})

test('deleting a type retains events and chains under a valid fallback type', () => {
  const before = reset()
  events.getState().deleteEventType('course')
  const after = captureArchive()
  assert.equal(after.events.length, 2)
  assert.equal(after.eventChains.length, 1)
  const fallback = after.eventTypes.find(type => type.name === '未分类')!
  assert.ok(fallback)
  assert.ok(after.events.every(event => event.typeId === fallback.id))
  assert.equal(after.eventChains[0].typeId, fallback.id)
  events.getState().undo(); assert.deepEqual(captureArchive(), before)
})

test('creating an event and attaching it to its group is a single undoable operation', () => {
  const before = reset()
  const { id, createdAt, updatedAt, ...input } = entry('new')
  const created = events.getState().addEvent({ ...input, startTime: new Date(input.startTime), endTime: new Date(input.endTime) }, { groupId: 'group' })
  assert.ok(groups.getState().groups.get('group')!.eventIds.includes(created.id))
  assert.equal(events.getState().undoStack.length, 1)
  events.getState().undo(); assert.deepEqual(captureArchive(), before)
})

test('cut waits for paste, preserves event identity and groups, and never resurrects a deleted source', () => {
  const before = reset()
  events.getState().cutEvent('one')
  assert.deepEqual(captureArchive(), before, 'Cut alone cannot delete user data')
  const moved = events.getState().pasteEvent(new Date('2026-10-27T03:00:00.000Z'))!
  assert.equal(moved.id, 'one'); assert.equal(moved.name, 'one')
  assert.equal(events.getState().events.size, 2)
  assert.ok(groups.getState().groups.get('group')!.eventIds.includes('one'))
  events.getState().undo(); assert.deepEqual(captureArchive(), before)
  events.getState().cutEvent('one'); events.getState().deleteEvent('one')
  assert.equal(events.getState().pasteEvent(), null)
  assert.equal(events.getState().events.size, 1)
})

test('copied events are attached to the active group and paste supports one-step undo/redo', () => {
  const before = reset()
  events.getState().copyEvent('one')
  const pasted = events.getState().pasteEvent(new Date('2026-10-27T03:00:00.000Z'))!
  assert.notEqual(pasted.id, 'one')
  assert.ok(groups.getState().groups.get('group')!.eventIds.includes(pasted.id))
  const after = captureArchive()
  events.getState().undo(); assert.deepEqual(captureArchive(), before)
  events.getState().redo(); assert.deepEqual(captureArchive(), after)
})
