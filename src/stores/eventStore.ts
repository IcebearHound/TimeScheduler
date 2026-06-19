/**
 * 事件管理状态存储 - 含撤销/重做、剪贴板、拖拽支持
 */
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { Event, EventChain, EventConflict, Reminder, ReminderTime, EventType, BatchRule, PropertyField } from '../types/event'
import { generateId } from '../utils/idGenerator'
import { getConflictingEvents } from '../utils/eventUtils'
import { executeCreateRule, executeModifyRule } from '../utils/batchRuleUtils'

interface HistoryEntry {
  events: [string, Event][]
  eventChains: [string, EventChain][]
  eventTypes: [string, EventType][]
}

interface EventStore {
  events: Map<string, Event>
  eventChains: Map<string, EventChain>
  eventTypes: Map<string, EventType>
  semesterStartDate: Date

  clipboardEvent: Event | null
  clipboardAction: 'copy' | 'cut' | null
  copyEvent: (eventId: string) => void
  cutEvent: (eventId: string) => void
  pasteEvent: (startTime?: Date) => Event | null

  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  pushHistory: () => void

  addEvent: (event: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => Event
  updateEvent: (id: string, updates: Partial<Event>) => void
  deleteEvent: (id: string) => void
  getEvent: (id: string) => Event | undefined
  getEventsByChain: (chainId: string) => Event[]
  getEventsByType: (typeId: string) => Event[]
  getEventsByDateRange: (startDate: Date, endDate: Date) => Event[]
  getAllEvents: () => Event[]
  moveEvent: (eventId: string, newStartTime: Date, newEndTime: Date) => void

  addEventChain: (chain: Omit<EventChain, 'id' | 'createdAt' | 'updatedAt'>) => EventChain
  updateEventChain: (id: string, updates: Partial<EventChain>) => void
  deleteEventChain: (id: string) => void
  mergeEventChains: (targetId: string, sourceIds: string[]) => void
  getEventChain: (id: string) => EventChain | undefined
  getAllEventChains: () => EventChain[]
  executeBatchRule: (chainId: string, ruleId: string) => void
  applyAllBatchRules: (chainId: string) => void
  setSemesterStartDate: (date: Date) => void
  togglePinEvent: (eventId: string) => void
  reorderTodo: (eventIds: string[]) => void
  toggleChainIncludeInTodo: (chainId: string) => void

  addEventType: (type: Omit<EventType, 'id'>) => EventType
  updateEventType: (id: string, updates: Partial<EventType>) => void
  deleteEventType: (id: string) => void
  getEventType: (id: string) => EventType | undefined
  getAllEventTypes: () => EventType[]

  detectConflicts: (events?: Event[]) => EventConflict[]

  save: () => void
  load: () => void
  clear: () => void
  loadDefaultData: () => void
}

function snapshot(state: EventStore): HistoryEntry {
  return {
    events: Array.from(state.events.entries()),
    eventChains: Array.from(state.eventChains.entries()),
    eventTypes: Array.from(state.eventTypes.entries()),
  }
}

function restore(entry: HistoryEntry): Partial<EventStore> {
  return {
    events: new Map(entry.events),
    eventChains: new Map(entry.eventChains),
    eventTypes: new Map(entry.eventTypes),
  }
}

const useEventStore = create<EventStore>()(
  subscribeWithSelector((set, get) => ({
    events: new Map(),
    eventChains: new Map(),
    eventTypes: new Map(),
    semesterStartDate: (() => {
      const now = new Date()
      const day = now.getDay()
      const diff = now.getDate() - day + 1
      const mon = new Date(now.getFullYear(), now.getMonth(), diff)
      return mon
    })(),

    clipboardEvent: null,
    clipboardAction: null,
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,

    pushHistory: () => {
      const s = get()
      set({
        undoStack: [...s.undoStack.slice(-49), snapshot(s)],
        redoStack: [],
        canUndo: true,
        canRedo: false,
      })
    },

    undo: () => {
      const s = get()
      if (s.undoStack.length === 0) return
      const prev = s.undoStack[s.undoStack.length - 1]
      set({
        ...restore(prev),
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, snapshot(s)],
        canUndo: s.undoStack.length > 1,
        canRedo: true,
      })
      get().save()
    },

    redo: () => {
      const s = get()
      if (s.redoStack.length === 0) return
      const next = s.redoStack[s.redoStack.length - 1]
      set({
        ...restore(next),
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, snapshot(s)],
        canUndo: true,
        canRedo: s.redoStack.length > 1,
      })
      get().save()
    },

    copyEvent: (eventId) => {
      const event = get().events.get(eventId)
      if (event) set({ clipboardEvent: { ...event }, clipboardAction: 'copy' })
    },

    cutEvent: (eventId) => {
      const event = get().events.get(eventId)
      if (event) {
        set({ clipboardEvent: { ...event }, clipboardAction: 'cut' })
        get().deleteEvent(eventId)
      }
    },

    pasteEvent: (startTime) => {
      const { clipboardEvent } = get()
      if (!clipboardEvent) return null
      const newId = generateId('event')
      const dur = new Date(clipboardEvent.endTime).getTime() - new Date(clipboardEvent.startTime).getTime()
      const ns = startTime ? new Date(startTime) : new Date(clipboardEvent.startTime)
      const ne = new Date(ns.getTime() + dur)
      const now = new Date()
      const pasted: Event = {
        ...clipboardEvent,
        id: newId,
        name: `${clipboardEvent.name} (副本)`,
        startTime: ns,
        endTime: ne,
        createdAt: now,
        updatedAt: now,
      }
      set((s) => ({ events: new Map(s.events).set(newId, pasted) }))
      if (get().clipboardAction === 'cut') set({ clipboardEvent: null, clipboardAction: null })
      get().save()
      return pasted
    },

    addEvent: (eventData) => {
      get().pushHistory()
      const event: Event = {
        ...eventData,
        id: generateId('event'),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      set((s) => ({ events: new Map(s.events).set(event.id, event) }))
      get().save()
      return event
    },

    updateEvent: (id, updates) => {
      get().pushHistory()
      const event = get().events.get(id)
      if (!event) return

      let merged = { ...event, ...updates, updatedAt: new Date() }

      // 当事件类型变更时，清理不属于新类型的属性
      if (updates.typeId && updates.typeId !== event.typeId) {
        const newType = get().eventTypes.get(updates.typeId)
        if (newType) {
          const validFields = new Set((newType.propertyFields || []).map(f => {
            const cnToEn: Record<string, string> = {
              '地点': 'location', '授课老师': 'teacher', '课序号': 'courseCode',
              '考试形式': 'examForm', '监考老师': 'supervisor',
              '实验指导老师': 'labTeacher', '实验内容': 'labContent',
            }
            const name = typeof f === 'string' ? f : f.name
            return cnToEn[name] || name
          }))
          const filtered: Record<string, string> = {}
          for (const [key, val] of Object.entries(merged.properties || {})) {
            if (validFields.has(key) || key === 'notes') {
              filtered[key] = val as string
            }
          }
          merged.properties = filtered as any
        }
      }

      set((s) => ({ events: new Map(s.events).set(id, merged) }))
      get().save()
    },

    deleteEvent: (id) => {
      get().pushHistory()
      set((s) => {
        const ne = new Map(s.events)
        ne.delete(id)
        return { events: ne }
      })
      get().save()
    },

    getEvent: (id) => get().events.get(id),

    getEventsByChain: (chainId) =>
      Array.from(get().events.values()).filter(e => e.chainId === chainId),

    getEventsByType: (typeId) =>
      Array.from(get().events.values()).filter(e => e.typeId === typeId),

    getEventsByDateRange: (startDate, endDate) =>
      Array.from(get().events.values()).filter(e => e.startTime <= endDate && e.endTime >= startDate),

    getAllEvents: () => Array.from(get().events.values()),

    moveEvent: (eventId, newStartTime, newEndTime) => {
      get().pushHistory()
      const event = get().events.get(eventId)
      if (!event) return
      const ns = new Date(newStartTime)
      const ne = new Date(newEndTime)
      // 防止非法时间
      if (isNaN(ns.getTime()) || isNaN(ne.getTime()) || ne <= ns) return
      const updated = { ...event, startTime: ns, endTime: ne, updatedAt: new Date() }
      set((s) => ({ events: new Map(s.events).set(eventId, updated) }))
      get().save()
    },

    addEventChain: (chainData) => {
      get().pushHistory()
      const chain: EventChain = {
        ...chainData,
        id: generateId('chain'),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      set((s) => ({ eventChains: new Map(s.eventChains).set(chain.id, chain) }))
      get().save()
      return chain
    },

    updateEventChain: (id, updates) => {
      get().pushHistory()
      const chain = get().eventChains.get(id)
      if (!chain) return
      const updated = { ...chain, ...updates, updatedAt: new Date() }
      set((s) => ({ eventChains: new Map(s.eventChains).set(id, updated) }))
      get().save()
    },

    deleteEventChain: (id) => {
      get().pushHistory()
      const chainEvents = get().getEventsByChain(id)
      set((s) => {
        const nc = new Map(s.eventChains)
        nc.delete(id)
        const ne = new Map(s.events)
        chainEvents.forEach(e => ne.delete(e.id))
        return { eventChains: nc, events: ne }
      })
      get().save()
    },

    mergeEventChains: (targetId, sourceIds) => {
      get().pushHistory()
      const target = get().eventChains.get(targetId)
      if (!target) return
      for (const sid of sourceIds) {
        if (sid === targetId) continue
        const srcEvents = get().getEventsByChain(sid)
        srcEvents.forEach(e => get().updateEvent(e.id, { chainId: targetId }))
        set((s) => {
          const nc = new Map(s.eventChains)
          nc.delete(sid)
          return { eventChains: nc }
        })
      }
      get().save()
    },

    getEventChain: (id) => get().eventChains.get(id),

    getAllEventChains: () => Array.from(get().eventChains.values()),

    executeBatchRule: (chainId, ruleId) => {
      const chain = get().eventChains.get(chainId)
      if (!chain) return
      const rule = (chain.batchRules || []).find((r) => r.id === ruleId)
      if (!rule) return

      get().pushHistory()
      const allEvents = Array.from(get().events.values())
      const semesterStart = get().semesterStartDate

      if (rule.mode === 'create') {
        const results = executeCreateRule(rule, chainId, semesterStart)
        const now = new Date()
        const newEvents = results.map((r) => ({
          id: generateId('event'),
          name: rule.name || chain.name,
          description: '',
          startTime: r.startTime,
          endTime: r.endTime,
          chainId,
          typeId: chain.typeId,
          reminders: [],
          properties: {},
          isHighlight: false,
          priority: 0,
          color: undefined,
          createdAt: now,
          updatedAt: now,
        }))
        set((s) => {
          const ne = new Map(s.events)
          newEvents.forEach((e) => ne.set(e.id, e as Event))
          return { events: ne }
        })
      } else {
        const results = executeModifyRule(rule, chainId, allEvents, semesterStart)
        set((s) => {
          const ne = new Map(s.events)
          for (const { event, updates } of results) {
            const existing = ne.get(event.id)
            if (existing) {
              ne.set(event.id, { ...existing, ...updates, updatedAt: new Date() })
            }
          }
          return { events: ne }
        })
      }
      get().save()
    },

    applyAllBatchRules: (chainId) => {
      const chain = get().eventChains.get(chainId)
      if (!chain || (chain.batchRules || []).length === 0) return

      get().pushHistory()
      const allEvents = Array.from(get().events.values())
      const semesterStart = get().semesterStartDate
      const now = new Date()

      set((s) => {
        const ne = new Map(s.events)

        for (const rule of (chain.batchRules || [])) {
          if (rule.mode === 'create') {
            const results = executeCreateRule(rule, chainId, semesterStart)
            results.forEach((r) => {
              const event: Event = {
                id: generateId('event'),
                name: rule.name || chain.name,
                description: '',
                startTime: r.startTime,
                endTime: r.endTime,
                chainId,
                typeId: chain.typeId,
                reminders: [],
                properties: {},
                isHighlight: false,
                priority: 0,
                color: undefined,
                createdAt: now,
                updatedAt: now,
              }
              ne.set(event.id, event)
            })
          } else {
            const results = executeModifyRule(rule, chainId, Array.from(ne.values()).filter((e) => e.chainId === chainId), semesterStart)
            for (const { event, updates } of results) {
              const existing = ne.get(event.id)
              if (existing) {
                ne.set(event.id, { ...existing, ...updates, updatedAt: new Date() })
              }
            }
          }
        }

        return { events: ne }
      })
      get().save()
    },

    setSemesterStartDate: (date) => {
      set({ semesterStartDate: date })
      get().save()
    },

    togglePinEvent: (eventId) => {
      const event = get().events.get(eventId)
      if (!event) return
      get().updateEvent(eventId, { pinned: !event.pinned })
    },

    reorderTodo: (eventIds) => {
      get().pushHistory()
      set((s) => {
        const ne = new Map(s.events)
        eventIds.forEach((id, index) => {
          const existing = ne.get(id)
          if (existing) {
            ne.set(id, { ...existing, todoOrder: index, updatedAt: new Date() })
          }
        })
        return { events: ne }
      })
      get().save()
    },

    toggleChainIncludeInTodo: (chainId) => {
      const chain = get().eventChains.get(chainId)
      if (!chain) return
      get().updateEventChain(chainId, { includeInTodo: chain.includeInTodo === false ? true : false })
    },

    addEventType: (typeData) => {
      get().pushHistory()
      const type: EventType = { ...typeData, id: generateId('type') }
      set((s) => ({ eventTypes: new Map(s.eventTypes).set(type.id, type) }))
      get().save()
      return type
    },

    updateEventType: (id, updates) => {
      get().pushHistory()
      const type = get().eventTypes.get(id)
      if (!type) return
      set((s) => ({ eventTypes: new Map(s.eventTypes).set(id, { ...type, ...updates }) }))
      get().save()
    },

    deleteEventType: (id) => {
      get().pushHistory()
      set((s) => {
        const nt = new Map(s.eventTypes)
        nt.delete(id)
        return { eventTypes: nt }
      })
      get().save()
    },

    getEventType: (id) => get().eventTypes.get(id),

    getAllEventTypes: () => Array.from(get().eventTypes.values()),

    detectConflicts: (eventsToCheck) => {
      const evts = eventsToCheck || Array.from(get().events.values())
      return getConflictingEvents(evts)
    },

    save: () => {
      const s = get()
      const data = {
        events: Array.from(s.events.entries()),
        eventChains: Array.from(s.eventChains.entries()),
        eventTypes: Array.from(s.eventTypes.entries()),
        semesterStartDate: s.semesterStartDate.toISOString(),
      }
      try { localStorage.setItem('eventStore', JSON.stringify(data)) }
      catch { /* localStorage full or unavailable */ }
    },

    load: () => {
      const raw = localStorage.getItem('eventStore')
      if (!raw) { get().loadDefaultData(); return }
      try {
        const p = JSON.parse(raw)
        const deserEvent = ([k, v]: [string, any]): [string, Event] => [k, { ...v, startTime: new Date(v.startTime), endTime: new Date(v.endTime), createdAt: new Date(v.createdAt), updatedAt: new Date(v.updatedAt) }]
        const deserChain = ([k, v]: [string, any]): [string, EventChain] => {
          const batchRules: BatchRule[] = (v.batchRules || []).map((r: any) => ({
            ...r,
            weekRange: {
              ...r.weekRange,
              startDate: r.weekRange?.startDate ? new Date(r.weekRange.startDate) : undefined,
              endDate: r.weekRange?.endDate ? new Date(r.weekRange.endDate) : undefined,
            },
          }))
          return [k, { ...v, batchRules, createdAt: new Date(v.createdAt), updatedAt: new Date(v.updatedAt) }]
        }
        const types = p.eventTypes || []
        const defaultPropertyFields: Record<string, PropertyField[]> = {
          'type-course': [{ name: '地点', icon: 'MapPin' }, { name: '授课老师', icon: 'User' }, { name: '课序号', icon: 'BookOpen' }],
          'type-exam': [{ name: '地点', icon: 'MapPin' }, { name: '考试形式', icon: 'BookOpen' }, { name: '监考老师', icon: 'User' }],
          'type-lab': [{ name: '地点', icon: 'MapPin' }, { name: '实验指导老师', icon: 'User' }, { name: '实验内容', icon: 'BookOpen' }],
        }
        const patchedTypes = types.map(([id, t]: [string, any]) => {
          if (defaultPropertyFields[id] && !t.propertyFields) {
            return [id, { ...t, propertyFields: defaultPropertyFields[id] }]
          }
          // 迁移旧的 string[] propertyFields 到 PropertyField[]
          if (t.propertyFields && t.propertyFields.length > 0 && typeof t.propertyFields[0] === 'string') {
            const migrated = t.propertyFields.map((name: string) => ({ name }))
            return [id, { ...t, propertyFields: migrated }]
          }
          return [id, t]
        })
        set({
          events: new Map((p.events || []).map(deserEvent)),
          eventChains: new Map((p.eventChains || []).map(deserChain)),
          eventTypes: new Map(patchedTypes),
          semesterStartDate: p.semesterStartDate ? new Date(p.semesterStartDate) : (() => {
            const now = new Date()
            const day = now.getDay()
            const diff = now.getDate() - day + 1
            return new Date(now.getFullYear(), now.getMonth(), diff)
          })(),
        })
        get().save()
      } catch {
        get().loadDefaultData()
      }
    },

    loadDefaultData: () => {
      const defaultTypes = [
        { id: 'type-course', name: '课程', emoji: '📚', category: 'course' as const, color: '#3B82F6', propertyFields: [{ name: '地点', icon: 'MapPin' }, { name: '授课老师', icon: 'User' }, { name: '课序号', icon: 'BookOpen' }] },
        { id: 'type-exam', name: '考试', emoji: '📝', category: 'exam' as const, color: '#EF4444', propertyFields: [{ name: '地点', icon: 'MapPin' }, { name: '考试形式', icon: 'BookOpen' }, { name: '监考老师', icon: 'User' }] },
        { id: 'type-lab', name: '实验', emoji: '🔬', category: 'lab' as const, color: '#10B981', propertyFields: [{ name: '地点', icon: 'MapPin' }, { name: '实验指导老师', icon: 'User' }, { name: '实验内容', icon: 'BookOpen' }] },
      ]
      set({ eventTypes: new Map(defaultTypes.map(t => [t.id, t])) })
      get().save()
    },

    clear: () => {
      set({
        events: new Map(),
        eventChains: new Map(),
        eventTypes: new Map(),
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
      })
      localStorage.removeItem('eventStore')
    },
  }))
)

export default useEventStore
