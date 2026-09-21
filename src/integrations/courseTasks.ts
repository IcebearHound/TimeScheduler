import { z } from 'zod'
import { Action, Snapshot, taskRulesSchema, validateSnapshot } from './contracts'
import { buildCourseTaskSchedule } from '../utils/courseTaskSchedule'
import { completionProperties, courseTaskCategory, CourseTaskCategory, courseTaskCompleted, courseTaskKind, courseTaskKinds, courseTaskStatus, courseTaskTime, nextLabClass, sortedCourseTasks } from '../utils/courseTasks'

const id = z.string().min(1).max(200)
const date = z.string().datetime({ offset: true })
const details = {
  submissionUrl: z.string().max(2000).optional(), submissionMethod: z.string().max(2000).optional(),
  taskContent: z.string().max(20000).optional(), notes: z.string().max(20000).optional(),
}
export const courseTaskInputSchema = z.object({
  courseId: id, name: z.string().trim().min(1).max(500), kind: z.enum(courseTaskKinds),
  startTime: date.optional(), endTime: date,
  labGroupId: id.optional(), ...details,
}).strict()
export const labInputSchema = z.object({
  courseId: id, name: z.string().trim().min(1).max(500),
  existingClassId: id.optional(), startTime: date.optional(), endTime: date.optional(),
  acceptanceDeadline: date.optional(), acceptanceAtNextClass: z.boolean().optional(), reportDeadline: date.optional(),
  ...details,
}).strict()
export const courseTaskChangesSchema = z.object({
  name: z.string().trim().min(1).max(500).optional(), courseId: id.optional(), startTime: date.optional(), endTime: date.optional(), ...details,
}).strict().refine(v => Object.keys(v).length > 0, '至少提供一个修改字段')
export const courseTaskQuerySchema = z.object({
  courseId: id.optional(), kind: z.enum(courseTaskKinds).optional(),
  status: z.enum(['all', 'pending', 'completed', 'overdue']).default('all'),
  from: date.optional(), to: date.optional(),
}).strict()
export type CourseTaskInput = z.infer<typeof courseTaskInputSchema>
export type LabInput = z.infer<typeof labInputSchema>

function taskProperties(input: Record<string, unknown>): Record<string, string> {
  const props: Record<string, string> = {}
  for (const field of Object.keys(details)) if (typeof input[field] === 'string') props[field] = input[field] as string
  if (props.submissionUrl) {
    const url = new URL(props.submissionUrl)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('提交链接必须是 HTTP(S) 地址')
    props.submissionUrl = url.href
  }
  return props
}
function requireTask(snapshot: Snapshot, eventId: string) {
  const event = snapshot.events.find(e => e.id === eventId)
  if (!event || !courseTaskKind(event, snapshot.eventTypes)) throw new Error('课程任务不存在')
  return event
}
export function createCourseTaskActions(snapshot: Snapshot, raw: CourseTaskInput): Action[] {
  snapshot = validateSnapshot(snapshot)
  const input = courseTaskInputSchema.parse(raw)
  const chain = snapshot.eventChains.find(c => c.id === input.courseId)
  if (!chain) throw new Error('课程事件链不存在，请先创建课程链')
  const scheduled = input.kind === '实验课' || input.kind === '考试'
  if (scheduled && !input.startTime) throw new Error('实验课或考试必须填写开始时间')
  const startTime = scheduled ? input.startTime! : new Date(+new Date(input.endTime) - 30 * 60000).toISOString()
  if (+new Date(startTime) >= +new Date(input.endTime)) throw new Error('结束时间必须晚于开始时间')
  if (input.labGroupId && snapshot.events.some(e => e.chainId === input.courseId && e.properties.labGroupId === input.labGroupId && courseTaskKind(e, snapshot.eventTypes) === input.kind)) throw new Error('同一次实验已存在此类事项，请修改已有事项')
  return [{ op: 'create_event', event: {
    name: input.name, chainId: chain.id,
    typeId: snapshot.eventTypes.find(t => t.category === (input.kind === '作业' ? 'homework' : input.kind === '考试' ? 'exam' : 'lab'))!.id,
    startTime, endTime: input.endTime, reminders: input.kind === '考试' && !chain.defaultReminders.length ? [{ id: crypto.randomUUID(), time: '1d', enabled: true, notified: false }, { id: crypto.randomUUID(), time: '2h', enabled: true, notified: false }] : chain.defaultReminders,
    properties: { ...taskProperties(input), taskKind: input.kind, completed: 'false', ...(input.labGroupId ? { labGroupId: input.labGroupId } : {}) },
    isHighlight: input.kind === '考试', pinned: false, priority: input.kind === '考试' ? 3 : 1,
  } }]
}

/** One undoable transaction; existing scheduled classes can acquire deadlines without duplication. */
export function createLabActions(snapshot: Snapshot, raw: LabInput, newId: () => string = () => crypto.randomUUID()): Action[] {
  const input = labInputSchema.parse(raw)
  if (input.acceptanceDeadline && input.acceptanceAtNextClass) throw new Error('指定截止时间与下次实验课只能选择一种')
  const existing = input.existingClassId ? requireTask(snapshot, input.existingClassId) : undefined
  if (existing && (existing.chainId !== input.courseId || courseTaskKind(existing, snapshot.eventTypes) !== '实验课')) throw new Error('关联实验课必须属于同一课程')
  const startTime = existing?.startTime || input.startTime, endTime = existing?.endTime || input.endTime
  if (!startTime || !endTime) throw new Error('请填写实验课开始、结束时间，或选择已有实验课')
  const group = existing?.properties.labGroupId || newId()
  const actions: Action[] = existing
    ? [{ op: 'update_event', id: existing.id, changes: { properties: { ...existing.properties, labGroupId: group } } }]
    : createCourseTaskActions(snapshot, { ...taskProperties(input), courseId: input.courseId, name: input.name, kind: '实验课', startTime, endTime, labGroupId: group })
  let acceptance = input.acceptanceDeadline
  if (input.acceptanceAtNextClass) {
    const next = nextLabClass(snapshot.events, snapshot.eventTypes, input.courseId, new Date(startTime), existing?.id)
    if (!next) throw new Error('没有找到下次实验课，请指定验收截止时间')
    acceptance = next.startTime
  }
  for (const [kind, deadline] of [['实验验收', acceptance], ['实验报告', input.reportDeadline]] as const) {
    if (deadline) actions.push(...createCourseTaskActions(snapshot, { ...taskProperties(input), courseId: input.courseId, name: input.name, kind, endTime: deadline, labGroupId: group }))
  }
  return actions
}
export function updateCourseTaskActions(snapshot: Snapshot, eventId: string, raw: z.infer<typeof courseTaskChangesSchema>): Action[] {
  const event = requireTask(snapshot, eventId), changes = courseTaskChangesSchema.parse(raw)
  if (changes.courseId && !snapshot.eventChains.some(c => c.id === changes.courseId)) throw new Error('课程事件链不存在')
  const kind = courseTaskKind(event, snapshot.eventTypes)!
  if (!['实验课', '考试'].includes(kind) && changes.startTime) throw new Error('截止事项请修改 endTime；开始时间由截止时间计算')
  const endTime = changes.endTime || event.endTime
  const startTime = ['实验课', '考试'].includes(kind) ? changes.startTime || event.startTime : new Date(+new Date(endTime) - 30 * 60000).toISOString()
  if (+new Date(startTime) >= +new Date(endTime)) throw new Error('结束时间必须晚于开始时间')
  return [{ op: 'update_event', id: eventId, changes: { ...(changes.name ? { name: changes.name } : {}), ...(changes.courseId ? { chainId: changes.courseId } : {}), startTime, endTime, properties: { ...event.properties, ...taskProperties(changes) } } }]
}
export function setCourseTaskStatusActions(snapshot: Snapshot, eventId: string, completed: boolean, now = new Date()): Action[] {
  const event = requireTask(snapshot, eventId)
  return [{ op: 'update_event', id: eventId, changes: { properties: completionProperties(event, completed, now, ['实验课', '考试'].includes(courseTaskKind(event, snapshot.eventTypes)!)) } }]
}
/** Changes only the row's course tasks, preserving times, details and effective completion. */
export function setCourseRowCategoryActions(snapshot: Snapshot, courseId: string, category: CourseTaskCategory, now = new Date()): Action[] {
  z.enum(['作业', '实验', '考试']).parse(category)
  if (!snapshot.eventChains.some(c => c.id === courseId)) throw new Error('课程事件链不存在')
  const tasks = snapshot.events.filter(e => e.chainId === courseId && courseTaskKind(e, snapshot.eventTypes))
  const actions: Action[] = []
  for (const event of tasks) {
    const kind = courseTaskKind(event, snapshot.eventTypes)!
    if (courseTaskCategory(kind) === category) continue
    const previous = event.properties.labKindBeforeCategoryChange
    const nextKind = category === '作业' || category === '考试' ? category : previous && !['作业', '考试'].includes(previous) && courseTaskKinds.includes(previous as typeof courseTaskKinds[number]) ? previous : '实验验收'
    const taskTypes = validateSnapshot(snapshot).eventTypes
    actions.push({ op: 'update_event', id: event.id, changes: { typeId: taskTypes.find(t => t.category === (category === '作业' ? 'homework' : category === '考试' ? 'exam' : 'lab'))!.id, properties: {
      ...event.properties, taskKind: nextKind,
      ...(courseTaskCategory(kind) === '实验' ? { labKindBeforeCategoryChange: kind } : {}),
      completed: String(courseTaskCompleted(event, kind, now)),
      ...(['实验课', '考试'].includes(nextKind) ? { classCompletionOverride: 'true' } : {}),
    } } })
  }
  if (actions.length > 200) throw new Error('该行超过 200 项待修改任务，请分批通过 MCP 修改')
  return actions
}
export function configureCourseTaskRulesActions(snapshot: Snapshot, courseId: string, raw: z.infer<typeof taskRulesSchema>): Action[] {
  const rules = taskRulesSchema.parse(raw), chain = snapshot.eventChains.find(c => c.id === courseId)
  if (!chain) throw new Error('课程事件链不存在')
  for (const [category, anchor] of [['作业', rules.homeworkAnchor], ['实验', rules.labAnchor], ['考试', rules.examAnchor]] as const) {
    if (!anchor) continue
    const event = snapshot.events.find(e => e.id === anchor.eventId && e.chainId === courseId)
    const kind = event && courseTaskKind(event, snapshot.eventTypes)
    if (!kind || courseTaskCategory(kind) !== category) throw new Error(`${category}编号基准必须属于该行的对应类型`)
  }
  const schedule = buildCourseTaskSchedule(snapshot.events, snapshot.eventTypes, [{ ...chain, taskRules: rules }])
  const invalid = schedule.warnings.get(courseId)?.filter(w => !w.includes('未内置'))
  if (invalid?.length) throw new Error(invalid.join('；'))
  return [{ op: 'set_course_task_rules', id: courseId, rules }]
}
export function listCourseTasks(snapshot: Snapshot, raw: z.input<typeof courseTaskQuerySchema> = {}, now = new Date()) {
  const query = courseTaskQuerySchema.parse(raw)
  if (query.from && query.to && +new Date(query.from) > +new Date(query.to)) throw new Error('起始时间不能晚于结束时间')
  const schedule = buildCourseTaskSchedule(snapshot.events, snapshot.eventTypes, snapshot.eventChains)
  return sortedCourseTasks(snapshot.events, snapshot.eventTypes).map(e => {
    const kind = courseTaskKind(e, snapshot.eventTypes)!, when = courseTaskTime(e, kind)
    const entry = schedule.entries.get(e.id), status = entry?.skipped ? '已跳过' : courseTaskStatus(e, kind, now), completed = courseTaskCompleted(e, kind, now)
    return { id: e.id, courseId: e.chainId, courseName: snapshot.eventChains.find(c => c.id === e.chainId)?.name || '', name: e.name, kind, when: when.toISOString(), startTime: e.startTime, endTime: e.endTime, status, completed, sequence: entry?.sequence ?? null, skipped: entry?.skipped ?? false, skipReason: entry?.reason ?? null, scheduleWarnings: schedule.warnings.get(e.chainId) || [], labGroupId: e.properties.labGroupId || null, completedAt: e.properties.completedAt || null, submissionUrl: e.properties.submissionUrl || '', submissionMethod: e.properties.submissionMethod || '', taskContent: e.properties.taskContent || '', notes: e.properties.notes || '' }
  }).filter(e => (!query.courseId || e.courseId === query.courseId) && (!query.kind || e.kind === query.kind) &&
    (!query.from || +new Date(e.when) >= +new Date(query.from)) && (!query.to || +new Date(e.when) <= +new Date(query.to)) &&
    (query.status === 'all' || !e.skipped && (query.status === 'overdue' ? e.status === '已逾期' : e.completed === (query.status === 'completed'))))
}
