import { Snapshot, validateSnapshot } from './contracts'

export function stableJSON(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item)
}
export function sameArchive(a: Snapshot, b: Snapshot) { return stableJSON(a) === stableJSON(b) }
export class SyncConflict extends Error {}
function same(a: unknown, b: unknown) { return stableJSON(a) === stableJSON(b) }
function mergeValue(base: any, local: any, remote: any, path: string): any {
  if (same(local, remote)) return local
  if (same(local, base)) return remote
  if (same(remote, base)) return local
  if (path.endsWith('.updatedAt') && typeof local === 'string' && typeof remote === 'string') return local > remote ? local : remote
  if (local && remote && typeof local === 'object' && typeof remote === 'object' && !Array.isArray(local) && !Array.isArray(remote)) {
    const merged: Record<string, unknown> = {}
    for (const k of new Set([...Object.keys(base || {}), ...Object.keys(local), ...Object.keys(remote)])) {
      const value = mergeValue(base?.[k], local[k], remote[k], `${path}.${k}`)
      if (value !== undefined) merged[k] = value
    }
    return merged
  }
  if ((path.endsWith('.eventIds') || path.endsWith('.eventChainIds')) && Array.isArray(local) && Array.isArray(remote)) {
    return [...new Set([...local, ...remote])].filter(id => !(base || []).includes(id) || (local.includes(id) && remote.includes(id)))
  }
  const fields: Record<string, string> = { name: '名称', startTime: '开始时间', endTime: '截止时间', properties: '详情', notes: '备注', taskContent: '任务内容', submissionUrl: '提交链接', submissionMethod: '提交方式', completed: '完成状态', chainId: '所属课程', typeId: '事件类型', reminders: '提醒', color: '颜色', priority: '优先级', isHighlight: '置顶状态' }
  const readable = path.split('.').map(part => fields[part] || part).join(' · ')
  throw new SyncConflict(`同时修改了${readable}`)
}
export function mergeArchives(base: Snapshot | undefined, local: Snapshot, remote: Snapshot): Snapshot {
  if (sameArchive(local, remote)) return local
  // A fresh installation should recover the existing account archive without keeping an empty default group.
  if (!base && !local.events.length && !local.eventChains.length && local.groups.every(g => g.name === '默认事件组')) return remote
  if (!base && !remote.events.length && !remote.eventChains.length && remote.groups.every(g => g.name === '默认事件组')) return local
  const result = structuredClone(local)
  for (const collection of ['events', 'eventChains', 'eventTypes', 'groups'] as const) {
    const b = new Map((base?.[collection] || []).map(v => [v.id, v])), l = new Map(local[collection].map(v => [v.id, v])), r = new Map(remote[collection].map(v => [v.id, v]))
    const labels = { events: '事件', eventChains: '课程/事件链', eventTypes: '事件类型', groups: '事件组' }
    const values = [...new Set([...l.keys(), ...r.keys(), ...b.keys()])].sort().map(id => {
      const item = l.get(id) || r.get(id) || b.get(id)
      return mergeValue(b.get(id), l.get(id), r.get(id), `${labels[collection]}“${item?.name || '未命名'}”`)
    }).filter(Boolean)
    ;(result[collection] as unknown[]) = values
  }
  result.semesterStartDate = mergeValue(base?.semesterStartDate, local.semesterStartDate, remote.semesterStartDate, '学期开始日期')
  const eventIds = new Set(result.events.map(e => e.id)), chainIds = new Set(result.eventChains.map(c => c.id)), groupIds = new Set(result.groups.map(g => g.id))
  result.groups = result.groups.map(g => ({ ...g, eventIds: g.eventIds.filter(id => eventIds.has(id)), eventChainIds: g.eventChainIds.filter(id => chainIds.has(id)) }))
  result.groupOrder = [...new Set([...local.groupOrder, ...remote.groupOrder])].filter(id => groupIds.has(id))
  result.activeGroupId = groupIds.has(local.activeGroupId) ? local.activeGroupId : result.groupOrder[0] || ''
  try { return validateSnapshot(result) } catch { throw new SyncConflict('事件或事件链在另一台设备被修改或删除，需要选择保留的存档') }
}
