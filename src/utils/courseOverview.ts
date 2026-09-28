import type { CourseTaskRules, EventType } from '../types/event'
import { buildCourseTaskSchedule } from './courseTaskSchedule'
import { courseTaskCompleted, courseTaskKind } from './courseTasks'

export const overviewKinds = [
  { key: 'acceptance', kind: '实验验收', label: '验收', prefix: '实验' },
  { key: 'report', kind: '实验报告', label: '报告', prefix: '实验' },
  { key: 'homework', kind: '作业', label: '作业', prefix: '作业' },
] as const
type OverviewEvent = { id: string; name: string; chainId: string; typeId: string; startTime: Date | string; endTime: Date | string; properties: Record<string, string | undefined> }
type OverviewChain = { id: string; name: string; color: string; typeId: string; taskRules?: CourseTaskRules }

export function sequenceLabel(prefix: string, number: number) {
  const digits = '零一二三四五六七八九'
  const label = number < 10 ? digits[number] : number < 100 ? `${number < 20 ? '' : digits[Math.floor(number / 10)]}十${number % 10 ? digits[number % 10] : ''}` : String(number)
  return `${prefix}${label}`
}

/** Latest progress is the furthest numbered completed occurrence, not the last click. */
export function buildCourseOverview<E extends OverviewEvent, C extends OverviewChain>(events: readonly E[], types: readonly Pick<EventType, 'id' | 'category'>[], chains: readonly C[], now = new Date()) {
  const schedule = buildCourseTaskSchedule(events, types, chains)
  const byChain = new Map<string, E[]>()
  for (const event of events) {
    if (!courseTaskKind(event, types)) continue
    const bucket = byChain.get(event.chainId) || []
    bucket.push(event); byChain.set(event.chainId, bucket)
  }
  return chains.filter(c => byChain.has(c.id) || types.some(t => t.id === c.typeId && t.category === 'course')).map(course => ({
    course,
    items: overviewKinds.map(config => {
      const tasks = (byChain.get(course.id) || []).filter(e => courseTaskKind(e, types) === config.kind && !schedule.entries.get(e.id)?.skipped)
      const pending = tasks.filter(e => !courseTaskCompleted(e, config.kind, now)).sort((a, b) => +new Date(a.endTime) - +new Date(b.endTime) || a.id.localeCompare(b.id))
      const completed = tasks.filter(e => courseTaskCompleted(e, config.kind, now)).sort((a, b) => (schedule.entries.get(b.id)?.sequence ?? -1) - (schedule.entries.get(a.id)?.sequence ?? -1) || +new Date(b.endTime) - +new Date(a.endTime))
      const latest = completed[0], automaticNumber = latest ? schedule.entries.get(latest.id)?.sequence : undefined
      const override = course.taskRules?.completedProgress?.[config.key]
      const manual = override !== undefined, number = manual ? override : automaticNumber
      const next = pending[0]
      return { ...config, next, nextNumber: next ? schedule.entries.get(next.id)?.sequence : undefined, overdue: !!next && +new Date(next.endTime) < +now, pendingCount: pending.length, latest, number, manual,
        progress: typeof number === 'number' ? sequenceLabel(config.prefix, number) : manual || !latest ? '暂无完成' : `${latest.name}（未编号）` }
    }),
  })).sort((a, b) => {
    const nextDeadline = (items: typeof a.items) => Math.min(...items.flatMap(item => item.next ? [+new Date(item.next.endTime)] : []))
    const first = nextDeadline(a.items), second = nextDeadline(b.items)
    return first === second ? 0 : first - second
  })
}
