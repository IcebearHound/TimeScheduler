import { BatchRule, BatchRuleMode, Event } from '../types/event'
import { getStartOfWeek, getStartOfDay } from './dateUtils'
import { generateId } from './idGenerator'

export function getWeekNumberFromDate(date: Date, semesterStart: Date): number {
  const startWeek = getStartOfWeek(semesterStart, 1)
  const targetWeek = getStartOfWeek(date, 1)
  const diffMs = targetWeek.getTime() - startWeek.getTime()
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
}

function matchesWeekPattern(weekNum: number, pattern: 'every' | 'odd' | 'even'): boolean {
  switch (pattern) {
    case 'every': return true
    case 'odd': return weekNum % 2 !== 0
    case 'even': return weekNum % 2 === 0
  }
}

function getWeekRange(rule: BatchRule, semesterStart: Date): { startWeek: number; endWeek: number } {
  if (rule.weekRange.type === 'weekNumber') {
    return {
      startWeek: rule.weekRange.startWeek ?? 1,
      endWeek: rule.weekRange.endWeek ?? 1,
    }
  } else {
    const start = rule.weekRange.startDate ? new Date(rule.weekRange.startDate) : semesterStart
    const end = rule.weekRange.endDate ? new Date(rule.weekRange.endDate) : semesterStart
    return {
      startWeek: getWeekNumberFromDate(start, semesterStart),
      endWeek: getWeekNumberFromDate(end, semesterStart),
    }
  }
}

export function resolveMatchingDates(rule: BatchRule, semesterStart: Date): Date[] {
  const { startWeek, endWeek } = getWeekRange(rule, semesterStart)
  const results: Date[] = []
  const anchorDate = rule.weekRange.weekStartDate || semesterStart
  const semesterWeekStart = getStartOfWeek(anchorDate, 1)

  for (let w = startWeek; w <= endWeek; w++) {
    if (!matchesWeekPattern(w, rule.weekPattern)) continue
    for (const dayOfWeek of rule.daysOfWeek) {
      const weekOffset = (w - 1) * 7
      const dayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const date = new Date(semesterWeekStart)
      date.setDate(date.getDate() + weekOffset + dayOffset)

      if (rule.mode === 'create' && rule.createTime) {
        const [sh, sm] = rule.createTime.startTime.split(':').map(Number)
        const [eh, em] = rule.createTime.endTime.split(':').map(Number)
        date.setHours(sh, sm, 0, 0)
        const endDate = new Date(date)
        endDate.setHours(eh, em, 0, 0)
        results.push(date)
      } else {
        results.push(date)
      }
    }
  }

  results.sort((a, b) => a.getTime() - b.getTime())
  return results
}

export interface CreateResult {
  date: Date
  startTime: Date
  endTime: Date
}

export function executeCreateRule(
  rule: BatchRule,
  chainId: string,
  semesterStart: Date
): CreateResult[] {
  if (rule.mode !== 'create' || !rule.createTime) return []

  const dates = resolveMatchingDates(rule, semesterStart)
  return dates.map((date) => {
    const [sh, sm] = rule.createTime!.startTime.split(':').map(Number)
    const [eh, em] = rule.createTime!.endTime.split(':').map(Number)
    const startTime = new Date(date)
    startTime.setHours(sh, sm, 0, 0)
    const endTime = new Date(date)
    endTime.setHours(eh, em, 0, 0)
    return { date, startTime, endTime }
  })
}

export interface ModifyResult {
  event: Event
  updates: Partial<Event>
}

export function executeModifyRule(
  rule: BatchRule,
  chainId: string,
  allEvents: Event[],
  semesterStart: Date
): ModifyResult[] {
  if (rule.mode !== 'modify' || !rule.modifyFilter) return []

  const position = rule.modifyFilter.position
  const chainEvents = allEvents.filter((e) => e.chainId === chainId)

  const byDay = new Map<string, Event[]>()
  for (const evt of chainEvents) {
    const dayKey = getStartOfDay(new Date(evt.startTime)).toISOString()
    if (!byDay.has(dayKey)) byDay.set(dayKey, [])
    byDay.get(dayKey)!.push(evt)
  }

  const matchingDates = new Set(
    resolveMatchingDates(rule, semesterStart).map((d) => getStartOfDay(d).toISOString())
  )

  const results: ModifyResult[] = []

  for (const [dayKey, events] of byDay) {
    if (!matchingDates.has(dayKey)) continue
    events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

    if (position > events.length || position < 1) continue
    const target = events[position - 1]

    const updates: Partial<Event> = {}
    if (rule.modifyUpdates?.name !== undefined) updates.name = rule.modifyUpdates.name
    if (rule.modifyUpdates?.description !== undefined) updates.description = rule.modifyUpdates.description
    if (rule.modifyUpdates?.startTimeOffset !== undefined && rule.modifyUpdates.startTimeOffset !== 0) {
      const newStart = new Date(target.startTime)
      newStart.setMinutes(newStart.getMinutes() + rule.modifyUpdates.startTimeOffset)
      updates.startTime = newStart
    }
    if (rule.modifyUpdates?.endTimeOffset !== undefined && rule.modifyUpdates.endTimeOffset !== 0) {
      const newEnd = new Date(target.endTime)
      newEnd.setMinutes(newEnd.getMinutes() + rule.modifyUpdates.endTimeOffset)
      updates.endTime = newEnd
    }

    if (Object.keys(updates).length > 0) {
      results.push({ event: target, updates })
    }
  }

  return results
}
