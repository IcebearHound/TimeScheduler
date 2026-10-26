import { Event } from '../types/event'

export type EventDraft = Pick<Event, 'name' | 'typeId' | 'chainId' | 'startTime' | 'endTime' | 'properties' | 'reminders'>
const aliases: Record<string, string> = { '地点': 'location', '授课老师': 'teacher', '课序号': 'courseCode', '考试形式': 'examForm', '监考老师': 'supervisor', '实验指导老师': 'labTeacher', '实验内容': 'labContent' }

export function eventDraft(event: EventDraft): EventDraft {
  const properties = { ...event.properties }
  for (const [alias, field] of Object.entries(aliases)) {
    if (properties[alias] !== undefined && properties[field] === undefined) properties[field] = properties[alias]
    delete properties[alias]
  }
  return { name: event.name, typeId: event.typeId, chainId: event.chainId, startTime: event.startTime, endTime: event.endTime, properties, reminders: event.reminders }
}

/** Three-way field merge: an untouched field can never overwrite a newer value. */
export function eventDraftChanges(base: EventDraft, draft: EventDraft, latest: EventDraft) {
  const changes: Partial<EventDraft> = {}, conflicts: string[] = []
  const current = eventDraft(latest)
  const equal = (key: keyof EventDraft, a: EventDraft, b: EventDraft) => key === 'startTime' || key === 'endTime' ? +a[key] === +b[key] : JSON.stringify(a[key]) === JSON.stringify(b[key])
  for (const key of ['name', 'typeId', 'chainId', 'startTime', 'endTime', 'reminders'] as const) {
    if (equal(key, base, draft)) continue
    if (!equal(key, base, current) && !equal(key, draft, current)) conflicts.push(key)
    Object.assign(changes, { [key]: draft[key] })
  }
  const properties = { ...current.properties }
  let changedProperties = false
  for (const key of new Set([...Object.keys(base.properties), ...Object.keys(draft.properties)])) {
    if (base.properties[key] === draft.properties[key]) continue
    changedProperties = true
    if (base.properties[key] !== current.properties[key] && draft.properties[key] !== current.properties[key]) conflicts.push(`properties.${key}`)
    if (draft.properties[key] === undefined) delete properties[key]; else properties[key] = draft.properties[key]
  }
  if (changedProperties) changes.properties = properties
  return { changes, conflicts }
}
