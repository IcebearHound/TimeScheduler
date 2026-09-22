import * as XLSX from 'xlsx'
import { Action, Snapshot, projectActions } from '../integrations/contracts'
import { courseTaskCategory, courseTaskKind, courseTaskKinds } from './courseTasks'
import { createCourseTaskActions, setCourseTaskNumberActions, updateCourseTaskActions } from '../integrations/courseTasks'
import { buildCourseTaskSchedule } from './courseTaskSchedule'

export interface AssignmentRow { course: string; name: string; deadline: string; kind: string; link: string; submission: string; content: string; notes: string; startTime?: string; labGroupId?: string; numberText?: string; confirmedNumber?: number }
const aliases: Record<Exclude<keyof AssignmentRow, 'confirmedNumber'>, string[]> = {
  course: ['课程', '课程名称', 'course'], name: ['名称', '作业名称', '实验名称', '任务', 'name'], deadline: ['截止日期', '截止时间', '验收截止日期', 'deadline'],
  kind: ['类别', '类型', 'kind'], link: ['提交链接', '链接', 'url', 'link'], submission: ['提交方式', 'submission'], content: ['内容', '作业内容', '实验内容', 'content'], notes: ['备注', 'notes'],
  startTime: ['开始时间', '上课时间', 'starttime'], labGroupId: ['实验关联编号', 'labgroupid'],
  numberText: ['编号', '序号', '次数', '第几次', '实验次数', '作业次数', 'number', 'sequence'],
}
export function safeSubmissionLink(value: string): string {
  if (!value.trim()) return ''
  const url = new URL(value.trim())
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('提交链接必须是 HTTP(S) 地址')
  return url.href
}
export function readAssignmentWorkbook(workbook: XLSX.WorkBook): AssignmentRow[] {
  const result: AssignmentRow[] = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false })
    if (!data.length) continue
    const headers = data[0].map(x => String(x).trim().toLowerCase())
    const indices = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, headers.findIndex(h => names.includes(h))])) as Record<keyof AssignmentRow, number>
    if (indices.course < 0 || indices.name < 0) throw new Error(`${sheetName}：需要“课程”和“名称”表头`)
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
    data.slice(1).forEach((row, index) => {
      if (row.every(x => !String(x).trim())) return
      const item = Object.fromEntries(Object.keys(aliases).map(key => [key, String(row[indices[key as keyof AssignmentRow]] ?? '').trim()])) as unknown as AssignmentRow
      const linkCell = sheet[XLSX.utils.encode_cell({ r: range.s.r + index + 1, c: range.s.c + indices.link })]
      if (linkCell?.l?.Target) item.link = linkCell.l.Target
      for (const field of ['deadline', 'startTime'] as const) {
        const column = indices[field] ?? -1
        const cell = column >= 0 ? sheet[XLSX.utils.encode_cell({ r: range.s.r + index + 1, c: range.s.c + column })] : undefined
        if (cell?.t === 'n') {
          const d = XLSX.SSF.parse_date_code(cell.v, { date1904: !!workbook.Workbook?.WBProps?.date1904 })
          if (d) item[field] = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}T${String(d.H).padStart(2, '0')}:${String(d.M).padStart(2, '0')}`
        } else if (cell?.v instanceof Date) item[field] = localDateTime(cell.v)
      }
      if (!item.course || !item.name) throw new Error(`${sheetName} 第 ${index + 2} 行：课程和名称不能为空`)
      item.link = safeSubmissionLink(item.link)
      result.push(item)
    })
  }
  if (!result.length || result.length > 100) throw new Error('请导入 1–100 行任务')
  return result
}
export function localDateTime(date: Date) { return new Date(+date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

/** Reimporting the same course + task updates it, including link-only spreadsheets. */
export function assignmentActions(snapshot: Snapshot, rows: AssignmentRow[]): Action[] {
  const actions: Action[] = [], chains = [...snapshot.eventChains], seen = new Set<string>()
  const numbers: { id: string; number: number; name: string }[] = []
  for (const row of rows) {
    const normalizedKind = row.kind === '实验' ? '实验验收' : row.kind
    const key = `${row.course}\u0000${row.name}\u0000${normalizedKind}`
    if (seen.has(key)) throw new Error(`表格中任务重复：${row.course} / ${row.name}`)
    seen.add(key)
    const matches = chains.filter(c => c.name === row.course)
    if (matches.length > 1) throw new Error(`存在同名事件链，请先重命名：${row.course}`)
    let chain = matches[0]
    if (!chain) {
      const typeId = snapshot.eventTypes.find(t => t.category === 'course')?.id
      if (!typeId) throw new Error('请先创建课程事件类型')
      chain = { id: crypto.randomUUID(), name: row.course, typeId, color: '#6366f1', defaultReminders: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      chains.push(chain)
      actions.push({ op: 'create_chain', id: chain.id, chain: { name: chain.name, typeId, color: chain.color, defaultReminders: [] } })
    }
    const existing = snapshot.events.filter(e => e.chainId === chain.id && e.name === row.name && courseTaskKind(e, snapshot.eventTypes) && (!normalizedKind || courseTaskKind(e, snapshot.eventTypes) === normalizedKind))
    if (existing.length > 1) throw new Error(`同一课程有多个同名任务：${row.name}`)
    const previous = existing[0]
    const deadline = row.deadline ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(row.deadline) ? `${row.deadline}T23:59` : row.deadline) : previous ? new Date(previous.endTime) : null
    if (!deadline || !Number.isFinite(+deadline)) throw new Error(`${row.name}：新增任务必须填写有效截止时间`)
    const localParts = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(row.deadline)
    if (localParts && (deadline.getFullYear() !== +localParts[1] || deadline.getMonth() + 1 !== +localParts[2] || deadline.getDate() !== +localParts[3])) throw new Error(`${row.name}：截止日期不存在`)
    const kind = normalizedKind || (previous && courseTaskKind(previous, snapshot.eventTypes)) || '作业'
    if (!courseTaskKinds.includes(kind as typeof courseTaskKinds[number])) throw new Error(`${row.name}：类别应为实验课、实验验收、实验报告、作业或考试`)
    const detail = Object.fromEntries(Object.entries({ submissionUrl: safeSubmissionLink(row.link), submissionMethod: row.submission, taskContent: row.content, notes: row.notes }).filter(([, value]) => value))
    const startTime = row.startTime ? new Date(row.startTime).toISOString() : undefined
    let eventId = previous?.id
    if (previous) actions.push(...updateCourseTaskActions(snapshot, previous.id, { ...detail, endTime: deadline.toISOString(), ...(startTime ? { startTime } : {}) }))
    else {
      const created = createCourseTaskActions({ ...snapshot, eventChains: chains }, { ...detail, courseId: chain.id, name: row.name, kind: kind as typeof courseTaskKinds[number], endTime: deadline.toISOString(), ...(startTime ? { startTime } : {}), ...(row.labGroupId ? { labGroupId: row.labGroupId } : {}) })
      if (row.confirmedNumber !== undefined && created[0].op === 'create_event') { eventId = crypto.randomUUID(); created[0].id = eventId }
      actions.push(...created)
    }
    if (row.confirmedNumber !== undefined) numbers.push({ id: eventId!, number: row.confirmedNumber, name: row.name })
  }
  if (numbers.length) {
    let planned = projectActions(snapshot, actions, () => crypto.randomUUID())
    const anchored = new Set<string>()
    for (const item of numbers) {
      if (!Number.isInteger(item.number) || item.number < 0 || item.number > 100000) throw new Error(`${item.name}：编号须为 0–100000 的整数`)
      const event = planned.events.find(e => e.id === item.id)!
      const key = JSON.stringify([event.chainId, courseTaskCategory(courseTaskKind(event, planned.eventTypes)!)])
      if (anchored.has(key)) continue
      const changes = setCourseTaskNumberActions(planned, item.id, item.number)
      actions.push(...changes); planned = projectActions(planned, changes, () => crypto.randomUUID()); anchored.add(key)
    }
    const schedule = buildCourseTaskSchedule(planned.events, planned.eventTypes, planned.eventChains)
    for (const item of numbers) {
      const entry = schedule.entries.get(item.id)
      if (!entry?.skipped && entry?.sequence !== item.number) throw new Error(`${item.name}：编号 ${item.number} 与时间顺序或跳过规则不一致，请调整编号或取消勾选；同组实验请填写相同实验关联编号`)
    }
  }
  return actions
}
