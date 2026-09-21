import test from 'node:test'
import assert from 'node:assert/strict'
import { captureArchive, installArchive, applyActions } from '../src/integrations/archive'
import { snapshotRevision } from '../src/integrations/contracts'
import { configureCourseTaskRulesActions, createCourseTaskActions, setCourseRowCategoryActions } from '../src/integrations/courseTasks'
import useEventStore from '../src/stores/eventStore'
import useEventGroupStore from '../src/stores/eventGroupStore'

const storage = new Map<string, string>()
let failWrites = false
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { if (failWrites) throw new Error('quota'); storage.set(key, value) }, removeItem: (key: string) => storage.delete(key) } })
const date = '2026-09-15T00:00:00.000Z'
const initial = { version: 1, semesterStartDate: date, events: [], eventChains: [], eventTypes: [{ id: 'course', name: '课程', emoji: '📚', category: 'course', color: '#123456' }], groups: [{ id: 'g', name: '默认', emoji: '📁', eventIds: [], eventChainIds: [], createdAt: date, updatedAt: date }], groupOrder: ['g'], activeGroupId: 'g' }
test('archive replacement restores semester and groups on undo; failed batches do not partially save', async () => {
  installArchive(initial)
  const before = captureArchive()
  const revision = await snapshotRevision(before)
  await applyActions([{ op: 'create_event', event: { name: '任务', startTime: date, endTime: '2026-09-15T01:00:00.000Z', chainId: '', typeId: 'course', properties: {}, reminders: [], isHighlight: false, priority: 0 } }], revision)
  assert.equal(captureArchive().events.length, 1)
  await assert.rejects(() => applyActions([{ op: 'delete_event', id: 'missing' }], revision), /变化/)
  useEventStore.getState().undo(); assert.deepEqual(captureArchive(), before)
  useEventStore.getState().redo(); assert.equal(captureArchive().events.length, 1)
  installArchive({ ...initial, semesterStartDate: '2027-01-01T00:00:00.000Z', groups: [{ ...initial.groups[0], name: '恢复的分组' }] })
  useEventStore.getState().undo()
  assert.equal(captureArchive().semesterStartDate, date)
  assert.equal(useEventGroupStore.getState().groups.get('g')?.name, '默认')
  const stable = captureArchive(); failWrites = true
  assert.throws(() => installArchive(initial), /回滚/)
  assert.deepEqual(captureArchive(), stable); failWrites = false
})

test('task rules and row conversion persist and undo as separate whole transactions', async () => {
  installArchive({ ...initial, eventChains: [{ id: 'c', name: '实验课程', typeId: 'course', color: '#123456', defaultReminders: [], createdAt: date, updatedAt: date }] })
  const save = async (actions: Parameters<typeof applyActions>[0]) => applyActions(actions, await snapshotRevision(captureArchive()))
  await save(createCourseTaskActions(captureArchive(), { courseId: 'c', name: '报告', kind: '实验报告', endTime: '2026-09-21T23:59:00+08:00' }))
  const before = captureArchive()
  await save(configureCourseTaskRulesActions(before, 'c', { labAnchor: { eventId: before.events[0].id, number: 3 }, skipHolidays: true }))
  const numbered = captureArchive()
  assert.equal(numbered.eventChains[0].taskRules?.labAnchor?.number, 3)
  await save(setCourseRowCategoryActions(numbered, 'c', '作业'))
  assert.equal(captureArchive().events[0].properties.taskKind, '作业')
  useEventStore.getState().undo(); assert.deepEqual(captureArchive(), numbered)
  useEventStore.getState().undo(); assert.deepEqual(captureArchive(), before)
  useEventStore.getState().redo(); assert.deepEqual(captureArchive(), numbered)
})
