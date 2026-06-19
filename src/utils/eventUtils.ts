/**
 * 事件工具函数
 */

import { Event, EventConflict } from '../types/event'

export function getConflictingEvents(events: Event[]): EventConflict[] {
  const conflicts: EventConflict[] = []
  
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const event1 = events[i]
      const event2 = events[j]
      
      // 检查是否有时间重叠
      if (eventsOverlap(event1, event2)) {
        // 查看是否已经存在包含这两个事件的冲突
        const existingConflict = conflicts.find(c =>
          c.eventIds.includes(event1.id) && c.eventIds.includes(event2.id)
        )
        
        if (existingConflict) {
          continue
        }
        
        // 找到所有与这个冲突相关的事件
        const conflictingIds = [event1.id, event2.id]
        const conflictingEvents = [event1, event2]
        
        for (let k = 0; k < events.length; k++) {
          if (k !== i && k !== j) {
            const event3 = events[k]
            if (
              eventsOverlap(event1, event3) ||
              eventsOverlap(event2, event3)
            ) {
              conflictingIds.push(event3.id)
              conflictingEvents.push(event3)
            }
          }
        }
        
        const startTime = new Date(
          Math.max(event1.startTime.getTime(), event2.startTime.getTime())
        )
        const endTime = new Date(
          Math.min(event1.endTime.getTime(), event2.endTime.getTime())
        )
        
        conflicts.push({
          eventIds: conflictingIds,
          startTime,
          endTime,
          events: conflictingEvents,
        })
      }
    }
  }
  
  return conflicts
}

export function eventsOverlap(event1: Event, event2: Event): boolean {
  return event1.startTime < event2.endTime && event1.endTime > event2.startTime
}

export function calculateEventDuration(event: Event): number {
  return event.endTime.getTime() - event.startTime.getTime()
}

export function isEventToday(event: Event, date: Date = new Date()): boolean {
  const eventDate = new Date(event.startTime)
  const today = new Date(date)
  return (
    eventDate.getFullYear() === today.getFullYear() &&
    eventDate.getMonth() === today.getMonth() &&
    eventDate.getDate() === today.getDate()
  )
}

export function isEventInWeek(event: Event, weekStartDate: Date): boolean {
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekEndDate.getDate() + 7)
  return event.startTime < weekEndDate && event.endTime > weekStartDate
}

export function isEventInMonth(event: Event, year: number, month: number): boolean {
  const eventDate = new Date(event.startTime)
  return eventDate.getFullYear() === year && eventDate.getMonth() === month
}

export function getEventPositionInDay(event: Event): { top: number; height: number } {
  const dayStart = new Date(event.startTime)
  dayStart.setHours(0, 0, 0, 0)
  
  const relativeStart = event.startTime.getTime() - dayStart.getTime()
  const duration = event.endTime.getTime() - event.startTime.getTime()
  
  // 假设一天显示 8:00 - 22:00（14小时）
  const dayDurationMs = 14 * 60 * 60 * 1000
  const dayHeight = 840 // px
  
  const topPercent = (relativeStart / dayDurationMs) * 100
  const heightPercent = (duration / dayDurationMs) * 100
  
  return {
    top: Math.max(0, (topPercent / 100) * dayHeight),
    height: Math.max(20, (heightPercent / 100) * dayHeight),
  }
}

export function formatEventTime(event: Event): string {
  const start = new Date(event.startTime).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const end = new Date(event.endTime).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${start} - ${end}`
}

export function formatEventDate(event: Event): string {
  return new Date(event.startTime).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function getNextReminderTime(event: Event, reminderTime: string): Date | null {
  const now = new Date()
  const eventStart = new Date(event.startTime)
  
  // 如果事件已经开始，不提醒
  if (eventStart <= now) return null
  
  const reminderMs = getReminderMilliseconds(reminderTime)
  if (reminderMs === null) return null
  
  const reminderDate = new Date(eventStart.getTime() - reminderMs)
  return reminderDate > now ? reminderDate : null
}

export function getReminderMilliseconds(reminderTime: string): number | null {
  const times: Record<string, number> = {
    '2min': 2 * 60 * 1000,
    '5min': 5 * 60 * 1000,
    '10min': 10 * 60 * 1000,
    '30min': 30 * 60 * 1000,
    '2h': 2 * 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
    'at-time': 0,
  }
  
  return times[reminderTime] ?? null
}
