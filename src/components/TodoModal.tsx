import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { X, Pin, Star, Clock, GripVertical, ChevronDown, ChevronRight, RefreshCw, Settings, Layers, Link2 } from 'lucide-react'
import useUIStore from '../stores/uiStore'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import { Event } from '../types/event'
import EventContextMenu from './EventContextMenu'
import { scrollToEventBlock } from '../utils/scrollTarget'

interface TodoModalProps {
  onClose: () => void
}

export default function TodoModal({ onClose }: TodoModalProps) {
  const setSelectedEvent = useUIStore((s) => s.setSelectedEvent)
  const setCurrentDate = useUIStore((s) => s.setCurrentDate)
  const setFlashEventId = useUIStore((s) => s.setFlashEventId)
  const todoHighlightDays = useUIStore((s) => s.todoHighlightDays)
  const setTodoHighlightDays = useUIStore((s) => s.setTodoHighlightDays)
  const todoUpcomingDays = useUIStore((s) => s.todoUpcomingDays)
  const setTodoUpcomingDays = useUIStore((s) => s.setTodoUpcomingDays)
  const events = useEventStore((s) => s.events)
  const eventChains = useEventStore((s) => s.eventChains)
  const groups = useEventGroupStore((s) => s.groups)
  const togglePinEvent = useEventStore((s) => s.togglePinEvent)
  const reorderTodo = useEventStore((s) => s.reorderTodo)
  const toggleChainIncludeInTodo = useEventStore((s) => s.toggleChainIncludeInTodo)
  const toggleGroupIncludeInTodo = useEventGroupStore((s) => s.toggleGroupIncludeInTodo)

  const eventStore = useEventStore.getState()

  const [showSettings, setShowSettings] = useState(false)
  const settingsWrapperRef = useRef<HTMLDivElement>(null)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [dragId, setDragId] = useState<string | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const dragOverId = useRef<string | null>(null)
  const dragPositionRef = useRef<'above' | 'below' | null>(null)
  const [dragPosition, setDragPosition] = useState<'above' | 'below' | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ event: Event; x: number; y: number } | null>(null)
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null)

  // 点击外部关闭设置菜单
  useEffect(() => {
    if (!showSettings) return
    const handler = (e: MouseEvent) => {
      if (settingsWrapperRef.current && !settingsWrapperRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSettings])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const highlightCutoff = new Date(now.getTime() + todoHighlightDays * 24 * 60 * 60 * 1000)
  const upcomingCutoff = new Date(now.getTime() + todoUpcomingDays * 24 * 60 * 60 * 1000)

  const allEvents = Array.from(events.values())

  function isInTodo(event: Event): boolean {
    if (event.pinned) return true
    if (event.isHighlight && event.startTime <= highlightCutoff) return true
    if (event.startTime > upcomingCutoff) return false
    const chain = eventChains.get(event.chainId)
    if (chain && chain.includeInTodo === false) return false
    const group = Array.from(groups.values()).find(g => g.eventIds.includes(event.id) || g.eventChainIds.includes(event.chainId))
    if (group && group.includeInTodo === false) return false
    return true
  }

  const pinnedEvents = useMemo(() =>
    allEvents.filter(e => e.pinned).sort((a, b) => {
      if (a.todoOrder !== undefined && b.todoOrder !== undefined) return a.todoOrder - b.todoOrder
      if (a.todoOrder !== undefined) return -1
      if (b.todoOrder !== undefined) return 1
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    }),
  [allEvents])

  const highlightEvents = useMemo(() =>
    allEvents.filter(e =>
      !e.pinned && e.isHighlight && e.startTime >= todayStart && e.startTime <= highlightCutoff
    ).sort((a, b) => {
      if (a.todoOrder !== undefined && b.todoOrder !== undefined) return a.todoOrder - b.todoOrder
      if (a.todoOrder !== undefined) return -1
      if (b.todoOrder !== undefined) return 1
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    }),
  [allEvents, highlightCutoff])

  const upcomingEvents = useMemo(() =>
    allEvents.filter(e =>
      !e.pinned && !e.isHighlight &&
      e.startTime >= todayStart && e.startTime <= upcomingCutoff &&
      isInTodo(e)
    ).sort((a, b) => {
      if (a.todoOrder !== undefined && b.todoOrder !== undefined) return a.todoOrder - b.todoOrder
      if (a.todoOrder !== undefined) return -1
      if (b.todoOrder !== undefined) return 1
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    }),
  [allEvents, upcomingCutoff])

  const allTodoEvents = useMemo(() => {
    const seen = new Set<string>()
    const result: Event[] = []
    for (const e of [...pinnedEvents, ...highlightEvents, ...upcomingEvents]) {
      if (!seen.has(e.id)) { seen.add(e.id); result.push(e) }
    }
    return result
  }, [pinnedEvents, highlightEvents, upcomingEvents])

  function handleReorder() {
    const ids = [...pinnedEvents, ...highlightEvents, ...upcomingEvents].map(e => e.id)
    reorderTodo(ids)
  }

  function toggleSection(key: string) {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleDragStart(e: React.DragEvent, eventId: string) {
    setDragId(eventId)
    dragIdRef.current = eventId
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', eventId)
  }

  function handleDragOver(e: React.DragEvent, eventId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    dragOverId.current = eventId
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mid = rect.top + rect.height / 2
    const pos = e.clientY < mid ? 'above' : 'below'
    dragPositionRef.current = pos
    setDragPosition(pos)
  }

  function handleDragLeave(e: React.DragEvent) {
    const rel = e.relatedTarget as Node | null
    if (!rel || e.currentTarget.contains(rel)) return
    dragOverId.current = null
    dragPositionRef.current = null
    setDragPosition(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const droppedId = dragIdRef.current
    const dropPos = dragPositionRef.current
    const targetId = dragOverId.current
    setDragId(null)
    dragIdRef.current = null
    dragPositionRef.current = null
    setDragPosition(null)
    if (!droppedId || !targetId || droppedId === targetId) return

    const ids = allTodoEvents.map(ev => ev.id)
    const fromIdx = ids.indexOf(droppedId)
    const toIdx = ids.indexOf(targetId)
    if (toIdx === -1) return

    const targetEvent = eventStore.getEvent(targetId)
    if (targetEvent) {
      if (targetEvent.pinned) {
        useEventStore.getState().updateEvent(droppedId, { pinned: true })
      } else if (targetEvent.isHighlight) {
        useEventStore.getState().updateEvent(droppedId, { isHighlight: true, pinned: false })
      } else {
        useEventStore.getState().updateEvent(droppedId, { pinned: false, isHighlight: false })
      }
    }

    const newIds = [...ids]
    if (fromIdx !== -1) newIds.splice(fromIdx, 1)
    const insertIdx = dropPos === 'below'
      ? (toIdx >= fromIdx ? toIdx : toIdx + 1)
      : (toIdx > fromIdx ? toIdx - 1 : toIdx)
    newIds.splice(Math.max(0, fromIdx === -1 ? toIdx + (dropPos === 'below' ? 1 : 0) : insertIdx), 0, droppedId)

    requestAnimationFrame(() => {
      reorderTodo(newIds)
    })
  }

  function handleDragEnd() {
    setDragId(null)
    dragIdRef.current = null
    dragPositionRef.current = null
    setDragPosition(null)
  }

  function handleToggleHighlight(eventId: string) {
    const ev = eventStore.getEvent(eventId)
    if (ev) useEventStore.getState().updateEvent(eventId, { isHighlight: !ev.isHighlight })
  }

  function handleContextMenu(e: React.MouseEvent, event: Event) {
    e.preventDefault()
    setCtxMenu({ event, x: e.clientX, y: e.clientY })
  }

  function handleSelectEvent(eventId: string, eventDate: Date) {
    scrollToEventBlock(eventId)
    setFlashEventId(eventId)
    setCurrentDate(eventDate)
    setSelectedEvent(eventId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-modal-backdrop" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-modal dark:shadow-modal-dark border border-slate-200/60 dark:border-slate-700/60 overflow-hidden flex flex-col animate-modal-panel"
        style={{ width: '90vw', height: '90vh', maxWidth: '800px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-slate-700/60 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">待办事项</h2>
            <span className="text-xs text-slate-400">{pinnedEvents.length + highlightEvents.length + upcomingEvents.length} 项</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleReorder} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded text-slate-400" title="一键重排">
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="relative flex items-center" ref={settingsWrapperRef}>
              <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded text-slate-400" title="设置">
                <Settings className="w-4 h-4" />
              </button>
              {showSettings && (
                <div className="absolute right-0 top-full mt-1 w-60 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200/60 dark:border-slate-700/60 p-3 z-50 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">重点事项时间范围（天）</label>
                    <input type="number" min={1} max={365} value={todoHighlightDays}
                      onChange={e => setTodoHighlightDays(Math.max(1, Number(e.target.value)))}
                      className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent-500/40" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">待办事项时间范围（天）</label>
                    <input type="number" min={1} max={365} value={todoUpcomingDays}
                      onChange={e => setTodoUpcomingDays(Math.max(1, Number(e.target.value)))}
                      className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent-500/40" />
                  </div>
                  <div className="border-t border-slate-200/60 dark:border-slate-600/60 pt-3">
                    <p className="text-[10px] text-slate-400 mb-1.5">Todo 来源</p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      <div>
                        <p className="text-[10px] text-slate-400 px-0.5 mb-0.5 flex items-center gap-1"><Layers className="w-2.5 h-2.5" /> 事件组</p>
                        {Array.from(groups.values()).map(g => (
                          <label key={g.id} className="flex items-center gap-2 px-0.5 py-0.5 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded">
                            <input type="checkbox" checked={g.includeInTodo !== false}
                              onChange={() => toggleGroupIncludeInTodo(g.id)} className="w-3 h-3" />
                            <span className="text-slate-600 dark:text-slate-400 truncate">{g.emoji} {g.name}</span>
                          </label>
                        ))}
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 px-0.5 mb-0.5 flex items-center gap-1"><Link2 className="w-2.5 h-2.5" /> 事件链</p>
                        {Array.from(eventChains.values()).map(c => (
                          <label key={c.id} className="flex items-center gap-2 px-0.5 py-0.5 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded">
                            <input type="checkbox" checked={c.includeInTodo !== false}
                              onChange={() => toggleChainIncludeInTodo(c.id)} className="w-3 h-3" />
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                            <span className="text-slate-600 dark:text-slate-400 truncate">{c.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto"
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
          onDrop={(e) => {
            e.preventDefault()
            const evtId = dragIdRef.current || e.dataTransfer.getData('text/plain')
            if (evtId) {
              useEventStore.getState().updateEvent(evtId, { pinned: false, isHighlight: false })
            }
            setDragId(null); dragIdRef.current = null; setDragPosition(null)
          }}>
          {/* Pinned */}
          <div className="border-b border-slate-100 dark:border-slate-800"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation()
              const evtId = dragIdRef.current
              if (evtId) {
                useEventStore.getState().updateEvent(evtId, { pinned: true })
              }
              setDragId(null); dragIdRef.current = null; setDragPosition(null)
            }}>
            <button onClick={() => toggleSection('pinned')}
              className="flex items-center gap-2 w-full px-5 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50">
              {collapsedSections.has('pinned') ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <Pin className="w-4 h-4" /> 置顶 ({pinnedEvents.length})
            </button>
            {!collapsedSections.has('pinned') && (
              <div className="px-4 pb-2 min-h-[2rem]">
                {pinnedEvents.length === 0 && (
                  <p className="text-sm text-slate-400 px-3 py-2">拖拽事件到此处置顶</p>
                )}
                {pinnedEvents.map(event => (
                  <TodoItem key={event.id} event={event}
                    selected={selectedTodoId === event.id}
                    onSelect={() => setSelectedTodoId(event.id)}
                    onDoubleClick={() => handleSelectEvent(event.id, new Date(event.startTime))}
                    onTogglePin={() => togglePinEvent(event.id)}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    onContextMenu={handleContextMenu}
                    onToggleHighlight={() => handleToggleHighlight(event.id)}
                    dragId={dragId}
                    dragPosition={dragId && dragOverId.current === event.id ? dragPosition : null}
                    eventStore={eventStore} />
                ))}
              </div>
            )}
          </div>

          {/* Highlight */}
          <div className="border-b border-slate-100 dark:border-slate-800"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation()
              const evtId = dragIdRef.current
              if (evtId) {
                useEventStore.getState().updateEvent(evtId, { isHighlight: true, pinned: false })
              }
              setDragId(null); dragIdRef.current = null; setDragPosition(null)
            }}>
            <button onClick={() => toggleSection('highlight')}
              className="flex items-center gap-2 w-full px-5 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50">
              {collapsedSections.has('highlight') ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <Star className="w-4 h-4 text-yellow-500" /> 重点事项 ({highlightEvents.length})
            </button>
            {!collapsedSections.has('highlight') && (
              <div className="px-4 pb-2 min-h-[2rem]">
                {highlightEvents.length === 0 && (
                  <p className="text-sm text-slate-400 px-3 py-2">拖拽事件到此设置重点事项</p>
                )}
                {highlightEvents.map(event => (
                  <TodoItem key={event.id} event={event}
                    selected={selectedTodoId === event.id}
                    onSelect={() => setSelectedTodoId(event.id)}
                    onDoubleClick={() => handleSelectEvent(event.id, new Date(event.startTime))}
                    onTogglePin={() => togglePinEvent(event.id)}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    onContextMenu={handleContextMenu}
                    onToggleHighlight={() => handleToggleHighlight(event.id)}
                    dragId={dragId}
                    dragPosition={dragId && dragOverId.current === event.id ? dragPosition : null}
                    eventStore={eventStore} />
                ))}
              </div>
            )}
          </div>

          {/* Upcoming */}
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation()
              const evtId = dragIdRef.current
              if (evtId) {
                useEventStore.getState().updateEvent(evtId, { isHighlight: false, pinned: false })
              }
              setDragId(null); dragIdRef.current = null; setDragPosition(null)
            }}>
            <button onClick={() => toggleSection('upcoming')}
              className="flex items-center gap-2 w-full px-5 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50">
              {collapsedSections.has('upcoming') ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <Clock className="w-4 h-4" /> 待办事项 ({upcomingEvents.length})
            </button>
            {!collapsedSections.has('upcoming') && (
              <div className="px-4 pb-2 min-h-[2rem]">
                {upcomingEvents.length === 0 && (
                  <p className="text-sm text-slate-400 px-3 py-2">拖拽事件到此归入待办</p>
                )}
                {upcomingEvents.map(event => (
                  <TodoItem key={event.id} event={event}
                    selected={selectedTodoId === event.id}
                    onSelect={() => setSelectedTodoId(event.id)}
                    onDoubleClick={() => handleSelectEvent(event.id, new Date(event.startTime))}
                    onTogglePin={() => togglePinEvent(event.id)}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    onContextMenu={handleContextMenu}
                    onToggleHighlight={() => handleToggleHighlight(event.id)}
                    dragId={dragId}
                    dragPosition={dragId && dragOverId.current === event.id ? dragPosition : null}
                    eventStore={eventStore} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {ctxMenu && (
        <EventContextMenu event={ctxMenu.event} position={{ x: ctxMenu.x, y: ctxMenu.y }}
          onClose={() => setCtxMenu(null)}
          onEdit={() => {
            useUIStore.getState().setSelectedEvent(ctxMenu.event.id)
            useUIStore.getState().setIsEventPanelOpen(true)
            setCtxMenu(null)
          }} />
      )}
    </div>
  )
}

interface TodoItemProps {
  event: Event
  selected: boolean
  onSelect: () => void
  onDoubleClick: () => void
  onTogglePin: () => void
  onToggleHighlight: () => void
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragOver: (e: React.DragEvent, id: string) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
  onContextMenu: (e: React.MouseEvent, event: Event) => void
  dragId: string | null
  dragPosition: 'above' | 'below' | null
  eventStore: ReturnType<typeof useEventStore.getState>
}

function TodoItem({ event, selected, onSelect, onDoubleClick, onTogglePin, onToggleHighlight, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd, onContextMenu, dragId, dragPosition, eventStore }: TodoItemProps) {
  const type = eventStore.getEventType(event.typeId)
  const chain = eventStore.getEventChain(event.chainId)
  const isDragging = dragId === event.id

  function fmtDate(d: Date): string {
    const now = new Date()
    const diff = d.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return '今天'
    if (days === 1) return '明天'
    if (days === 2) return '后天'
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  function fmtTime(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        onDragStart(e, event.id);
        (e.currentTarget as HTMLElement).style.opacity = '0.4'
      }}
      onDragOver={(e) => onDragOver(e, event.id)}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={(e) => {
        onDragEnd();
        (e.currentTarget as HTMLElement).style.opacity = ''
      }}
      onContextMenu={(e) => onContextMenu(e, event)}
      className="relative"
    >
      {dragPosition === 'above' && (
        <div className="h-0.5 bg-accent-500 mx-3 rounded pointer-events-none" />
      )}
      <div onClick={onSelect}
        onDoubleClick={onDoubleClick}
        className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded mx-1 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 ${event.isHighlight ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''} ${selected ? 'ring-2 ring-accent-400 bg-accent-50 dark:bg-accent-900/20' : ''}`}>
        <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0 cursor-grab" />
        <button onClick={e => { e.stopPropagation(); onTogglePin() }}
          className={`flex-shrink-0 ${event.pinned ? 'text-accent-500' : 'text-slate-300 hover:text-slate-500'}`}>
          <Pin className="w-3.5 h-3.5" />
        </button>
        <span className="text-base flex-shrink-0">{type?.emoji || '📌'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{event.name}</p>
          <p className="text-xs text-slate-400">
            {fmtDate(new Date(event.startTime))} {fmtTime(new Date(event.startTime))} ~ {fmtTime(new Date(event.endTime))}
            {chain && <span className="ml-1">· {chain.name}</span>}
          </p>
        </div>
        <button onClick={e => { e.stopPropagation(); onToggleHighlight() }}
          className={`flex-shrink-0 ml-auto ${event.isHighlight ? 'text-yellow-400' : 'text-slate-300 hover:text-yellow-400'}`}>
          <Star className={`w-4 h-4 ${event.isHighlight ? 'fill-yellow-400' : ''}`} />
        </button>
      </div>
      {dragPosition === 'below' && (
        <div className="h-0.5 bg-accent-500 mx-3 rounded pointer-events-none" />
      )}
    </div>
  )
}
