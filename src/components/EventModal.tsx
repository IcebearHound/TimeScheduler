import React, { useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import useUIStore from '../stores/uiStore'
import useEventStore from '../stores/eventStore'
import EventForm from './EventForm/EventForm'

export default function EventModal() {
  const isOpen = useUIStore((s) => s.isEventPanelOpen)
  const setIsOpen = useUIStore((s) => s.setIsEventPanelOpen)
  const selectedEventId = useUIStore((s) => s.selectedEventId)
  const setSelectedEvent = useUIStore((s) => s.setSelectedEvent)

  const eventStore = useEventStore.getState()
  const event = selectedEventId ? eventStore.getEvent(selectedEventId) : undefined

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setSelectedEvent(undefined)
  }, [setIsOpen, setSelectedEvent])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, handleClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-modal-backdrop" onClick={handleClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-modal dark:shadow-modal-dark border border-slate-200/60 dark:border-slate-700/60 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-200/60 dark:border-slate-700/60 sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {event ? '编辑事件' : '新建事件'}
          </h2>
          <button onClick={handleClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6">
          <EventForm eventId={selectedEventId} onClose={handleClose} />
        </div>
      </div>
    </div>
  )
}
