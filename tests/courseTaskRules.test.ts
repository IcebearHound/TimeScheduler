import test from 'node:test'
import assert from 'node:assert/strict'
import { projectActions, Snapshot, validateSnapshot } from '../src/integrations/contracts'
import { createCourseTaskActions, listCourseTasks, configureCourseTaskRulesActions, setCourseRowCategoryActions, updateCourseTaskActions } from '../src/integrations/courseTasks'
import { createWeeklyTaskActions } from '../src/utils/weeklyTasks'
import { buildCourseTaskSchedule } from '../src/utils/courseTaskSchedule'
const stamp = '2026-09-01T00:00:00Z'
const initial = (): Snapshot => validateSnapshot({ version: 1, semesterStartDate: stamp, events: [], eventChains: [{ id: 'c', name: '测试课程', typeId: 'course', color: '#333333', defaultReminders: [], createdAt: stamp, updatedAt: stamp }], eventTypes: [{ id: 'course', name: '课程', emoji: '📚', category: 'course', color: '#333333' }], groups: [], groupOrder: [], activeGroupId: '' })
const apply = (s: Snapshot, actions: unknown) => projectActions(s, actions, () => crypto.randomUUID())
const lab = { courseId: 'c', name: '实验', kind: '实验课' as const, startTime: '2026-09-07T14:00:00+08:00', endTime: '2026-09-07T16:00:00+08:00', labGroupId: 'lab-first' }
test('weekly lab bundles use real lab types, independent groups and synchronized numbering around any anchor', () => {
  let s = initial()
  const actions = createWeeklyTaskActions(s, [lab, { ...lab, kind: '实验报告', startTime: undefined, endTime: '2026-09-10T23:59:00+08:00' }], { count: 6, intervalWeeks: 1 })
  s = apply(s, actions)
  assert.equal(s.events.length, 12)
  assert.ok(s.events.every(e => s.eventTypes.find(t => t.id === e.typeId)?.category === 'lab'))
  assert.equal(new Set(s.events.map(e => e.properties.labGroupId)).size, 6)
  s = apply(s, configureCourseTaskRulesActions(s, 'c', { labAnchor: { eventId: s.events[4].id, number: 3 }, skipHolidays: true }))
  const rows = listCourseTasks(s)
  const classes = rows.filter(e => e.kind === '实验课')
  assert.deepEqual(classes.map(e => e.sequence), [1, 2, 3, 4, null, 5])
  assert.equal(classes[4].skipReason, '国庆节')
  assert.equal(rows.find(e => e.labGroupId === classes[4].labGroupId && e.kind === '实验报告')!.skipped, true)
  assert.ok(listCourseTasks(s, { status: 'pending' }).every(e => !e.skipped))
  const restored = apply(s, configureCourseTaskRulesActions(s, 'c', { ...s.eventChains[0].taskRules, skipHolidays: false }))
  assert.deepEqual(listCourseTasks(restored).filter(e => e.kind === '实验课').map(e => e.sequence), [1, 2, 3, 4, 5, 6])
  assert.equal(s.events.length, restored.events.length)
})
test('holiday rules honor manual exceptions, warn for unknown years, and never auto-skip exams', () => {
  let s = initial()
  for (const [name, kind, startTime, endTime] of [['国庆考试', '考试', '2026-10-01T09:00:00+08:00', '2026-10-01T11:00:00+08:00'], ['国庆作业', '作业', undefined, '2026-10-01T23:59:00+08:00'], ['补班作业', '作业', undefined, '2026-10-10T23:59:00+08:00'], ['未来作业', '作业', undefined, '2027-10-01T23:59:00+08:00']] as const) s = apply(s, createCourseTaskActions(s, { courseId: 'c', name, kind, startTime, endTime }))
  s = apply(s, configureCourseTaskRulesActions(s, 'c', { skipHolidays: true }))
  const rows = listCourseTasks(s)
  assert.equal(rows.find(e => e.name === '国庆考试')!.skipped, false)
  assert.equal(rows.find(e => e.name === '国庆作业')!.skipped, true)
  assert.equal(rows.find(e => e.name === '补班作业')!.skipped, false)
  assert.ok(rows[0].scheduleWarnings.some(w => w.includes('2027')))
  const override = apply(s, configureCourseTaskRulesActions(s, 'c', { skipHolidays: true, keepDates: ['2026-10-01'], extraSkipDates: ['2026-10-10'] }))
  assert.equal(listCourseTasks(override).find(e => e.name === '国庆作业')!.skipped, false)
  assert.equal(listCourseTasks(override).find(e => e.name === '补班作业')!.skipped, true)
})
test('row category changes preserve completion and times and restore lab subtypes', () => {
  let s = apply(initial(), createWeeklyTaskActions(initial(), [lab, { ...lab, kind: '实验报告', startTime: undefined }], { count: 1, intervalWeeks: 1 }))
  const original = structuredClone(s)
  s = apply(s, setCourseRowCategoryActions(s, 'c', '作业', new Date('2026-09-09T00:00:00Z')))
  assert.ok(s.events.every(e => e.properties.taskKind === '作业'))
  assert.ok(s.events.every(e => s.eventTypes.find(t => t.id === e.typeId)?.category === 'homework'))
  assert.deepEqual(s.events.map(e => e.startTime), original.events.map(e => e.startTime))
  assert.equal(s.events[0].properties.completed, 'true')
  s = apply(s, setCourseRowCategoryActions(s, 'c', '实验'))
  assert.deepEqual(s.events.map(e => e.properties.taskKind), ['实验课', '实验报告'])
  assert.equal(s.events[0].properties.completed, 'true')
})
test('invalid anchors and recurrence bounds are rejected without mutation', () => {
  const s = apply(initial(), createWeeklyTaskActions(initial(), [lab], { count: 5, intervalWeeks: 1 }))
  assert.throws(() => configureCourseTaskRulesActions(s, 'c', { labAnchor: { eventId: s.events[3].id, number: 1 } }), /至少/)
  assert.throws(() => configureCourseTaskRulesActions(s, 'c', { labAnchor: { eventId: 'missing', number: 3 } }), /基准/)
  assert.throws(() => configureCourseTaskRulesActions(s, 'c', { extraSkipDates: ['2026-02-30'] }))
  assert.throws(() => createWeeklyTaskActions(s, [lab], { count: 53, intervalWeeks: 1 }))
  assert.equal(s.eventChains[0].taskRules, undefined)
  assert.equal(buildCourseTaskSchedule(s.events, s.eventTypes, s.eventChains).entries.size, 5)
})
test('old archives gain homework type and type-only homework/exam events appear in the shared list', () => {
  let s = initial()
  s = apply(s, createCourseTaskActions(s, { courseId: 'c', name: '作业', kind: '作业', endTime: '2026-09-21T23:59:00+08:00' }))
  delete s.events[0].properties.taskKind
  assert.equal(listCourseTasks(s)[0].kind, '作业')
  s = apply(s, createCourseTaskActions(s, { courseId: 'c', name: '考试', kind: '考试', startTime: '2026-09-22T09:00:00+08:00', endTime: '2026-09-22T11:00:00+08:00' }))
  delete s.events[1].properties.taskKind
  assert.equal(listCourseTasks(s)[1].kind, '考试')
  assert.equal(s.events[1].reminders.length, 2)
})

test('task detail edits can move to another course without moving siblings or losing metadata', () => {
  let s = apply(initial(), createWeeklyTaskActions(initial(), [lab, { ...lab, kind: '实验报告', startTime: undefined }], { count: 1, intervalWeeks: 1 }))
  s.eventChains.push({ ...s.eventChains[0], id: 'other', name: '其他课程' })
  const task = s.events[1]
  assert.throws(() => updateCourseTaskActions(s, task.id, { courseId: 'missing' }), /事件链不存在/)
  const moved = apply(s, updateCourseTaskActions(s, task.id, { courseId: 'other' }))
  assert.equal(moved.events[0].chainId, 'c')
  assert.equal(moved.events[1].chainId, 'other')
  assert.deepEqual(moved.events[1].properties, task.properties)
  assert.equal(moved.events[1].endTime, task.endTime)
})
