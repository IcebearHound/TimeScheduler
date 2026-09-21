import type { Event, EventType } from '../types/event'

export const courseTaskKinds = ['实验课', '实验验收', '实验报告', '作业', '考试'] as const
export type CourseTaskKind = typeof courseTaskKinds[number]
export type CourseTaskCategory = '作业' | '实验' | '考试'
export function courseTaskCategory(kind: CourseTaskKind): CourseTaskCategory { return kind === '作业' || kind === '考试' ? kind : '实验' }
type TaskEvent = { id: string; typeId: string; startTime: Date | string; endTime: Date | string; properties: Record<string, string | undefined> }
type TaskType = Pick<EventType, 'id' | 'category'>

/** Legacy 实验 deadline tasks remain acceptance tasks; bare lab events are classes. */
export function courseTaskKind(event: TaskEvent, types: readonly TaskType[]): CourseTaskKind | undefined {
  const kind = event.properties.taskKind
  if (courseTaskKinds.includes(kind as CourseTaskKind)) return kind as CourseTaskKind
  if (kind === '实验') return '实验验收'
  if (!kind && types.some(t => t.id === event.typeId && t.category === 'homework')) return '作业'
  if (!kind && types.some(t => t.id === event.typeId && t.category === 'exam')) return '考试'
  if (!kind && types.some(t => t.id === event.typeId && t.category === 'lab')) return '实验课'
  return undefined
}
export function courseTaskTime(event: TaskEvent, kind: CourseTaskKind): Date {
  return new Date(kind === '实验课' || kind === '考试' ? event.startTime : event.endTime)
}
export function courseTaskCompleted(event: TaskEvent, kind: CourseTaskKind, now: Date): boolean {
  return (kind === '实验课' || kind === '考试') && event.properties.classCompletionOverride !== 'true' ? +new Date(event.endTime) <= +now : event.properties.completed === 'true'
}
export function courseTaskStatus(event: TaskEvent, kind: CourseTaskKind, now: Date): string {
  if (kind === '实验课' || kind === '考试') return event.properties.classCompletionOverride === 'true' ? event.properties.completed === 'true' ? '已完成' : '未完成' : +new Date(event.endTime) <= +now ? '已结束' : +new Date(event.startTime) <= +now ? '进行中' : kind === '考试' ? '待考试' : '待上课'
  if (event.properties.completed === 'true') return kind === '实验验收' ? '已验收' : '已提交'
  if (+new Date(event.endTime) < +now) return '已逾期'
  if (new Date(event.endTime).toDateString() === now.toDateString()) return '今日截止'
  return kind === '实验验收' ? '待验收' : '待提交'
}
export function sortedCourseTasks<T extends TaskEvent>(events: readonly T[], types: readonly TaskType[]): T[] {
  return events.filter(e => courseTaskKind(e, types)).sort((a, b) =>
    +courseTaskTime(a, courseTaskKind(a, types)!) - +courseTaskTime(b, courseTaskKind(b, types)!) || a.id.localeCompare(b.id))
}
export function nextLabClass<T extends TaskEvent & { chainId: string }>(events: readonly T[], types: readonly TaskType[], chainId: string, after: Date, excludeId?: string): T | undefined {
  return events.filter(e => e.id !== excludeId && e.chainId === chainId && courseTaskKind(e, types) === '实验课' && +new Date(e.startTime) > +after)
    .sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime))[0]
}
export function completionProperties(event: Pick<Event, 'properties'>, completed: boolean, now = new Date(), manualClass = false) {
  return { ...event.properties, ...(manualClass ? { classCompletionOverride: 'true' } : {}), completed: String(completed), completedAt: completed ? (event.properties.completed === 'true' && event.properties.completedAt || now.toISOString()) : '' }
}
