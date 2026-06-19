/**
 * 事件组管理状态
 */
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { EventGroup } from '../types/event'
import { generateId } from '../utils/idGenerator'

interface EventGroupStore {
  groups: Map<string, EventGroup>
  activeGroupId: string
  groupOrder: string[]

  undoStack: Array<{ groups: [string, EventGroup][]; groupOrder: string[]; activeGroupId: string }>
  redoStack: Array<{ groups: [string, EventGroup][]; groupOrder: string[]; activeGroupId: string }>
  pushHistory: () => void
  undo: () => void
  redo: () => void

  addGroup: (group: Omit<EventGroup, 'id' | 'createdAt' | 'updatedAt'>) => EventGroup
  updateGroup: (id: string, updates: Partial<EventGroup>) => void
  deleteGroup: (id: string) => void
  getGroup: (id: string) => EventGroup | undefined
  getAllGroups: () => EventGroup[]
  getOrderedGroups: () => EventGroup[]
  setActiveGroup: (id: string) => void
  getActiveGroup: () => EventGroup | undefined
  ensureActiveGroup: () => string
  moveGroupUp: (id: string) => void
  moveGroupDown: (id: string) => void

  addEventChainToGroup: (groupId: string, chainId: string) => void
  removeEventChainFromGroup: (groupId: string, chainId: string) => void
  addEventToGroup: (groupId: string, eventId: string) => void
  removeEventFromGroup: (groupId: string, eventId: string) => void

  mergeGroups: (groupId1: string, groupId2: string) => void

  toggleGroupIncludeInTodo: (groupId: string) => void

  save: () => void
  load: () => void
  createDefaultGroup: () => string
}

const useEventGroupStore = create<EventGroupStore>()(
  subscribeWithSelector((set, get) => ({
    groups: new Map(),
    activeGroupId: '',
    groupOrder: [],
    undoStack: [],
    redoStack: [],

    pushHistory: () => {
      const s = get()
      set({
        undoStack: [...s.undoStack.slice(-49), { groups: Array.from(s.groups.entries()), groupOrder: [...s.groupOrder], activeGroupId: s.activeGroupId }],
        redoStack: [],
      })
    },

    undo: () => {
      const s = get()
      if (s.undoStack.length === 0) return
      const prev = s.undoStack[s.undoStack.length - 1]
      set({
        groups: new Map(prev.groups), groupOrder: prev.groupOrder, activeGroupId: prev.activeGroupId,
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, { groups: Array.from(s.groups.entries()), groupOrder: [...s.groupOrder], activeGroupId: s.activeGroupId }],
      })
      get().save()
    },

    redo: () => {
      const s = get()
      if (s.redoStack.length === 0) return
      const next = s.redoStack[s.redoStack.length - 1]
      set({
        groups: new Map(next.groups), groupOrder: next.groupOrder, activeGroupId: next.activeGroupId,
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, { groups: Array.from(s.groups.entries()), groupOrder: [...s.groupOrder], activeGroupId: s.activeGroupId }],
      })
      get().save()
    },

    addGroup: (groupData) => {
      get().pushHistory()
      const group: EventGroup = {
        ...groupData,
        emoji: groupData.emoji || '📁',
        id: generateId('group'),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      set((s) => ({
        groups: new Map(s.groups).set(group.id, group),
        groupOrder: [...s.groupOrder, group.id],
      }))
      if (!get().activeGroupId) set({ activeGroupId: group.id })
      get().save()
      return group
    },

    updateGroup: (id, updates) => {
      get().pushHistory()
      const group = get().groups.get(id)
      if (!group) return
      const updated = { ...group, ...updates, updatedAt: new Date() }
      set((s) => ({ groups: new Map(s.groups).set(id, updated) }))
      get().save()
    },

    deleteGroup: (id) => {
      const group = get().groups.get(id)
      if (!group) return
      get().pushHistory()
      set((s) => {
        const ng = new Map(s.groups); ng.delete(id)
        const no = s.groupOrder.filter(i => i !== id)
        let newActive = s.activeGroupId === id ? (no[0] || '') : s.activeGroupId
        if (ng.size === 0) {
          const dg: EventGroup = {
            id: generateId('group'), name: '默认事件组', emoji: '📁',
            eventChainIds: [], eventIds: [],
            createdAt: new Date(), updatedAt: new Date(),
          }
          ng.set(dg.id, dg)
          no.push(dg.id)
          newActive = dg.id
        }
        return { groups: ng, groupOrder: no, activeGroupId: newActive }
      })
      get().ensureActiveGroup()
      get().save()
    },

    getGroup: (id) => get().groups.get(id),

    getAllGroups: () => Array.from(get().groups.values()),

    getOrderedGroups: () => {
      const { groups, groupOrder } = get()
      return groupOrder.map(id => groups.get(id)).filter(Boolean) as EventGroup[]
    },

    setActiveGroup: (id) => set({ activeGroupId: id }),

    getActiveGroup: () => {
      const id = get().activeGroupId
      return id ? get().groups.get(id) : undefined
    },

    ensureActiveGroup: () => {
      let id = get().activeGroupId
      if (!id || !get().groups.has(id)) {
        if (get().groups.size === 0) {
          const defId = generateId('group')
          set((s) => ({
            groups: new Map(s.groups).set(defId, { id: defId, name: '默认事件组', emoji: '📁', eventChainIds: [], eventIds: [], createdAt: new Date(), updatedAt: new Date() }),
            groupOrder: [...s.groupOrder, defId],
            activeGroupId: defId,
          }))
          id = defId
        } else {
          id = get().groupOrder[0]
          set({ activeGroupId: id })
        }
      }
      return id
    },

    moveGroupUp: (id) => {
      set((s) => {
        const idx = s.groupOrder.indexOf(id)
        if (idx <= 0) return s
        const no = [...s.groupOrder]
        ;[no[idx - 1], no[idx]] = [no[idx], no[idx - 1]]
        return { groupOrder: no }
      })
      get().save()
    },

    moveGroupDown: (id) => {
      set((s) => {
        const idx = s.groupOrder.indexOf(id)
        if (idx < 0 || idx >= s.groupOrder.length - 1) return s
        const no = [...s.groupOrder]
        ;[no[idx], no[idx + 1]] = [no[idx + 1], no[idx]]
        return { groupOrder: no }
      })
      get().save()
    },

    addEventChainToGroup: (groupId, chainId) => {
      const group = get().groups.get(groupId)
      if (!group || group.eventChainIds.includes(chainId)) return
      get().updateGroup(groupId, { eventChainIds: [...group.eventChainIds, chainId] })
    },

    removeEventChainFromGroup: (groupId, chainId) => {
      const group = get().groups.get(groupId)
      if (!group) return
      get().updateGroup(groupId, { eventChainIds: group.eventChainIds.filter(id => id !== chainId) })
    },

    addEventToGroup: (groupId, eventId) => {
      const group = get().groups.get(groupId)
      if (!group || group.eventIds.includes(eventId)) return
      get().updateGroup(groupId, { eventIds: [...group.eventIds, eventId] })
    },

    removeEventFromGroup: (groupId, eventId) => {
      const group = get().groups.get(groupId)
      if (!group) return
      get().updateGroup(groupId, { eventIds: group.eventIds.filter(id => id !== eventId) })
    },

    mergeGroups: (groupId1, groupId2) => {
      const g1 = get().groups.get(groupId1)
      const g2 = get().groups.get(groupId2)
      if (!g1 || !g2 || groupId1 === groupId2) return
      get().updateGroup(groupId1, {
        eventChainIds: Array.from(new Set([...g1.eventChainIds, ...g2.eventChainIds])),
        eventIds: Array.from(new Set([...g1.eventIds, ...g2.eventIds])),
      })
      get().deleteGroup(groupId2)
    },

    toggleGroupIncludeInTodo: (groupId) => {
      const group = get().groups.get(groupId)
      if (!group) return
      get().updateGroup(groupId, { includeInTodo: group.includeInTodo === false ? true : false })
    },

    save: () => {
      const s = get()
      const data = {
        groups: Array.from(s.groups.entries()),
        activeGroupId: s.activeGroupId,
        groupOrder: s.groupOrder,
      }
      try { localStorage.setItem('eventGroupStore', JSON.stringify(data)) }
      catch { /* localStorage full or unavailable */ }
    },

    load: () => {
      const raw = localStorage.getItem('eventGroupStore')
      if (!raw) {
        get().createDefaultGroup()
        return
      }
      try {
        const p = JSON.parse(raw)
        const groups = new Map<string, EventGroup>(p.groups || [])
        const order: string[] = (p.groupOrder != null && p.groupOrder.length > 0) ? p.groupOrder : Array.from(groups.keys())
        let active = (p.activeGroupId && groups.has(p.activeGroupId)) ? p.activeGroupId : order[0] || ''
        
        // 防御：如果没有组或 active 无效，创建默认组
        if (groups.size === 0 || !active || !groups.has(active)) {
          const dg: EventGroup = {
            id: generateId('group'), name: '默认事件组', emoji: '📁',
            eventChainIds: [], eventIds: [],
            createdAt: new Date(), updatedAt: new Date(),
          }
          groups.set(dg.id, dg)
          order.push(dg.id)
          active = dg.id
        }
        
        set({ groups, activeGroupId: active, groupOrder: order })
        // Final safety: if still empty after all checks, force create
        if (get().groups.size === 0) {
          get().createDefaultGroup()
        }
      } catch {
        get().createDefaultGroup()
      }
    },

    createDefaultGroup: () => {
      const dg: EventGroup = {
        id: generateId('group'), name: '默认事件组', emoji: '📁',
        eventChainIds: [], eventIds: [],
        createdAt: new Date(), updatedAt: new Date(),
      }
      set((s) => ({
        groups: new Map(s.groups).set(dg.id, dg),
        groupOrder: [...s.groupOrder, dg.id],
        activeGroupId: dg.id,
      }))
      get().save()
      return dg.id
    },
  }))
)

export default useEventGroupStore
