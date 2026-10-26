import test from 'node:test'
import assert from 'node:assert/strict'
import { createPersistenceManager, validateStoredEntries } from '../src/stores/persistenceStore'

test('quota failure remains visible and retry clears the error only after a successful write', () => {
  let full = true
  const data = new Map<string, string>()
  const manager = createPersistenceManager(() => ({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { if (full) throw Error('QuotaExceeded'); data.set(key, value) } }))
  assert.equal(manager.write('eventStore', { events: ['new'] }), false)
  assert.equal(manager.useStatus.getState().issues.eventStore?.kind, 'unsaved')
  full = false
  assert.ok(manager.write('eventStore', { events: ['new'] }))
  assert.equal(manager.useStatus.getState().issues.eventStore, undefined)
  assert.equal(JSON.parse(data.get('eventStore')!).events[0], 'new')
})

test('unreadable archives cannot be silently replaced by defaults or subsequent edits', () => {
  const data = new Map([['eventStore', '{corrupted']])
  const manager = createPersistenceManager(() => ({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } }))
  manager.protect('eventStore')
  assert.equal(manager.write('eventStore', { events: [] }), false)
  assert.equal(data.get('eventStore'), '{corrupted')
  assert.equal(manager.useStatus.getState().issues.eventStore?.kind, 'unreadable')
  manager.acknowledge('eventStore')
  assert.ok(manager.write('eventStore', { events: [] }))
})

test('unavailable storage does not crash startup and malformed entry maps are rejected', () => {
  const manager = createPersistenceManager(() => { throw Error('SecurityError') })
  assert.equal(manager.read('eventStore'), null)
  assert.equal(manager.write('eventStore', {}), false)
  for (const input of [null, {}, [['a', { id: 'b', name: 'mismatch' }]], [['a', { id: 'a', name: 'one' }], ['a', { id: 'a', name: 'two' }]]]) assert.throws(() => validateStoredEntries(input))
})
