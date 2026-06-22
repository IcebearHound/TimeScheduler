/**
 * 事件管理状态存储 - 含撤销/重做、剪贴板、拖拽支持
 */
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { Event, EventChain, EventConflict, Reminder, ReminderTime, EventType, BatchRule, PropertyField, EventGroup } from '../types/event'
import { generateId } from '../utils/idGenerator'
import { getConflictingEvents } from '../utils/eventUtils'
import { executeCreateRule, executeModifyRule } from '../utils/batchRuleUtils'
import useEventGroupStore from './eventGroupStore'
import { debugLog } from '../utils/debugStore'

interface HistoryEntry {
  events: [string, Event][]
  eventChains: [string, EventChain][]
  eventTypes: [string, EventType][]
  groups: [string, EventGroup][]
  groupOrder: string[]
  activeGroupId: string
  action: string
  affected?: Array<{ type: 'event' | 'chain' | 'group' | 'type'; id: string; name: string }>
}

function collectGroupState(): { groups: [string, EventGroup][]; groupOrder: string[]; activeGroupId: string } {
  const gs = useEventGroupStore.getState()
  return {
    groups: Array.from(gs.groups.entries()),
    groupOrder: [...gs.groupOrder],
    activeGroupId: gs.activeGroupId,
  }
}

function applyGroupState(entry: HistoryEntry) {
  const gs = useEventGroupStore.getState()
  useEventGroupStore.setState({
    groups: new Map(entry.groups),
    groupOrder: entry.groupOrder,
    activeGroupId: entry.activeGroupId,
  })
  gs.save()
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
  pushHistory: (action?: string, affected?: Array<{ type: 'event' | 'chain' | 'group' | 'type'; id: string; name: string }>) => void
  lastUndoAction: string
  lastRedoAction: string
  lastAffected?: Array<{ type: 'event' | 'chain' | 'group' | 'type'; id: string; name: string }>
  setLastAction: (action: string) => void

  addEvent: (event: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => Event
  updateEvent: (id: string, updates: Partial<Event>) => void
  deleteEvent: (id: string) => void
  deleteEvents: (ids: string[]) => void
  getEvent: (id: string) => Event | undefined
  getEventsByChain: (chainId: string) => Event[]
  getEventsByType: (typeId: string) => Event[]
  getEventsByDateRange: (startDate: Date, endDate: Date) => Event[]
  getAllEvents: () => Event[]
  moveEvent: (eventId: string, newStartTime: Date, newEndTime: Date) => void

  addEventChain: (chain: Omit<EventChain, 'id' | 'createdAt' | 'updatedAt'>) => EventChain
  updateEventChain: (id: string, updates: Partial<EventChain>) => void
  deleteEventChain: (id: string) => void
  deleteEventChains: (ids: string[]) => void
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
  deleteEventTypes: (ids: string[]) => void
  getEventType: (id: string) => EventType | undefined
  getAllEventTypes: () => EventType[]

  detectConflicts: (events?: Event[]) => EventConflict[]

  save: () => void
  load: () => void
  clear: () => void
  loadDefaultData: () => void
}

function snapshot(state: EventStore, action: string): HistoryEntry {
  return {
    events: Array.from(state.events.entries()),
    eventChains: Array.from(state.eventChains.entries()),
    eventTypes: Array.from(state.eventTypes.entries()),
    ...collectGroupState(),
    action,
  }
}

function restore(entry: HistoryEntry): Partial<EventStore> {
  applyGroupState(entry)
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
    lastUndoAction: '',
    lastRedoAction: '',
    lastAffected: undefined,
    setLastAction: (action) => set({ lastUndoAction: action }),

    pushHistory: (action, affected) => {
      const s = get()
      const a = action || s.lastUndoAction || '操作'
      set({
        undoStack: [...s.undoStack.slice(-49), { ...snapshot(s, a), affected }],
        redoStack: [],
        canUndo: true,
        canRedo: false,
        lastUndoAction: '',
      })
      debugLog({ type: 'pushHistory', action: a, affected, undoStackLen: get().undoStack.length, redoStackLen: get().redoStack.length })
    },

    undo: () => {
      const s = get()
      if (s.undoStack.length === 0) return
      const prev = s.undoStack[s.undoStack.length - 1]
      const redoEntry = { ...snapshot(s, prev.action), affected: prev.affected }
      set({
        ...restore(prev),
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, redoEntry],
        canUndo: s.undoStack.length > 1,
        canRedo: true,
        lastRedoAction: prev.action,
        lastAffected: prev.affected,
      })
      get().save()
      debugLog({ type: 'undo', action: prev.action, affected: prev.affected, undoStackLen: get().undoStack.length, redoStackLen: get().redoStack.length })
    },

    redo: () => {
      const s = get()
      if (s.redoStack.length === 0) return
      const next = s.redoStack[s.redoStack.length - 1]
      const undoEntry = { ...snapshot(s, next.action), affected: next.affected }
      set({
        ...restore(next),
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, undoEntry],
        canUndo: true,
        canRedo: s.redoStack.length > 1,
        lastUndoAction: next.action,
        lastAffected: next.affected,
      })
      get().save()
      debugLog({ type: 'redo', action: next.action, affected: next.affected, undoStackLen: get().undoStack.length, redoStackLen: get().redoStack.length })
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
      const id = generateId('event')
      get().pushHistory('添加事件', [{ type: 'event', id, name: eventData.name }])
      let endTime = new Date(eventData.endTime)
      if (endTime <= new Date(eventData.startTime)) {
        endTime = new Date(new Date(eventData.startTime).getTime() + 50 * 60 * 1000)
      }
      const event: Event = {
        ...eventData,
        id,
        endTime,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      set((s) => ({ events: new Map(s.events).set(event.id, event) }))
      get().save()
      return event
    },

    updateEvent: (id, updates) => {
      debugLog({ type: 'pushHistory', action: '修改事件', affected: [{ type: 'event', id, name: get().events.get(id)?.name || id }], undoStackLen: get().undoStack.length, redoStackLen: get().redoStack.length })
      get().pushHistory('修改事件', [{ type: 'event', id, name: get().events.get(id)?.name || id }])
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
      get().pushHistory('删除事件', [{ type: 'event', id, name: get().events.get(id)?.name || id }])
      set((s) => {
        const ne = new Map(s.events)
        ne.delete(id)
        return { events: ne }
      })
      get().save()
    },

    deleteEvents: (ids) => {
      if (ids.length === 0) return
      const evts = ids.map(id => get().events.get(id)).filter(Boolean) as Event[]
      get().pushHistory('批量删除事件', evts.map(e => ({ type: 'event' as const, id: e.id, name: e.name })))
      set((s) => {
        const ne = new Map(s.events)
        ids.forEach(id => ne.delete(id))
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
      debugLog({ type: 'move', action: '移动事件', affected: [{ type: 'event', id: eventId, name: get().events.get(eventId)?.name || eventId }], undoStackLen: get().undoStack.length, redoStackLen: get().redoStack.length })
      get().pushHistory('移动事件', [{ type: 'event', id: eventId, name: get().events.get(eventId)?.name || eventId }])
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
      const id = generateId('chain')
      get().pushHistory('添加事件链', [{ type: 'chain', id, name: chainData.name }])
      const chain: EventChain = {
        ...chainData,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      set((s) => ({ eventChains: new Map(s.eventChains).set(chain.id, chain) }))
      get().save()
      return chain
    },

    updateEventChain: (id, updates) => {
      get().pushHistory('修改事件链', [{ type: 'chain', id, name: get().eventChains.get(id)?.name || id }])
      const chain = get().eventChains.get(id)
      if (!chain) return
      const updated = { ...chain, ...updates, updatedAt: new Date() }
      set((s) => ({ eventChains: new Map(s.eventChains).set(id, updated) }))
      get().save()
    },

    deleteEventChain: (id) => {
      get().pushHistory('删除事件链', [{ type: 'chain', id, name: get().eventChains.get(id)?.name || id }])
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

    deleteEventChains: (ids) => {
      if (ids.length === 0) return
      const chains = ids.map(id => get().eventChains.get(id)).filter(Boolean) as EventChain[]
      get().pushHistory('批量删除事件链', chains.map(c => ({ type: 'chain' as const, id: c.id, name: c.name })))
      set((s) => {
        const nc = new Map(s.eventChains)
        const ne = new Map(s.events)
        ids.forEach(id => {
          nc.delete(id)
          // 级联删除该链下的事件
          Array.from(s.events.values()).filter(e => e.chainId === id).forEach(e => ne.delete(e.id))
        })
        return { eventChains: nc, events: ne }
      })
      get().save()
    },

    mergeEventChains: (targetId, sourceIds) => {
      const target = get().eventChains.get(targetId)
      if (!target) return
      const sources = sourceIds.map(sid => get().eventChains.get(sid)).filter(Boolean) as EventChain[]
      const affected: Array<{ type: 'chain'; id: string; name: string }> = [
        { type: 'chain', id: targetId, name: target.name },
        ...sources.map(c => ({ type: 'chain' as const, id: c.id, name: c.name })),
      ]
      get().pushHistory('合并事件链', affected)

      const mergedBatchRules = [...(target.batchRules || [])]

      for (const sid of sourceIds) {
        if (sid === targetId) continue
        const src = get().eventChains.get(sid)
        if (src) {
          // 保留源链的批处理规则（去重）
          for (const rule of (src.batchRules || [])) {
            if (!mergedBatchRules.some(r => r.name === rule.name)) {
              mergedBatchRules.push(rule)
            }
          }
        }

        const srcEvents = get().getEventsByChain(sid)
        srcEvents.forEach(e => {
          const targetEvents = get().getEventsByChain(targetId)
          const conflicts = targetEvents.some(
            te => te.name === e.name &&
            new Date(te.startTime).getTime() === new Date(e.startTime).getTime()
          )
          if (conflicts) {
            // 冲突事件：分配新ID避免覆盖，标记为"(合并)"
            get().deleteEvent(e.id)
            get().addEvent({
              name: e.name + ' (合并)',
              description: e.description,
              startTime: new Date(e.startTime),
              endTime: new Date(e.endTime),
              chainId: targetId,
              typeId: e.typeId,
              reminders: [...(e.reminders || [])],
              properties: { ...e.properties },
              isHighlight: e.isHighlight,
              priority: e.priority,
            })
          } else {
            get().updateEvent(e.id, { chainId: targetId })
          }
        })

        set((s) => {
          const nc = new Map(s.eventChains)
          nc.delete(sid)
          return { eventChains: nc }
        })
      }

      // 更新目标链的批处理规则
      if (mergedBatchRules.length > 0) {
        get().updateEventChain(targetId, { batchRules: mergedBatchRules })
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

      if (rule.mode === 'create') {
        // 重建所有创建规则：先清空该链全部事件，再重新生成
        get().applyAllBatchRules(chainId)
        return
      }

      get().pushHistory('执行批量规则', [{ type: 'chain', id: chainId, name: chain.name }])
      const allEvents = Array.from(get().events.values())
      const semesterStart = get().semesterStartDate

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
      get().save()
    },

    applyAllBatchRules: (chainId) => {
      const chain = get().eventChains.get(chainId)
      if (!chain || (chain.batchRules || []).length === 0) return
      get().pushHistory('应用批量规则', [{ type: 'chain', id: chainId, name: chain.name }])
      const semesterStart = get().semesterStartDate
      const now = new Date()

      set((s) => {
        const ne = new Map(s.events)

        // 删除该链所有旧事件
        for (const [id, evt] of ne) {
          if (evt.chainId === chainId) {
            ne.delete(id)
          }
        }

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
      const aff = eventIds.map(id => {
        const evt = get().events.get(id)
        return { type: 'event' as const, id, name: evt?.name || id }
      })
      get().pushHistory('排序待办', aff)
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
      const id = generateId('type')
      get().pushHistory('添加事件类型', [{ type: 'type', id, name: typeData.name }])
      const type: EventType = { ...typeData, id }
      set((s) => ({ eventTypes: new Map(s.eventTypes).set(type.id, type) }))
      get().save()
      return type
    },

    updateEventType: (id, updates) => {
      get().pushHistory('修改事件类型', [{ type: 'type', id, name: get().eventTypes.get(id)?.name || id }])
      const type = get().eventTypes.get(id)
      if (!type) return
      set((s) => ({ eventTypes: new Map(s.eventTypes).set(id, { ...type, ...updates }) }))
      get().save()
    },

    deleteEventType: (id) => {
      get().pushHistory('删除事件类型', [{ type: 'type', id, name: get().eventTypes.get(id)?.name || id }])
      set((s) => {
        const nt = new Map(s.eventTypes)
        nt.delete(id)
        return { eventTypes: nt }
      })
      get().save()
    },

    deleteEventTypes: (ids) => {
      if (ids.length === 0) return
      const types = ids.map(id => get().eventTypes.get(id)).filter(Boolean) as EventType[]
      get().pushHistory('批量删除事件类型', types.map(t => ({ type: 'type' as const, id: t.id, name: t.name })))
      set((s) => {
        const nt = new Map(s.eventTypes)
        ids.forEach(id => nt.delete(id))
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
              weekStartDate: r.weekRange?.weekStartDate ? new Date(r.weekRange.weekStartDate) : undefined,
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
