import * as XLSX from 'xlsx'
import { Action, Snapshot } from '../integrations/contracts'

export interface AssignmentRow { course: string; name: string; deadline: string; kind: string; link: string; submission: string; content: string; notes: string }
const aliases: Record<keyof AssignmentRow, string[]> = {
  course: ['课程', '课程名称', 'course'], name: ['名称', '作业名称', '实验名称', '任务', 'name'], deadline: ['截止日期', '截止时间', '验收截止日期', 'deadline'],
  kind: ['类别', '类型', 'kind'], link: ['提交链接', '链接', 'url', 'link'], submission: ['提交方式', 'submission'], content: ['内容', '作业内容', '实验内容', 'content'], notes: ['备注', 'notes'],
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
      const deadlineCell = indices.deadline >= 0 ? sheet[XLSX.utils.encode_cell({ r: range.s.r + index + 1, c: range.s.c + indices.deadline })] : undefined
      if (deadlineCell?.t === 'n') {
        const d = XLSX.SSF.parse_date_code(deadlineCell.v, { date1904: !!workbook.Workbook?.WBProps?.date1904 })
        if (d) item.deadline = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}T${String(d.H).padStart(2, '0')}:${String(d.M).padStart(2, '0')}`
      } else if (deadlineCell?.v instanceof Date) item.deadline = localDateTime(deadlineCell.v)
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
  for (const row of rows) {
    const key = `${row.course}\u0000${row.name}`
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
    const existing = snapshot.events.filter(e => e.chainId === chain.id && e.name === row.name && e.properties.taskKind)
    if (existing.length > 1) throw new Error(`同一课程有多个同名任务：${row.name}`)
    const previous = existing[0]
    const deadline = row.deadline ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(row.deadline) ? `${row.deadline}T23:59` : row.deadline) : previous ? new Date(previous.endTime) : null
    if (!deadline || !Number.isFinite(+deadline)) throw new Error(`${row.name}：新增任务必须填写有效截止时间`)
    const localParts = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(row.deadline)
    if (localParts && (deadline.getFullYear() !== +localParts[1] || deadline.getMonth() + 1 !== +localParts[2] || deadline.getDate() !== +localParts[3])) throw new Error(`${row.name}：截止日期不存在`)
    const props: Record<string, string | undefined> = { ...previous?.properties, taskKind: row.kind || previous?.properties.taskKind || '作业' }
    for (const [field, value] of Object.entries({ submissionUrl: safeSubmissionLink(row.link), submissionMethod: row.submission, taskContent: row.content, notes: row.notes })) if (value) props[field] = value
    if (previous) actions.push({ op: 'update_event', id: previous.id, changes: { endTime: deadline.toISOString(), startTime: new Date(+deadline - 30 * 60000).toISOString(), properties: props } })
    else actions.push({ op: 'create_event', event: { name: row.name, chainId: chain.id, typeId: row.kind === '实验' ? snapshot.eventTypes.find(t => t.category === 'lab')?.id || chain.typeId : chain.typeId, startTime: new Date(+deadline - 30 * 60000).toISOString(), endTime: deadline.toISOString(), properties: props, isHighlight: true, priority: 1, pinned: true, reminders: chain.defaultReminders } })
  }
  return actions
}
