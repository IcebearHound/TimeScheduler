import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { ArchiveBridge } from '../server/bridge'
import { registerCourseTaskTools } from '../server/courseTaskTools'
import { Snapshot, projectActions } from '../src/integrations/contracts'
import { createCourseTaskActions, createLabActions, listCourseTasks, setCourseTaskStatusActions, updateCourseTaskActions, setCourseTypeCategoryActions, setCourseTaskRowTypeActions } from '../src/integrations/courseTasks'
import { detectTaskNumbers } from '../src/utils/taskNumberDetection'
import { createWeeklyTaskActions } from '../src/utils/weeklyTasks'
import { courseTaskKind } from '../src/utils/courseTasks'
import { assignmentActions, readAssignmentWorkbook } from '../src/utils/assignmentTable'

const stamp = '2026-09-17T00:00:00Z'
const now = new Date('2026-09-17T12:00:00+08:00')
const fixture = (): Snapshot => ({ version: 1, semesterStartDate: stamp,
  events: [], eventChains: [{ id: 'course', name: '电路原理', typeId: 'course-type', color: '#123456', defaultReminders: [], createdAt: stamp, updatedAt: stamp }],
  eventTypes: [{ id: 'course-type', name: '课程', emoji: '📚', category: 'course', color: '#123456' }, { id: 'lab-type', name: '实验', emoji: '🧪', category: 'lab', color: '#123456' }],
  groups: [], groupOrder: [], activeGroupId: '',
})
const lab = { courseId: 'course', name: '实验三', startTime: '2026-09-17T14:00:00+08:00', endTime: '2026-09-17T16:00:00+08:00', acceptanceDeadline: '2026-09-24T14:00:00+08:00', reportDeadline: '2026-09-26T23:59:00+08:00' }
const project = (s: Snapshot, actions: Parameters<typeof projectActions>[1]) => projectActions(s, actions, () => crypto.randomUUID())

test('four course milestones share grouping but acceptance/report completion stays independent', () => {
  const original = fixture(), s = project(original, createLabActions(original, lab))
  assert.equal(original.events.length, 0)
  assert.equal(s.events.length, 3)
  assert.equal(new Set(s.events.map(e => e.properties.labGroupId)).size, 1)
  const acceptance = s.events.find(e => e.properties.taskKind === '实验验收')!, report = s.events.find(e => e.properties.taskKind === '实验报告')!
  const accepted = project(s, setCourseTaskStatusActions(s, acceptance.id, true, now))
  assert.equal(accepted.events.find(e => e.id === report.id)!.properties.completed, 'false')
  assert.equal(accepted.events.find(e => e.id === acceptance.id)!.properties.completedAt, now.toISOString())
  assert.equal(listCourseTasks(accepted, { status: 'completed' }, now)[0].status, '已验收')
  const reopened = project(accepted, setCourseTaskStatusActions(accepted, acceptance.id, false, now))
  assert.equal(reopened.events.find(e => e.id === acceptance.id)!.properties.completedAt, '')
  const checkedClass = project(s, setCourseTaskStatusActions(s, s.events[0].id, true, now))
  assert.equal(listCourseTasks(checkedClass, { kind: '实验课' }, now)[0].status, '已完成')
})

test('global chronology uses actual class start or deadline across courses, pins, history and future', () => {
  let s = fixture()
  s = project(s, createLabActions(s, lab))
  s = project(s, createCourseTaskActions(s, { courseId: 'course', kind: '作业', name: '逾期作业', endTime: '2026-09-16T23:59:00+08:00' }))
  s = project(s, createCourseTaskActions(s, { courseId: 'course', kind: '作业', name: '远期作业', endTime: '2027-01-01T23:59:00+08:00' }))
  s.events.at(-1)!.pinned = true; s.events.at(-1)!.todoOrder = -100
  const rows = listCourseTasks(s, {}, now)
  assert.deepEqual(rows.map(e => e.kind), ['作业', '实验课', '实验验收', '实验报告', '作业'])
  assert.equal(rows[1].when, new Date(lab.startTime).toISOString())
  assert.equal(rows[0].status, '已逾期')
  assert.equal(listCourseTasks(s, { status: 'overdue' }, now).length, 1)
  assert.equal(listCourseTasks(s, { kind: '实验课' }, new Date('2026-09-18T00:00:00Z'))[0].status, '已结束')
  assert.deepEqual(listCourseTasks(s, { from: rows[2].when, to: rows[2].when }, now).map(e => e.id), [rows[2].id])
  assert.throws(() => listCourseTasks(s, { from: '2027-01-01T00:00:00Z', to: stamp }), /起始时间/)
})

test('event-type rows query and change all matching chains without affecting other types', () => {
  let s = fixture()
  s.eventChains.push({ ...s.eventChains[0], id: 'second', name: '另一门课程' })
  s.eventTypes.push({ ...s.eventTypes[1], id: 'other-lab' }) // Same name, different type ID.
  s = project(s, createLabActions(s, lab))
  s = project(s, createLabActions(s, { ...lab, courseId: 'second' }))
  s = project(s, createCourseTaskActions(s, { courseId: 'course', name: '同链作业', kind: '作业', endTime: lab.reportDeadline }))
  s.events.push({ ...s.events[0], id: 'other-type', typeId: 'other-lab', properties: { taskKind: '实验课', notes: '保留' } })
  s.events.push({ ...s.events[0], id: 'lecture', typeId: 'course-type', properties: {} })
  const matching = listCourseTasks(s, { typeId: 'lab-type' }, now)
  assert.equal(matching.length, 6)
  assert.equal(new Set(matching.map(e => e.courseId)).size, 2)
  assert.ok(matching.every(e => e.typeId === 'lab-type' && e.typeName === '实验'))
  assert.equal(listCourseTasks(s, { typeId: 'lab-type', courseId: 'second' }, now).length, 3)
  const changed = project(s, setCourseTypeCategoryActions(s, 'lab-type', '作业', now))
  for (const before of s.events) {
    const after = changed.events.find(e => e.id === before.id)!
    if (before.typeId !== 'lab-type') assert.deepEqual(after, before)
    else {
      assert.equal(after.properties.taskKind, '作业')
      assert.equal(after.chainId, before.chainId)
      assert.equal(after.startTime, before.startTime)
      assert.equal(after.endTime, before.endTime)
    }
  }
  assert.equal(listCourseTasks(changed, { typeId: 'lab-type' }, now).length, 0)
  assert.equal(listCourseTasks(changed, { typeId: changed.events[0].typeId }, now).length, 7)
  assert.deepEqual(setCourseTypeCategoryActions(s, 'course-type', '作业'), [], 'Normal lectures must be excluded')
  assert.throws(() => setCourseTypeCategoryActions(s, 'missing', '作业'), /事件类型不存在/)
  const rowChanged = project(s, setCourseTaskRowTypeActions(s, 'second', 'lab-type', 'other-lab', now))
  for (const before of s.events) {
    const after = rowChanged.events.find(e => e.id === before.id)!
    if (before.chainId !== 'second' || before.typeId !== 'lab-type') assert.deepEqual(after, before)
    else { assert.equal(after.typeId, 'other-lab'); assert.deepEqual(after.properties, before.properties) }
  }
})

test('new recurring tasks anchor at zero with stable IDs and continue numbering across weeks', () => {
  const initial = fixture()
  const actions = createWeeklyTaskActions(initial, [
    { courseId: 'course', name: '带编号实验', kind: '实验课', startTime: lab.startTime, endTime: lab.endTime, labGroupId: 'group', number: 0 },
    { courseId: 'course', name: '带编号实验', kind: '实验报告', endTime: lab.reportDeadline, labGroupId: 'group' },
  ], { count: 3, intervalWeeks: 1 })
  const preview = project(initial, actions), applied = project(initial, actions)
  assert.equal(preview.eventChains[0].taskRules?.labAnchor?.eventId, applied.eventChains[0].taskRules?.labAnchor?.eventId)
  const rows = listCourseTasks(applied)
  assert.deepEqual(rows.filter(e => e.kind === '实验课').map(e => e.sequence), [0, 1, 2])
  assert.deepEqual(rows.filter(e => e.kind === '实验报告').map(e => e.sequence), [0, 1, 2])
  assert.throws(() => project(applied, actions), /ID 已存在/)
})

test('table numbering is suggested conservatively and only applied after confirmation', () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['课程', '名称', '截止日期', '编号'],
    ['电路原理', '第零次作业', '2026-09-20', ''],
    ['电路原理', '作业一', '2026-09-21', ''],
    ['电路原理', '实验（二十三）', '2026-09-22', ''],
    ['电路原理', '2026-09-23练习', '2026-09-23', ''],
    ['电路原理', '作业2026-09-24', '2026-09-24', ''],
    ['电路原理', '未命名练习', '2026-09-25', 0],
    ['电路原理', '第3次作业', '2026-09-26', 5],
  ])
  const rows = readAssignmentWorkbook({ SheetNames: ['任务'], Sheets: { 任务: sheet } })
  assert.deepEqual(detectTaskNumbers(rows).map(s => [s.row, s.number]), [[0, 0], [1, 1], [2, 23], [5, 0], [6, 5]])
  const initial = fixture(), subset = rows.slice(0, 2)
  assert.ok(assignmentActions(initial, subset).every(a => a.op !== 'set_course_task_rules'), 'Detection alone must not assign numbers')
  const confirmed = subset.map((row, i) => ({ ...row, confirmedNumber: i }))
  const actions = assignmentActions(initial, confirmed), applied = project(initial, actions)
  assert.deepEqual(listCourseTasks(applied).map(t => t.sequence), [0, 1])
  assert.deepEqual(listCourseTasks(project(applied, assignmentActions(applied, confirmed))).map(t => t.sequence), [0, 1], 'Reimport updates existing tasks without duplicating them')
  assert.throws(() => assignmentActions(initial, [{ ...confirmed[0] }, { ...confirmed[1], confirmedNumber: 5 }]), /不一致/)
  assert.equal(initial.events.length, 0)
})

test('legacy bare labs and legacy deadlines remain distinct; homework works with a course type', () => {
  const s = project(fixture(), createLabActions(fixture(), lab))
  delete s.events[0].properties.taskKind
  s.events[1].properties.taskKind = '实验'
  assert.equal(courseTaskKind(s.events[0], s.eventTypes), '实验课')
  assert.equal(courseTaskKind(s.events[1], s.eventTypes), '实验验收')
  const originalDuration = +new Date(s.events[0].endTime) - +new Date(s.events[0].startTime)
  const edited = project(s, updateCourseTaskActions(s, s.events[0].id, { notes: '仍是实验课' }))
  assert.equal(edited.events[0].properties.taskKind, undefined)
  assert.equal(+new Date(edited.events[0].endTime) - +new Date(edited.events[0].startTime), originalDuration)
})

test('next acceptance uses the next scheduled lab, including a skipped week, and attaches without duplication', () => {
  let s = fixture()
  s = project(s, createCourseTaskActions(s, { courseId: 'course', kind: '实验课', name: '下次实验', startTime: '2026-10-01T14:00:00+08:00', endTime: '2026-10-01T16:00:00+08:00' }))
  s = project(s, createCourseTaskActions(s, { courseId: 'course', kind: '实验课', name: lab.name, startTime: lab.startTime, endTime: lab.endTime }))
  const current = s.events[1]
  const result = project(s, createLabActions(s, { courseId: 'course', name: lab.name, existingClassId: current.id, acceptanceAtNextClass: true, reportDeadline: lab.reportDeadline }))
  assert.equal(result.events.length, 4)
  assert.equal(result.events[2].endTime, s.events[0].startTime)
  assert.equal(result.events[1].startTime, current.startTime)
  assert.equal(result.events[1].properties.labGroupId, result.events[2].properties.labGroupId)
  assert.throws(() => createLabActions(result, { courseId: 'course', name: lab.name, existingClassId: current.id, reportDeadline: lab.reportDeadline }), /已存在/)
  assert.throws(() => createLabActions(fixture(), { courseId: 'course', name: lab.name, startTime: lab.startTime, endTime: lab.endTime, acceptanceAtNextClass: true }), /没有找到/)
})

test('task writes validate times, safe URLs, exact IDs and preserve unrelated details', () => {
  const s = project(fixture(), createLabActions(fixture(), lab)), report = s.events[2]
  report.properties.notes = 'keep'; report.properties.completed = 'true'
  const edited = project(s, updateCourseTaskActions(s, report.id, { endTime: '2026-09-28T23:59:00+08:00', submissionUrl: 'https://example.com/report' }))
  assert.equal(edited.events[2].properties.notes, 'keep')
  assert.equal(edited.events[2].properties.completed, 'true')
  assert.equal(+new Date(edited.events[2].endTime) - +new Date(edited.events[2].startTime), 30 * 60000)
  assert.throws(() => updateCourseTaskActions(s, report.id, { submissionUrl: 'javascript:alert(1)' }), /HTTP/)
  assert.throws(() => updateCourseTaskActions(s, 'missing', { notes: 'x' }), /不存在/)
  assert.throws(() => updateCourseTaskActions(s, report.id, { startTime: stamp }), /endTime/)
  assert.throws(() => createCourseTaskActions(s, { courseId: 'course', name: 'x', kind: '实验课', endTime: stamp }), /开始时间/)
  assert.throws(() => createLabActions(s, { ...lab, endTime: lab.startTime }), /结束时间/)
})

test('spreadsheet upserts distinguish same-name milestones and reject ambiguous link-only edits', () => {
  const row = { course: '电路原理', name: '实验三', deadline: lab.acceptanceDeadline, kind: '实验验收', link: '', submission: '', content: '', notes: '' }
  const s = project(fixture(), assignmentActions(fixture(), [row, { ...row, kind: '实验报告', deadline: lab.reportDeadline }]))
  assert.equal(s.events.length, 2)
  const changed = project(s, assignmentActions(s, [{ ...row, kind: '实验报告', deadline: '', link: 'https://example.com/report' }]))
  assert.equal(changed.events[0].properties.submissionUrl, undefined)
  assert.equal(changed.events[1].properties.submissionUrl, 'https://example.com/report')
  assert.throws(() => assignmentActions(s, [{ ...row, kind: '', deadline: '' }]), /多个同名/)
})

test('spreadsheet lab classes read both numeric Excel time columns and keep actual duration', () => {
  const sheet = XLSX.utils.aoa_to_sheet([['课程', '名称', '类别', '开始时间', '截止日期', '实验关联编号'], ['电路原理', '实验三', '实验课', 45000.5, 45000.75, 'lab-3']])
  const rows = readAssignmentWorkbook({ SheetNames: ['实验'], Sheets: { 实验: sheet } })
  const s = project(fixture(), assignmentActions(fixture(), rows))
  assert.equal(+new Date(s.events[0].endTime) - +new Date(s.events[0].startTime), 6 * 3600000)
  assert.equal(s.events[0].properties.labGroupId, 'lab-3')
})

test('MCP course tools expose schemas and require fresh revision plus browser acknowledgement', async () => {
  const bridge = new ArchiveBridge(), server = new McpServer({ name: 'test', version: '1' }), client = new Client({ name: 'test-client', version: '1' })
  registerCourseTaskTools(server, bridge)
  const [a, b] = InMemoryTransport.createLinkedPair()
  await server.connect(a); await client.connect(b)
  const read = async () => {
    const result = await client.callTool({ name: 'list_course_tasks', arguments: {} })
    assert.ok(!result.isError)
    return JSON.parse((result.content as { text: string }[])[0].text)
  }
  try {
    assert.equal((await client.listTools()).tools.length, 9)
    assert.equal((await client.callTool({ name: 'list_course_tasks', arguments: {} })).isError, true)
    let snapshot = fixture()
    await bridge.heartbeat('browser', snapshot)
    const initial = await read()
    assert.ok(initial.types.some((t: { id: string }) => t.id === 'lab-type'))
    assert.equal((await client.callTool({ name: 'set_course_row_category', arguments: { revision: initial.revision, typeId: 'lab-type', courseId: 'course', category: '作业' } })).isError, true, 'Ambiguous mutation scopes must be rejected')
    const pending = client.callTool({ name: 'create_lab', arguments: { revision: initial.revision, lab } })
    let command: Awaited<ReturnType<typeof bridge.heartbeat>>['command'] = null
    for (let n = 0; n < 50 && !command; n++) { await new Promise(r => setTimeout(r, 5)); command = (await bridge.heartbeat('browser', snapshot)).command }
    assert.ok(command)
    snapshot = project(snapshot, command.actions)
    await bridge.acknowledge('browser', command.id, { snapshot })
    assert.ok(!(await pending).isError)
    const current = await read()
    assert.equal(current.tasks.length, 3)
    const accepted = client.callTool({ name: 'set_course_task_status', arguments: { revision: current.revision, id: current.tasks[1].id, completed: true } })
    command = null
    for (let n = 0; n < 50 && !command; n++) { await new Promise(r => setTimeout(r, 5)); command = (await bridge.heartbeat('browser', snapshot)).command }
    assert.ok(command)
    snapshot = project(snapshot, command.actions)
    await bridge.acknowledge('browser', command.id, { snapshot })
    assert.ok(!(await accepted).isError)
    const updated = await read()
    assert.equal(updated.tasks[1].completed, true)
    assert.equal(updated.tasks[2].completed, false)
    const stale = await client.callTool({ name: 'set_course_task_status', arguments: { revision: initial.revision, id: current.tasks[1].id, completed: true } })
    assert.equal(stale.isError, true)
    const classStatus = await client.callTool({ name: 'set_course_task_status', arguments: { revision: updated.revision, id: 'missing', completed: true } })
    assert.equal(classStatus.isError, true)
    const invalidDate = await client.callTool({ name: 'update_course_task', arguments: { revision: updated.revision, id: current.tasks[1].id, changes: { endTime: '2026-10-01' } } })
    assert.equal(invalidDate.isError, true)
  } finally { bridge.disconnect(); await client.close(); await server.close() }
})
