import type { CourseTaskRules, EventType } from '../types/event'
import { courseTaskCategory, courseTaskKind, courseTaskTime } from './courseTasks'

export const holidaySource = 'https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm'
export const holidayYears = [2026]
// 国办发明电〔2025〕7号: actual days off, excluding makeup working days.
const holidays = new Map<string, string>()
for (const [month, start, end, name] of [[1, 1, 3, '元旦'], [2, 15, 23, '春节'], [4, 4, 6, '清明节'], [5, 1, 5, '劳动节'], [6, 19, 21, '端午节'], [9, 25, 27, '中秋节'], [10, 1, 7, '国庆节']] as const) {
  for (let d = start; d <= end; d++) holidays.set(`2026-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`, name)
}
export function taskCalendarDay(date: Date | string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(date))
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)!.value).join('-')
}
type ScheduleEvent = { id: string; chainId: string; typeId: string; startTime: string | Date; endTime: string | Date; properties: Record<string, string | undefined> }
type ScheduleType = Pick<EventType, 'id' | 'category'>
export interface TaskScheduleEntry { sequence?: number; skipped: boolean; reason?: string }
export function buildCourseTaskSchedule(events: readonly ScheduleEvent[], types: readonly ScheduleType[], chains: readonly { id: string; taskRules?: CourseTaskRules }[]) {
  const entries = new Map<string, TaskScheduleEntry>(), warnings = new Map<string, string[]>()
  for (const chain of chains) {
    const rules = chain.taskRules || {}, rowWarnings: string[] = []
    for (const category of ['作业', '实验', '考试'] as const) {
      const groups = new Map<string, ScheduleEvent[]>()
      for (const e of events) {
        const kind = courseTaskKind(e, types)
        if (e.chainId !== chain.id || !kind || courseTaskCategory(kind) !== category) continue
        const key = category === '实验' && e.properties.labGroupId ? `group:${e.properties.labGroupId}` : `event:${e.id}`
        groups.set(key, [...(groups.get(key) || []), e])
      }
      const occurrences = [...groups.values()].map(items => {
        const representative = items.find(e => courseTaskKind(e, types) === '实验课') || [...items].sort((a, b) => +courseTaskTime(a, courseTaskKind(a, types)!) - +courseTaskTime(b, courseTaskKind(b, types)!))[0]
        const when = courseTaskTime(representative, courseTaskKind(representative, types)!), day = taskCalendarDay(when)
        const holiday = rules.skipHolidays && category !== '考试' ? holidays.get(day) : undefined
        const override = items.find(e => e.properties.taskSkipOverride === 'skip' || e.properties.taskSkipOverride === 'keep')?.properties.taskSkipOverride
        const reason = override === 'keep' ? undefined : override === 'skip' ? '手动跳过' : rules.keepDates?.includes(day) ? undefined : rules.extraSkipDates?.includes(day) ? '手动跳过' : holiday
        if (rules.skipHolidays && !holidayYears.includes(+day.slice(0, 4))) rowWarnings.push(`${day.slice(0, 4)} 年节假日未内置，请手动填写跳过日期`)
        return { items, when, representative, skipped: !!reason, reason }
      }).sort((a, b) => +a.when - +b.when || a.representative.id.localeCompare(b.representative.id))
      const anchor = category === '作业' ? rules.homeworkAnchor : category === '考试' ? rules.examAnchor : rules.labAnchor
      const active = occurrences.filter(o => !o.skipped)
      const anchorOccurrence = anchor ? occurrences.findIndex(o => o.items.some(e => e.id === anchor.eventId)) : -1
      // A skipped anchor keeps its position: the next active occurrence takes its number.
      const anchorIndex = anchorOccurrence < 0 ? -1 : occurrences.slice(0, anchorOccurrence).filter(o => !o.skipped).length
      if (anchor && anchorIndex < 0) rowWarnings.push(`${category}编号基准不存在，请重新设置`)
      for (const occurrence of occurrences) {
        const number = anchor && anchorIndex >= 0 && !occurrence.skipped ? anchor.number + active.indexOf(occurrence) - anchorIndex : undefined
        for (const e of occurrence.items) entries.set(e.id, { sequence: number !== undefined && number >= 0 ? number : undefined, skipped: occurrence.skipped, reason: occurrence.reason })
      }
    }
    if (rowWarnings.length) warnings.set(chain.id, [...new Set(rowWarnings)])
  }
  return { entries, warnings }
}
