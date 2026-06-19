/**
 * 键盘快捷键处理
 */
import { useEffect } from 'react'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import useUIStore from '../stores/uiStore'

export default function KeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      const store = useEventStore.getState()

      if (ctrl && e.key === 'f') {
        e.preventDefault()
        useUIStore.getState().setIsSearchOpen(true)
      }

      if (ctrl && e.key === 'n') {
        e.preventDefault()
        const uis = useUIStore.getState()
        if (!uis.isEventPanelOpen) {
          uis.setIsEventPanelOpen(true)
        }
      }

      if (ctrl && e.key === 'a') {
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
            const ws = new Date(cd); ws.setDate(cd.getDate() - ((cd.getDay() + 6) % 7)); ws.setHours(0, 0, 0, 0)
            const we = new Date(ws); we.setDate(ws.getDate() + 7)
            filter = (ev: any) => new Date(ev.startTime) < we && new Date(ev.endTime) > ws
          } else {
            const ms = new Date(cd.getFullYear(), cd.getMonth(), 1)
            const me = new Date(cd.getFullYear(), cd.getMonth() + 1, 0, 23, 59, 59, 999)
            filter = (ev: any) => new Date(ev.startTime) <= me && new Date(ev.endTime) >= ms
          }
          const visible = all.filter(filter)
          uis.clearMultiSelect()
          visible.forEach(ev => uis.toggleMultiSelect(ev.id))
        }
      }

      if (ctrl && e.key === 'c') {
        const uis = useUIStore.getState()
        const eventId = uis.selectedEventId
        if (eventId && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          store.copyEvent(eventId)
        }
      }

      if (ctrl && e.key === 'x') {
        const uis = useUIStore.getState()
        const eventId = uis.selectedEventId
        if (eventId && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          store.cutEvent(eventId)
          uis.setSelectedEvent(undefined)
        }
      }

      if (ctrl && e.key === 'v') {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          store.pasteEvent()
        }
      }

      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useEventStore.getState().undo()
        useEventGroupStore.getState().undo()
      }

      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        useEventStore.getState().redo()
        useEventGroupStore.getState().redo()
      }

      if (e.key === 'Delete' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        const uis = useUIStore.getState()
        const eventId = uis.selectedEventId
        if (eventId) {
          store.deleteEvent(eventId)
          uis.setSelectedEvent(undefined)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return null
}
