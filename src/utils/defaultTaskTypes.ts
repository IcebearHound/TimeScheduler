import type { CourseTaskRules, EventType } from '../types/event'
import { courseTaskKind } from './courseTasks'

/** Old versions allowed a report to anchor the combined lab sequence. Split that anchor once. */
export function migrateReportNumberAnchors<E extends Parameters<typeof courseTaskKind>[0] & { chainId: string }, C extends { id: string; taskRules?: CourseTaskRules }>(events: E[], types: EventType[], chains: C[]): C[] {
  return chains.map(chain => {
    const anchor = chain.taskRules?.labAnchor
    const report = anchor && events.find(e => e.id === anchor.eventId && e.chainId === chain.id && courseTaskKind(e, types) === '实验报告')
    if (!anchor || !report) return chain
    const rules = { ...chain.taskRules, reportAnchor: chain.taskRules?.reportAnchor || anchor }
    const sibling = report.properties.labGroupId && events.find(e => e.chainId === chain.id && e.properties.labGroupId === report.properties.labGroupId && ['实验课', '实验验收'].includes(courseTaskKind(e, types) || ''))
    if (sibling) rules.labAnchor = { ...anchor, eventId: sibling.id }; else delete rules.labAnchor
    return { ...chain, taskRules: rules }
  })
}
/** One-time upgrade of legacy report tasks, before the report type existed. */
export function migrateLegacyReports<T extends { typeId: string; properties: Record<string, string | undefined> }>(events: T[], originalTypes: EventType[], types: EventType[]): T[] {
  if (originalTypes.some(t => t.category === 'lab_report')) return events
  const reportType = types.find(t => t.category === 'lab_report')
  if (!reportType) return events
  const legacyTypes = new Set(originalTypes.filter(t => t.category === 'lab' || t.category === 'course').map(t => t.id))
  return events.map(e => e.properties.taskKind === '实验报告' && legacyTypes.has(e.typeId) ? { ...e, typeId: reportType.id } : e)
}
export function ensureDefaultTaskTypes<T extends EventType>(types: T[]): (T | EventType)[] {
  const result: (T | EventType)[] = [...types]
  for (const value of [
    { id: 'type-exam', name: '考试', emoji: '📝', category: 'exam' as const, color: '#EF4444', propertyFields: [{ name: '地点', icon: 'MapPin' }] },
    { id: 'type-lab', name: '实验', emoji: '🔬', category: 'lab' as const, color: '#10B981', propertyFields: [{ name: '地点', icon: 'MapPin' }, { name: '实验内容', icon: 'BookOpen' }] },
    { id: 'type-homework', name: '作业', emoji: '📖', category: 'homework' as const, color: '#8B5CF6', propertyFields: [{ name: 'taskContent', icon: 'BookOpen' }, { name: 'submissionUrl', icon: 'Link' }] },
    { id: 'type-lab-report', name: '实验报告', emoji: '📄', category: 'lab_report' as const, color: '#0EA5E9', propertyFields: [{ name: 'taskContent', icon: 'FileText' }, { name: 'submissionUrl', icon: 'Link' }] },
  ]) {
    if (result.some(t => t.category === value.category)) continue
    let id = value.id
    while (result.some(t => t.id === id)) id += '-default'
    result.push({ ...value, id })
  }
  return result
}
