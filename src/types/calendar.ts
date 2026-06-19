/**
 * 日期和视图相关的类型
 */

export type ViewMode = 'day' | 'week' | 'month'

export interface TimeSlot {
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number
}

export interface CalendarDate {
  year: number
  month: number
  date: number
  day: number // 0-6, 0 is Sunday
}

export interface WeekInfo {
  startDate: Date
  endDate: Date
  weekNumber: number
  year: number
}

export interface MonthInfo {
  year: number
  month: number
  firstDay: Date
  lastDay: Date
  daysInMonth: number
}
