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

test('fast completion preserves unrelated references, supports undo and rolls back storage failure', async () => {
  installArchive({ ...initial, eventChains: [{ id: 'c', name: '课程', typeId: 'course', color: '#123456', defaultReminders: [], createdAt: date, updatedAt: date }] })
  const before = captureArchive()
  await applyActions([
    ...createCourseTaskActions(before, { courseId: 'c', name: '作业', kind: '作业', endTime: '2026-09-21T23:59:00+08:00', notes: '保留备注' }),
    ...createCourseTaskActions(before, { courseId: 'c', name: '实验', kind: '实验课', startTime: '2026-09-21T14:00:00+08:00', endTime: '2026-09-21T16:00:00+08:00' }),
  ], await snapshotRevision(before))
  const original = useEventStore.getState(), [homework, lab] = [...original.events.values()], groups = useEventGroupStore.getState().groups
  original.setCourseTaskCompleted(homework.id, true)
  const updated = useEventStore.getState()
  assert.equal(updated.eventChains, original.eventChains)
  assert.equal(updated.eventTypes, original.eventTypes)
  assert.equal(updated.events.get(lab.id), lab)
  assert.equal(useEventGroupStore.getState().groups, groups)
  assert.equal(updated.events.get(homework.id)!.properties.notes, '保留备注')
  assert.equal(updated.events.get(homework.id)!.properties.completed, 'true')
  assert.equal(updated.undoStack.length, original.undoStack.length + 1)
  updated.undo(); assert.equal(useEventStore.getState().events.get(homework.id)!.properties.completed, 'false')
  useEventStore.getState().redo(); assert.equal(useEventStore.getState().events.get(homework.id)!.properties.completed, 'true')
  const stable = useEventStore.getState(), saved = storage.get('eventStore')
  failWrites = true
  try { assert.throws(() => stable.setCourseTaskCompleted(homework.id, false), /未修改/) } finally { failWrites = false }
  assert.equal(useEventStore.getState(), stable)
  assert.equal(storage.get('eventStore'), saved)
  stable.setCourseTaskCompleted(lab.id, false)
  assert.equal(useEventStore.getState().events.get(lab.id)!.properties.classCompletionOverride, 'true')
})
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


test('deletion tolerates unrelated archive changes but rejects changed targets', async () => {
  const event = { id: 'delete-target', name: '待删除', startTime: date, endTime: '2026-09-15T01:00:00.000Z', chainId: '', typeId: 'course', properties: {}, reminders: [], isHighlight: false, priority: 0, createdAt: date, updatedAt: date }
  installArchive({ ...initial, events: [event] })
  const preview = captureArchive(), revision = await snapshotRevision(preview)
  installArchive({ ...preview, semesterStartDate: '2027-01-01T00:00:00.000Z' })
  await applyActions([{ op: 'delete_event', id: event.id }], revision, preview)
  assert.equal(captureArchive().events.length, 0)
  assert.equal(JSON.parse(storage.get('eventStore')!).events.length, 0)
  assert.equal(captureArchive().semesterStartDate, '2027-01-01T00:00:00.000Z')
  useEventStore.getState().undo()
  assert.equal(captureArchive().events[0].id, event.id)
  installArchive({ ...preview, events: [{ ...event, name: '已改名' }] })
  await assert.rejects(() => applyActions([{ op: 'delete_event', id: event.id }], revision, preview), /尚未应用/)
  assert.equal(captureArchive().events[0].name, '已改名')
})
