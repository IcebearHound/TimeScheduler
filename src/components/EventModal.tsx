import React, { useState } from 'react'
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

  if (!isOpen) return null

  const handleClose = () => {
    setIsOpen(false)
    setSelectedEvent(undefined)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {event ? '编辑事件' : '新建事件'}
          </h2>
          <button onClick={handleClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
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
