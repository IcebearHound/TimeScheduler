/**
 * 事件类型定义
 */

export type ReminderTime = '1w' | '3d' | '1d' | '6h' | '2h' | '30min' | '10min' | '5min' | '2min' | 'at-time'

export interface Reminder {
  id: string
  time: ReminderTime
  enabled: boolean
  notified: boolean
}

export type EventTypeCategory = 'course' | 'exam' | 'lab' | 'custom'

export interface PropertyField {
  name: string
  icon?: string  // Lucide icon name, e.g. 'MapPin', 'User', 'BookOpen'
}

export interface EventType {
  id: string
  name: string
  emoji: string
  category: EventTypeCategory
  parentId?: string // 用于多级分类
  color: string
  propertyFields?: PropertyField[] // 绑定的属性字段
}

export interface EventProperty {
  location?: string
  notes?: string
  teacher?: string
  courseCode?: string
}

export interface Event {
  id: string
  name: string
  description?: string
  startTime: Date
  endTime: Date
  chainId: string // 所属事件链ID
  typeId: string // 事件类型
  reminders: Reminder[]
  properties: EventProperty
  isHighlight: boolean // 是否为重点事件
  priority: number // 优先级，用于处理时间冲突
  color?: string // 自定义颜色，可覆盖事件链颜色
  pinned?: boolean // 是否置顶到 Todo
  todoOrder?: number // Todo 中的排序位置
  createdAt: Date
  updatedAt: Date
}

export type WeekPattern = 'every' | 'odd' | 'even'
export type BatchRuleMode = 'create' | 'modify'

export interface BatchRule {
  id: string
  name: string
  mode: BatchRuleMode
  weekPattern: WeekPattern
  daysOfWeek: number[]         // 0=周日, 1=周一, ..., 6=周六
  weekRange: {
    type: 'weekNumber' | 'dateRange'
    startWeek?: number
    endWeek?: number
    startDate?: Date
    endDate?: Date
  }
  createTime?: {
    startTime: string          // "08:00"
    endTime: string            // "10:00"
  }
  modifyFilter?: {
    position: number           // 该天第几个事件 (1-based)
  }
  modifyUpdates?: {
    name?: string
    description?: string
    startTimeOffset?: number   // 分钟偏移
    endTimeOffset?: number     // 分钟偏移
  }
}

export interface EventChain {
  id: string
  name: string
  description?: string
  typeId: string // 默认事件类型
  color: string
  defaultReminders: Reminder[] // 重点事件的默认提醒
  batchRules?: BatchRule[]
  includeInTodo?: boolean // 是否包含在 Todo 中
  createdAt: Date
  updatedAt: Date
}

export interface EventGroup {
  id: string
  name: string
  emoji: string
  eventChainIds: string[]
  eventIds: string[]
  description?: string
  includeInTodo?: boolean // 是否包含在 Todo 中
  createdAt: Date
  updatedAt: Date
}

export interface EventConflict {
  eventIds: string[]
  startTime: Date
  endTime: Date
  events: Event[]
}
