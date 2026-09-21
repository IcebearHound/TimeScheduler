import { z } from 'zod'
import type { Snapshot } from './contracts'
import { buildCourseTaskSchedule } from '../utils/courseTaskSchedule'
import { courseTaskCompleted, courseTaskKind, courseTaskTime } from '../utils/courseTasks'
import { getReminderMilliseconds } from '../utils/eventUtils'

const date = z.string().datetime({ offset: true })
export const calendarEntriesSchema = z.array(z.object({
  id: z.string().min(1).max(200), title: z.string().max(600), start: date, end: date, updated: date,
  location: z.string().max(2000), description: z.string().max(1000), alarms: z.array(date).max(100),
}).strict().refine(e => Date.parse(e.end) > Date.parse(e.start), '结束时间必须晚于开始时间')).max(10000)
export type CalendarEntry = z.infer<typeof calendarEntriesSchema>[number]

export function calendarEntries(snapshot: Snapshot, defaultMinutes = 30, now = new Date()): CalendarEntry[] {
  const schedule = buildCourseTaskSchedule(snapshot.events, snapshot.eventTypes, snapshot.eventChains)
  return snapshot.events.filter(e => !schedule.entries.get(e.id)?.skipped).map(e => {
    const kind = courseTaskKind(e, snapshot.eventTypes), deadline = kind && !['实验课', '考试'].includes(kind)
    const when = kind ? courseTaskTime(e, kind) : new Date(e.startTime)
    const completed = kind ? courseTaskCompleted(e, kind, now) : e.properties.completed === 'true'
    const offsets = e.reminders.length ? e.reminders.filter(r => r.enabled).map(r => getReminderMilliseconds(r.time)).filter((m): m is number => m !== null) : [defaultMinutes * 60000]
    return { id: e.id, title: `${kind ? `${kind} · ` : ''}${e.name}`, start: deadline ? when.toISOString() : e.startTime,
      end: deadline ? new Date(+when + 60000).toISOString() : e.endTime, updated: e.updatedAt,
      location: (e.properties.location || e.properties['地点'] || '').slice(0, 2000),
      description: [snapshot.eventChains.find(c => c.id === e.chainId)?.name, completed ? '已完成' : '', deadline ? '截止时间提醒' : ''].filter(Boolean).join(' · '),
      alarms: completed ? [] : [...new Set(offsets)].map(offset => new Date(+when - offset).toISOString()),
    }
  }).sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
}
const utc = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
// RFC 5545 folds at 75 octets, never in the middle of a UTF-8 character.
function fold(line: string) {
  let result = '', part = '', bytes = 0
  for (const char of line) { const size = new TextEncoder().encode(char).length; if (bytes + size > 75) { result += part + '\r\n'; part = ' '; bytes = 1 }; part += char; bytes += size }
  return result + part
}
export function calendarIcs(input: CalendarEntry[]): string {
  const entries = calendarEntriesSchema.parse(input)
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TimeScheduler//Calendar Sync//ZH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:时间规划器', 'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'X-PUBLISHED-TTL:PT15M']
  for (const e of entries) {
    lines.push('BEGIN:VEVENT', `UID:${encodeURIComponent(e.id)}@timescheduler`, `DTSTAMP:${utc(e.updated)}`, `LAST-MODIFIED:${utc(e.updated)}`, `SEQUENCE:${Math.max(0, Math.floor((Date.parse(e.updated) - Date.UTC(2020, 0, 1)) / 1000))}`, `DTSTART:${utc(e.start)}`, `DTEND:${utc(e.end)}`, `SUMMARY:${escapeText(e.title)}`, `LOCATION:${escapeText(e.location)}`, `DESCRIPTION:${escapeText(e.description)}`, 'STATUS:CONFIRMED')
    for (const alarm of e.alarms) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER;VALUE=DATE-TIME:${utc(alarm)}`, `DESCRIPTION:${escapeText(e.title)}`, 'END:VALARM')
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
