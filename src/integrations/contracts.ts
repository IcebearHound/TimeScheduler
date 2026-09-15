import { z } from 'zod'

const text = z.string().max(20000)
const id = z.string().min(1).max(200)
const date = z.string().datetime({ offset: true })
const reminder = z.object({ id, time: z.enum(['1w', '3d', '1d', '6h', '2h', '30min', '10min', '5min', '2min', 'at-time']), enabled: z.boolean(), notified: z.boolean() })
const properties = z.record(z.string(), text.optional())
const eventFields = {
  name: z.string().trim().min(1).max(500), description: text.optional(), startTime: date, endTime: date,
  chainId: z.string().max(200), typeId: id, reminders: z.array(reminder).max(100), properties,
  isHighlight: z.boolean(), priority: z.number().finite(), color: z.string().max(100).optional(),
  pinned: z.boolean().optional(), todoOrder: z.number().finite().optional(),
}
export const eventInputSchema = z.object(eventFields).strict()
const batchRule = z.object({
  id, name: text, mode: z.enum(['create', 'modify']), weekPattern: z.enum(['every', 'odd', 'even']), daysOfWeek: z.array(z.number().int().min(0).max(6)),
  weekRange: z.object({ type: z.enum(['weekNumber', 'dateRange']), startWeek: z.number().optional(), endWeek: z.number().optional(), startDate: date.optional(), endDate: date.optional(), weekStartDate: date.optional() }),
  createTime: z.object({ startTime: text, endTime: text }).optional(), modifyFilter: z.object({ position: z.number() }).optional(),
  modifyUpdates: z.object({ name: text.optional(), description: text.optional(), startTimeOffset: z.number().optional(), endTimeOffset: z.number().optional() }).optional(),
})
const chainFields = { name: z.string().trim().min(1).max(500), description: text.optional(), typeId: id, color: z.string().max(100), defaultReminders: z.array(reminder), batchRules: z.array(batchRule).optional(), includeInTodo: z.boolean().optional() }
export const snapshotSchema = z.object({
  version: z.literal(1), semesterStartDate: date,
  events: z.array(z.object({ ...eventFields, id, createdAt: date, updatedAt: date })).max(100000),
  eventChains: z.array(z.object({ ...chainFields, id, createdAt: date, updatedAt: date })).max(20000),
  eventTypes: z.array(z.object({ id, name: text, emoji: text, category: z.enum(['course', 'exam', 'lab', 'custom']), parentId: id.optional(), color: text, propertyFields: z.array(z.object({ name: text, icon: text.optional() })).optional() })),
  groups: z.array(z.object({ id, name: text, emoji: text, eventChainIds: z.array(id), eventIds: z.array(id), description: text.optional(), includeInTodo: z.boolean().optional(), createdAt: date, updatedAt: date })),
  groupOrder: z.array(id), activeGroupId: z.string().max(200),
}).strict()
export type Snapshot = z.infer<typeof snapshotSchema>
export const actionSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('create_event'), event: eventInputSchema }).strict(),
  z.object({ op: z.literal('update_event'), id, changes: eventInputSchema.partial() }).strict(),
  z.object({ op: z.literal('delete_event'), id }).strict(),
  z.object({ op: z.literal('create_chain'), id, chain: z.object(chainFields).strict() }).strict(),
])
export const actionsSchema = z.array(actionSchema).min(1).max(200)
export type Action = z.infer<typeof actionSchema>

export function validateSnapshot(input: unknown): Snapshot {
  const s = snapshotSchema.parse(input)
  const unique = (items: { id: string }[]) => {
    const keys = new Set(items.map(x => x.id))
    if (keys.size !== items.length) throw new Error('存档包含重复 ID')
    return keys
  }
  const events = unique(s.events), chains = unique(s.eventChains), types = unique(s.eventTypes), groups = unique(s.groups)
  for (const e of s.events) {
    if (+new Date(e.endTime) <= +new Date(e.startTime)) throw new Error('事件结束时间必须晚于开始时间')
    if (!types.has(e.typeId) || (e.chainId && !chains.has(e.chainId))) throw new Error('事件引用了不存在的类型或事件链')
  }
  if (s.eventChains.some(c => !types.has(c.typeId))) throw new Error('事件链引用了不存在的类型')
  for (const g of s.groups) if (g.eventIds.some(x => !events.has(x)) || g.eventChainIds.some(x => !chains.has(x))) throw new Error('事件组引用了不存在的事件或链')
  if ((s.activeGroupId && !groups.has(s.activeGroupId)) || s.groupOrder.some(x => !groups.has(x)) || new Set(s.groupOrder).size !== s.groupOrder.length) throw new Error('事件组顺序无效')
  return s
}

export function projectActions(input: Snapshot, actions: unknown, newId: () => string): Snapshot {
  const s = structuredClone(input)
  const now = new Date().toISOString()
  let group = s.groups.find(g => g.id === s.activeGroupId)
  if (!group) { group = { id: newId(), name: '默认事件组', emoji: '📁', eventIds: [], eventChainIds: [], createdAt: now, updatedAt: now }; s.groups.push(group); s.groupOrder.push(group.id); s.activeGroupId = group.id }
  for (const a of actionsSchema.parse(actions)) {
    if (a.op === 'create_chain') {
      if (s.eventChains.some(c => c.id === a.id)) throw new Error('事件链 ID 已存在')
      s.eventChains.push({ ...a.chain, id: a.id, createdAt: now, updatedAt: now }); group.eventChainIds.push(a.id)
    } else if (a.op === 'create_event') {
      const e = { ...a.event, id: newId(), createdAt: now, updatedAt: now }
      s.events.push(e); group.eventIds.push(e.id)
    } else {
      const i = s.events.findIndex(e => e.id === a.id)
      if (i === -1) throw new Error(`事件不存在：${a.id}`)
      if (a.op === 'update_event') s.events[i] = { ...s.events[i], ...a.changes, updatedAt: now }
      else { s.events.splice(i, 1); s.groups.forEach(g => { g.eventIds = g.eventIds.filter(id => id !== a.id) }) }
    }
  }
  return validateSnapshot(s)
}

export async function snapshotRevision(s: Snapshot): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(s)))
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
}
