import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import { Event, EventChain, EventGroup, EventType } from '../types/event'
import { actionsSchema, projectActions, Snapshot, snapshotRevision, validateSnapshot } from './contracts'

export function captureArchive(): Snapshot {
  const e = useEventStore.getState(), g = useEventGroupStore.getState()
  return validateSnapshot(JSON.parse(JSON.stringify({ version: 1, semesterStartDate: e.semesterStartDate, events: [...e.events.values()], eventChains: [...e.eventChains.values()], eventTypes: [...e.eventTypes.values()], groups: [...g.groups.values()], groupOrder: g.groupOrder, activeGroupId: g.activeGroupId })))
}

export function installArchive(input: unknown, label = '恢复同步存档') {
  const s = validateSnapshot(input)
  const revived = JSON.parse(JSON.stringify(s), (key, value) => ['startTime', 'endTime', 'createdAt', 'updatedAt', 'startDate', 'endDate', 'weekStartDate', 'semesterStartDate'].includes(key) && typeof value === 'string' ? new Date(value) : value)
  const beforeEvents = useEventStore.getState(), beforeGroups = useEventGroupStore.getState()
  const rawEvents = localStorage.getItem('eventStore'), rawGroups = localStorage.getItem('eventGroupStore')
  const eventData = JSON.stringify({ events: s.events.map(e => [e.id, e]), eventChains: s.eventChains.map(c => [c.id, c]), eventTypes: s.eventTypes.map(t => [t.id, t]), semesterStartDate: s.semesterStartDate })
  const groupData = JSON.stringify({ groups: s.groups.map(g => [g.id, g]), groupOrder: s.groupOrder, activeGroupId: s.activeGroupId })
  try {
    // Preflight real storage writes before changing stores; don't report a volatile edit as saved.
    localStorage.setItem('eventStore', eventData); localStorage.setItem('eventGroupStore', groupData)
    useEventStore.getState().pushHistory(label)
    useEventGroupStore.setState({ groups: new Map(revived.groups.map((g: EventGroup) => [g.id, g])), groupOrder: s.groupOrder, activeGroupId: s.activeGroupId })
    useEventStore.setState({ events: new Map(revived.events.map((e: Event) => [e.id, e])), eventChains: new Map(revived.eventChains.map((c: EventChain) => [c.id, c])), eventTypes: new Map(revived.eventTypes.map((t: EventType) => [t.id, t])), semesterStartDate: revived.semesterStartDate, clipboardEvent: null, clipboardAction: null })
    localStorage.setItem('eventStore', eventData); localStorage.setItem('eventGroupStore', groupData)
  } catch {
    useEventStore.setState(beforeEvents); useEventGroupStore.setState(beforeGroups)
    try { if (rawEvents === null) localStorage.removeItem('eventStore'); else localStorage.setItem('eventStore', rawEvents); if (rawGroups === null) localStorage.removeItem('eventGroupStore'); else localStorage.setItem('eventGroupStore', rawGroups) } catch { /* Existing values may already be intact when storage is unavailable. */ }
    throw new Error('无法保存到浏览器存档（空间不足或存储被禁用），操作已回滚')
  }
}

export async function applyActions(actions: unknown, expectedRevision: string, previewSnapshot?: Snapshot) {
  const before = captureArchive(), serialized = JSON.stringify(before)
  const revision = await snapshotRevision(before)
  if (revision !== expectedRevision) {
    const checked = actionsSchema.parse(actions)
    // Unrelated archive edits must not invalidate an unchanged deletion target.
    // Never rebase edits/creates or silently delete a target changed since preview.
    const unchangedDeletion = previewSnapshot && await snapshotRevision(previewSnapshot) === expectedRevision && checked.every(action => {
      if (action.op !== 'delete_event') return false
      const original = previewSnapshot.events.find(e => e.id === action.id)
      return original && JSON.stringify(original) === JSON.stringify(before.events.find(e => e.id === action.id))
    })
    if (!unchangedDeletion) throw new Error('存档已变化，请重新生成预览；本次尚未应用任何修改')
  }
  if (JSON.stringify(captureArchive()) !== serialized) throw new Error('存档正在变化，请再次确认；本次尚未应用任何修改')
  const after = projectActions(before, actions, () => crypto.randomUUID())
  installArchive(after, '批量应用事件操作')
  return { snapshot: after, revision: await snapshotRevision(after) }
}
