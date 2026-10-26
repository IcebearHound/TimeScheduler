/**
 * 键盘快捷键处理
 */
import { useEffect } from 'react'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import useUIStore from '../stores/uiStore'
import { sideSelection } from '../stores/sideSelection'
import { addDays, getStartOfDay, getMonthDays } from '../utils/dateUtils'

export default function KeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Native text editing, IME composition and modal actions own their keystrokes.
      if (e.defaultPrevented || e.isComposing) return
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return
      if (document.querySelector('[aria-modal="true"]')) return
      const ui = useUIStore.getState()
      if (ui.isSettingsOpen || ui.isMobileToolsOpen || ui.dialogConfig) return
      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      const store = useEventStore.getState()

      if (ctrl && (key === 'f' || key === 'k')) {
        e.preventDefault()
        useUIStore.getState().setIsSearchOpen(true)
      }

      if (ctrl && key === 'n') {
        e.preventDefault()
        const uis = useUIStore.getState()
        if (!uis.isEventPanelOpen) {
          uis.setSelectedEvent(undefined)
          uis.setIsEventPanelOpen(true)
        }
      }

      if (ctrl && key === 'a') {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault()
          const es = useEventStore.getState()
          const uis = useUIStore.getState()
          const all = es.getAllEvents()
          const cd = uis.currentDate
          let filter: (ev: any) => boolean
          if (uis.viewMode === 'day') {
            const ds = new Date(cd); ds.setHours(0, 0, 0, 0)
            const de = new Date(cd); de.setHours(23, 59, 59, 999)
            filter = (ev: any) => new Date(ev.startTime) <= de && new Date(ev.endTime) >= ds
          } else if (uis.viewMode === 'week') {
            const ws = getStartOfDay(cd)
            const we = addDays(ws, uis.calendarDayCount)
            filter = (ev: any) => new Date(ev.startTime) < we && new Date(ev.endTime) > ws
          } else {
            const days = getMonthDays(cd), ms = days[0], me = addDays(days[days.length - 1], 1)
            filter = (ev: any) => new Date(ev.startTime) < me && new Date(ev.endTime) > ms
          }
          const hidden = new Set<string>()
          for (const id of uis.hiddenGroupIds) {
            const group = useEventGroupStore.getState().groups.get(id)
            group?.eventIds.forEach(id => hidden.add(id))
            group?.eventChainIds.forEach(id => es.getEventsByChain(id).forEach(event => hidden.add(event.id)))
          }
          const visible = all.filter(ev => filter(ev) && !uis.filterTypeIds.has(ev.typeId) && !hidden.has(ev.id))
          uis.clearMultiSelect()
          visible.forEach(ev => uis.toggleMultiSelect(ev.id))
        }
      }

      if (ctrl && key === 'c') {
        const uis = useUIStore.getState()
        const eventId = uis.selectedEventId
        if (eventId && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          store.copyEvent(eventId)
        }
      }

      if (ctrl && key === 'x') {
        const uis = useUIStore.getState()
        const eventId = uis.selectedEventId
        if (eventId && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          store.cutEvent(eventId)
          uis.setSelectedEvent(undefined)
        }
      }

      if (ctrl && key === 'v') {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          const pasted = store.pasteEvent()
          if (pasted) { e.preventDefault(); ui.setSelectedEvent(pasted.id); ui.addToast('已粘贴日程', '撤销', () => useEventStore.getState().undo()) }
        }
      }

      if (ctrl && key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const es = useEventStore.getState()
        if (!es.canUndo) return
        es.undo()
        const esAfter = useEventStore.getState()
        useUIStore.getState().addToast(`已撤销: ${esAfter.lastRedoAction || '操作'}`, '重做', () => {
          useEventStore.getState().redo()
        }, esAfter.lastAffected)
      }

      if (ctrl && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault()
        const es = useEventStore.getState()
        if (!es.canRedo) return
        es.redo()
        const esAfter = useEventStore.getState()
        useUIStore.getState().addToast(`已重做: ${esAfter.lastUndoAction || '操作'}`, '撤销', () => {
          useEventStore.getState().undo()
        }, esAfter.lastAffected)
      }

      if (e.key === 'Delete' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        const uis = useUIStore.getState()
        const estore = useEventStore.getState()
        const gstore = useEventGroupStore.getState()

        // 1. 多选事件 → 批量删除
        if (uis.selectedEventIds.size > 0) {
          const ids = Array.from(uis.selectedEventIds)
          estore.deleteEvents(ids)
          uis.clearMultiSelect()
          uis.addToast(`已删除 ${ids.length} 个事件 · Ctrl+Z 撤回`, '撤回', () => { estore.undo() })
          return
        }

        // 2. 单选事件
        const eventId = uis.selectedEventId
        if (eventId) {
          estore.deleteEvent(eventId)
          uis.setSelectedEvent(undefined)
          uis.addToast('已删除事件 · Ctrl+Z 撤回', '撤回', () => { estore.undo() })
          return
        }

        // 3. 侧栏多选/单选事件链
        const chainIds = Array.from(sideSelection.chainIds)
        if (chainIds.length > 0) {
          estore.deleteEventChains(chainIds)
          sideSelection.chainIds = new Set()
          uis.addToast(`已删除 ${chainIds.length} 个事件链 · Ctrl+Z 撤回`, '撤回', () => { estore.undo() })
          return
        }

        // 4. 侧栏多选/单选事件组
        const groupIds = Array.from(sideSelection.groupIds)
        if (groupIds.length > 0) {
          gstore.deleteGroups(groupIds)
          sideSelection.groupIds = new Set()
          uis.addToast(`已删除 ${groupIds.length} 个事件组 · Ctrl+Z 撤回`, '撤回', () => { estore.undo() })
          return
        }

        // 5. 侧栏多选/单选事件类型
        const typeIds = Array.from(sideSelection.typeIds)
        if (typeIds.length > 0) {
          estore.deleteEventTypes(typeIds)
          sideSelection.typeIds = new Set()
          uis.addToast(`已删除 ${typeIds.length} 个事件类型 · Ctrl+Z 撤回`, '撤回', () => { estore.undo() })
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return null
}
