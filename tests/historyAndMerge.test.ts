import test from 'node:test'
import assert from 'node:assert/strict'
import type { Event, EventChain, EventGroup } from '../src/types/event'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
})

const [{ default: useEventStore }, { default: useEventGroupStore }] = await Promise.all([
  import('../src/stores/eventStore'),
  import('../src/stores/eventGroupStore'),
])

const baseDate = new Date(2026, 7, 12, 9, 0)

function group(id: string, eventChainIds: string[] = [], eventIds: string[] = []): EventGroup {
  return { id, name: id, emoji: '📁', eventChainIds, eventIds, createdAt: baseDate, updatedAt: baseDate }
}

function chain(id: string): EventChain {
  return {
    id,
    name: id,
    typeId: 'type-course',
    color: '#000000',
    defaultReminders: [],
    createdAt: baseDate,
    updatedAt: baseDate,
  }
}

function event(id: string, chainId: string, name = id): Event {
  return {
    id,
    name,
    startTime: baseDate,
    endTime: new Date(baseDate.getTime() + 60 * 60 * 1000),
    chainId,
    typeId: 'type-course',
    reminders: [],
    properties: {},
    isHighlight: false,
    priority: 0,
    createdAt: baseDate,
    updatedAt: baseDate,
  }
}

function resetStores(groups: EventGroup[] = []) {
  storage.clear()
  useEventStore.setState({
    events: new Map(),
    eventChains: new Map(),
    eventTypes: new Map(),
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
  })
  useEventGroupStore.setState({
    groups: new Map(groups.map(item => [item.id, item])),
    groupOrder: groups.map(item => item.id),
    activeGroupId: groups[0]?.id || '',
    undoStack: [],
    redoStack: [],
  })
}

test('global event history restores and reapplies group-only changes', () => {
  resetStores([group('original')])

  useEventGroupStore.getState().addGroup({
    name: 'new-group',
    emoji: '📁',
    eventChainIds: [],
    eventIds: [],
  })
  assert.equal(useEventGroupStore.getState().groups.size, 2)

  useEventStore.getState().undo()
  assert.deepEqual(useEventGroupStore.getState().groupOrder, ['original'])

  useEventStore.getState().redo()
  assert.equal(useEventGroupStore.getState().groups.size, 2)
})

test('batch group deletion is one undoable transaction', () => {
  resetStores([group('one'), group('two'), group('three')])

  useEventGroupStore.getState().deleteGroups(['one', 'two'])
  assert.equal(useEventStore.getState().undoStack.length, 1)
  assert.deepEqual(useEventGroupStore.getState().groupOrder, ['three'])

  useEventStore.getState().undo()
  assert.deepEqual(useEventGroupStore.getState().groupOrder, ['one', 'two', 'three'])
})

test('event-chain merge is atomic and restores group references on undo', () => {
  const target = chain('target')
  const source = chain('source')
  const targetEvent = event('target-event', target.id, 'same-time')
  const sourceEvent = event('source-event', source.id, 'same-time')
  resetStores([group('group', [source.id], [sourceEvent.id])])
  useEventStore.setState({
    events: new Map([[targetEvent.id, targetEvent], [sourceEvent.id, sourceEvent]]),
    eventChains: new Map([[target.id, target], [source.id, source]]),
  })

  useEventStore.getState().mergeEventChains(target.id, [source.id])

  const mergedState = useEventStore.getState()
  assert.equal(mergedState.undoStack.length, 1)
  assert.equal(mergedState.eventChains.has(source.id), false)
  assert.equal(Array.from(mergedState.events.values()).every(item => item.chainId === target.id), true)
  assert.equal(Array.from(mergedState.events.values()).some(item => item.name === 'same-time (合并)'), true)
  assert.deepEqual(useEventGroupStore.getState().groups.get('group')?.eventChainIds, [target.id])
  assert.notDeepEqual(useEventGroupStore.getState().groups.get('group')?.eventIds, [sourceEvent.id])

  useEventStore.getState().undo()
  assert.equal(useEventStore.getState().eventChains.has(source.id), true)
  assert.equal(useEventStore.getState().events.get(sourceEvent.id)?.chainId, source.id)
  assert.deepEqual(useEventGroupStore.getState().groups.get('group')?.eventChainIds, [source.id])
  assert.deepEqual(useEventGroupStore.getState().groups.get('group')?.eventIds, [sourceEvent.id])

  useEventStore.getState().redo()
  assert.equal(useEventStore.getState().eventChains.has(source.id), false)
  assert.equal(useEventStore.getState().undoStack.length, 1)
})
