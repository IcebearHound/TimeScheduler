/**
 * 日期工具函数
 */

export function getStartOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getEndOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function getStartOfWeek(date: Date, startDay: 0 | 1 = 1): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - ((d.getDay() - startDay + 7) % 7))
  d.setHours(0, 0, 0, 0)
  return d
}

export function getEndOfWeek(date: Date, startDay: 0 | 1 = 1): Date {
  const d = getStartOfWeek(date, startDay)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

export function getStartOfMonth(date: Date): Date {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getEndOfMonth(date: Date): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  d.setHours(23, 59, 59, 999)
  return d
}

export function getDayOfWeek(date: Date): number {
  return date.getDay()
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7)
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  d.setDate(Math.min(day, getDaysInMonth(d.getFullYear(), d.getMonth())))
  return d
}

export function getDaysBetween(startDate: Date, endDate: Date): number {
  const start = getStartOfDay(startDate)
  const end = getStartOfDay(endDate)
  return (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000
}

export function formatDate(date: Date, format: string = 'YYYY-MM-DD'): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  
  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

export function parseDate(dateString: string): Date {
  return new Date(dateString)
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

export function isSameWeek(date1: Date, date2: Date): boolean {
  return getStartOfWeek(date1).getTime() === getStartOfWeek(date2).getTime()
}

export function isSameMonth(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth()
  )
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function getMonthDays(date: Date, startDay: 0 | 1 = 1): Date[] {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const start = getStartOfWeek(firstDay, startDay)
  // A stable six-week grid keeps weekdays aligned and prevents layout jumps.
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function getWeekDays(date: Date, startDay: 0 | 1 = 1): Date[] {
  const start = getStartOfWeek(date, startDay)
  const days: Date[] = []
  
  for (let i = 0; i < 7; i++) {
    const day = new Date(start)
    day.setDate(day.getDate() + i)
    days.push(day)
  }
  
  return days
}
