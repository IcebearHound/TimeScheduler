/**
 * UI状态管理
 */
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { ViewMode } from '../types/calendar'
import { EventConflict } from '../types/event'
import { DialogConfig } from '../components/DialogModal'

interface UIStore {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  currentDate: Date
  setCurrentDate: (date: Date) => void

  selectedEventId?: string
  setSelectedEvent: (id?: string) => void
  selectedEventIds: Set<string>
  toggleMultiSelect: (id: string) => void
  clearMultiSelect: () => void
  hiddenGroupIds: Set<string>
  toggleGroupVisibility: (id: string) => void
  setHiddenGroupIds: (ids: Set<string>) => void
  clearHiddenGroups: () => void
  selectedChainId?: string
  setSelectedChain: (id?: string) => void

  isLeftSidebarOpen: boolean
  setIsLeftSidebarOpen: (open: boolean) => void
  isRightPanelOpen: boolean
  setIsRightPanelOpen: (open: boolean) => void

  isEventPanelOpen: boolean
  setIsEventPanelOpen: (open: boolean) => void
  isImportDialogOpen: boolean
  setIsImportDialogOpen: (open: boolean) => void
  isConflictDialogOpen: boolean
  setIsConflictDialogOpen: (open: boolean) => void
  conflictConflicts: EventConflict[]
  setConflictConflicts: (conflicts: EventConflict[]) => void
  isTypeManagerOpen: boolean
  setIsTypeManagerOpen: (open: boolean) => void
  isChainManagerOpen: boolean
  setIsChainManagerOpen: (open: boolean) => void
  isSearchOpen: boolean
  setIsSearchOpen: (open: boolean) => void
  isWelcomeGuideOpen: boolean
  setIsWelcomeGuideOpen: (open: boolean) => void
  isNotificationPromptOpen: boolean
  setIsNotificationPromptOpen: (open: boolean) => void
  isTodoModalOpen: boolean
  setIsTodoModalOpen: (open: boolean) => void
  openPopoverEventId: string | null
  setOpenPopoverEventId: (id: string | null) => void
  popoverEditorId: string | null
  setPopoverEditorId: (id: string | null) => void

  dialogConfig: DialogConfig | null
  showDialog: (config: DialogConfig) => void
  closeDialog: () => void

  toasts: Array<{ id: string; message: string; action?: string; actionFn?: () => void; affected?: Array<{ type: 'event' | 'chain' | 'group' | 'type'; id: string; name: string }> }>
  addToast: (message: string, action?: string, actionFn?: () => void, affected?: Array<{ type: 'event' | 'chain' | 'group' | 'type'; id: string; name: string }>) => void
  removeToast: (id: string) => void

  showGroupEmoji: boolean
  setShowGroupEmoji: (show: boolean) => void

  filterTypeIds: Set<string>
  addTypeFilter: (typeId: string) => void
  removeTypeFilter: (typeId: string) => void
  clearTypeFilters: () => void

  draggedEventId?: string
  setDraggedEvent: (id?: string) => void

  semesterStartDate?: Date
  setSemesterStartDate: (date: Date) => void

  todoHighlightDays: number
  setTodoHighlightDays: (days: number) => void
  todoUpcomingDays: number
  setTodoUpcomingDays: (days: number) => void

  themeMode: 'light' | 'dark' | 'system'
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void
  typeToEditId: string | null
  setTypeToEditId: (id: string | null) => void
  popoverCloseToken: number
  triggerClosePopovers: () => void
  flashEventId: string | null
  setFlashEventId: (id: string | null) => void

  showDebugPanel: boolean
  setShowDebugPanel: (show: boolean) => void
}

function getSavedTheme(): 'light' | 'dark' | 'system' {
  try {
    const v = localStorage.getItem('themeMode')
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {}
  return 'system'
}

function resolveTheme(mode: 'light' | 'dark' | 'system'): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

function applyTheme(mode: 'light' | 'dark' | 'system') {
  const resolved = resolveTheme(mode)
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  try { localStorage.setItem('themeMode', mode) } catch {}
}

const initialTheme = getSavedTheme()

const useUIStore = create<UIStore>()(
  subscribeWithSelector((set) => ({
    viewMode: 'week',
    setViewMode: (mode) => set({ viewMode: mode }),
    currentDate: new Date(),
    setCurrentDate: (date) => set({ currentDate: date }),

    selectedEventId: undefined,
    setSelectedEvent: (id) => set({ selectedEventId: id }),
    selectedEventIds: new Set(),
    toggleMultiSelect: (id) => set(s => {
      const ns = new Set(s.selectedEventIds)
      if (ns.has(id)) ns.delete(id); else ns.add(id)
      return { selectedEventIds: ns }
    }),
    clearMultiSelect: () => set({ selectedEventIds: new Set() }),
    hiddenGroupIds: new Set(),
    toggleGroupVisibility: (id) => set(s => {
      const ns = new Set(s.hiddenGroupIds)
      if (ns.has(id)) ns.delete(id); else ns.add(id)
      return { hiddenGroupIds: ns }
    }),
    setHiddenGroupIds: (ids) => set({ hiddenGroupIds: ids }),
    clearHiddenGroups: () => set({ hiddenGroupIds: new Set() }),
    selectedChainId: undefined,
    setSelectedChain: (id) => set({ selectedChainId: id }),

    isLeftSidebarOpen: true,
    setIsLeftSidebarOpen: (open) => set({ isLeftSidebarOpen: open }),
    isRightPanelOpen: true,
    setIsRightPanelOpen: (open) => set({ isRightPanelOpen: open }),

    isEventPanelOpen: false,
    setIsEventPanelOpen: (open) => set({ isEventPanelOpen: open }),
    isImportDialogOpen: false,
    setIsImportDialogOpen: (open) => set({ isImportDialogOpen: open }),
    isConflictDialogOpen: false,
    setIsConflictDialogOpen: (open) => set({ isConflictDialogOpen: open }),
    conflictConflicts: [],
    setConflictConflicts: (c) => set({ conflictConflicts: c }),
    isTypeManagerOpen: false,
    setIsTypeManagerOpen: (open) => set({ isTypeManagerOpen: open }),
    isChainManagerOpen: false,
    setIsChainManagerOpen: (open) => set({ isChainManagerOpen: open }),
    isSearchOpen: false,
    setIsSearchOpen: (open) => set({ isSearchOpen: open }),
    isWelcomeGuideOpen: false,
    setIsWelcomeGuideOpen: (open) => set({ isWelcomeGuideOpen: open }),
    isNotificationPromptOpen: false,
    setIsNotificationPromptOpen: (open) => set({ isNotificationPromptOpen: open }),
    isTodoModalOpen: false,
    setIsTodoModalOpen: (open) => set({ isTodoModalOpen: open }),
    openPopoverEventId: null,
    setOpenPopoverEventId: (id) => set({ openPopoverEventId: id }),
    popoverEditorId: null,
    setPopoverEditorId: (id) => set({ popoverEditorId: id }),

    dialogConfig: null,
    showDialog: (config) => set({ dialogConfig: config }),
    closeDialog: () => set({ dialogConfig: null }),

    toasts: [],
    addToast: (message, action, actionFn, affected) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      set(s => ({ toasts: [...s.toasts, { id, message, action, actionFn, affected }] }))
      setTimeout(() => { useUIStore.getState().removeToast(id) }, 5000)
    },
    removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

    showGroupEmoji: true,
    setShowGroupEmoji: (show) => set({ showGroupEmoji: show }),

    filterTypeIds: new Set(),
    addTypeFilter: (typeId) => set((s) => ({ filterTypeIds: new Set(s.filterTypeIds).add(typeId) })),
    removeTypeFilter: (typeId) => set((s) => {
      const ns = new Set(s.filterTypeIds); ns.delete(typeId); return { filterTypeIds: ns }
    }),
    clearTypeFilters: () => set({ filterTypeIds: new Set() }),

    draggedEventId: undefined,
    setDraggedEvent: (id) => set({ draggedEventId: id }),

    semesterStartDate: new Date(2026, 2, 2),
    setSemesterStartDate: (date) => set({ semesterStartDate: date }),

    todoHighlightDays: 30,
    setTodoHighlightDays: (days) => set({ todoHighlightDays: days }),
    todoUpcomingDays: 3,
    setTodoUpcomingDays: (days) => set({ todoUpcomingDays: days }),

    themeMode: initialTheme,
    setThemeMode: (mode) => {
      applyTheme(mode)
      set({ themeMode: mode })
    },
    typeToEditId: null,
    setTypeToEditId: (id) => set({ typeToEditId: id }),
    popoverCloseToken: 0,
    triggerClosePopovers: () => set(s => ({ popoverCloseToken: s.popoverCloseToken + 1 })),
    flashEventId: null,
    setFlashEventId: (id) => {
      set({ flashEventId: id })
      if (id) setTimeout(() => set({ flashEventId: null }), 1200)
    },
    showDebugPanel: false,
    setShowDebugPanel: (show) => set({ showDebugPanel: show }),
  }))
)

export default useUIStore
