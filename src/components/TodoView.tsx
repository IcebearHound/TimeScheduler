import useDismissiblePanel from '../utils/useDismissiblePanel'
import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  Pin, Star, Clock, GripVertical, ChevronDown, ChevronRight,
  RefreshCw, Settings, Layers, Link2, ListTodo, Check, ArrowUpRight, MoreHorizontal
} from 'lucide-react'
import useUIStore from '../stores/uiStore'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import { Event } from '../types/event'
import EventContextMenu from './EventContextMenu'
import { scrollToEventBlock } from '../utils/scrollTarget'
import { completionProperties, courseTaskCompleted, courseTaskKind, courseTaskStatus, courseTaskTime, sortedCourseTasks } from '../utils/courseTasks'
import CourseTaskIcon from './CourseTaskIcon'
import { buildCourseTaskSchedule } from '../utils/courseTaskSchedule'

export default function TodoView({ embedded = false, onNavigate }: { embedded?: boolean; onNavigate?: () => void }) {
  const setSelectedEvent = useUIStore((s) => s.setSelectedEvent)
  const setCurrentDate = useUIStore((s) => s.setCurrentDate)
  const setFlashEventId = useUIStore((s) => s.setFlashEventId)
  const todoHighlightDays = useUIStore((s) => s.todoHighlightDays)
  const setTodoHighlightDays = useUIStore((s) => s.setTodoHighlightDays)
  const todoUpcomingDays = useUIStore((s) => s.todoUpcomingDays)
  const setTodoUpcomingDays = useUIStore((s) => s.setTodoUpcomingDays)
  const events = useEventStore((s) => s.events)
  const eventTypes = useEventStore((s) => s.eventTypes)
  const eventChains = useEventStore((s) => s.eventChains)
  const groups = useEventGroupStore((s) => s.groups)
  const togglePinEvent = useEventStore((s) => s.togglePinEvent)
  const reorderTodo = useEventStore((s) => s.reorderTodo)
  const toggleChainIncludeInTodo = useEventStore((s) => s.toggleChainIncludeInTodo)
  const toggleGroupIncludeInTodo = useEventGroupStore((s) => s.toggleGroupIncludeInTodo)

  const eventStore = useEventStore.getState()
  const popoverCloseToken = useUIStore((s) => s.popoverCloseToken)

  const [showSettings, setShowSettings] = useState(false)
  const settingsWrapperRef = useRef<HTMLDivElement>(null)
  useDismissiblePanel(settingsWrapperRef, showSettings, () => setShowSettings(false))
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [dragId, setDragId] = useState<string | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const dragOverId = useRef<string | null>(null)
  const dragPositionRef = useRef<'above' | 'below' | null>(null)
  const [dragPosition, setDragPosition] = useState<'above' | 'below' | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ event: Event; x: number; y: number } | null>(null)
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [showAll, setShowAll] = useState(false)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const timer = window.setInterval(tick, 30000)
    window.addEventListener('focus', tick)
    return () => { clearInterval(timer); window.removeEventListener('focus', tick) }
  }, [])

  useEffect(() => { setShowSettings(false) }, [popoverCloseToken])

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

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const highlightCutoff = new Date(now.getTime() + todoHighlightDays * 24 * 60 * 60 * 1000)
  const upcomingCutoff = new Date(now.getTime() + todoUpcomingDays * 24 * 60 * 60 * 1000)

  const types = Array.from(eventTypes.values())
  const courseSchedule = useMemo(() => buildCourseTaskSchedule([...events.values()], [...eventTypes.values()], [...eventChains.values()]), [events, eventTypes, eventChains])
  const courseEvents = sortedCourseTasks(Array.from(events.values()), types).filter(e => !courseSchedule.entries.get(e.id)?.skipped)
  const allEvents = Array.from(events.values()).filter(e => !courseTaskKind(e, types))
  const isCompleted = (e: Event) => {
    const kind = courseTaskKind(e, types)
    return kind ? courseTaskCompleted(e, kind, now) : e.properties.completed === 'true'
  }

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

  // Count today and the next six local calendar days; deadlines use endTime.
  const courseStatsEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)
  const weeklyCourseEvents = courseEvents.filter(event => {
    const time = courseTaskTime(event, courseTaskKind(event, types)!)
    return time >= todayStart && time < courseStatsEnd
  })
  const statistics = [
    { key: 'events', name: '事件', scope: '当前清单', events: allTodoEvents },
    { key: 'course', name: '课程任务', scope: '近 7 天（含今天）', events: weeklyCourseEvents },
  ].map(item => ({ ...item, completed: item.events.filter(isCompleted).length }))
  const visible = (items: Event[]) => items.filter(e => filter === 'all' || isCompleted(e) === (filter === 'completed'))
  const sections = [
    { key: 'pinned', name: '置顶', icon: Pin, events: visible(pinnedEvents), empty: '把常用事项置顶，随时查看。', tone: 'text-indigo-500' },
    { key: 'highlight', name: '重点事项', icon: Star, events: visible(highlightEvents), empty: '标记星号，让重要安排更醒目。', tone: 'text-amber-500' },
    { key: 'upcoming', name: '近期安排', icon: Clock, events: visible(upcomingEvents), empty: '当前范围内暂无安排。', tone: 'text-sky-500' },
    { key: 'course', name: '课程任务 · 按时间排序', icon: ListTodo, events: visible(courseEvents), empty: '添加实验课、验收、报告、作业或考试后在此显示。', tone: 'text-indigo-500' },
  ]

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
    e.stopPropagation()
    const droppedId = dragIdRef.current
    const dropPos = dragPositionRef.current
    const targetId = dragOverId.current
    setDragId(null)
    dragIdRef.current = null
    dragPositionRef.current = null
    setDragPosition(null)
    if (!droppedId || !targetId || droppedId === targetId) return
    if ([droppedId, targetId].some(id => { const e = events.get(id); return e && courseTaskKind(e, types) })) return

    const ids = allTodoEvents.map(ev => ev.id)
    const fromIdx = ids.indexOf(droppedId)
    const toIdx = ids.indexOf(targetId)
    if (toIdx === -1) return

    // 确定目标事件所在分区，同步拖拽事件的分区状态
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

  function jumpToEvent(event: Event) {
    scrollToEventBlock(event.id)
    setFlashEventId(event.id)
    setCurrentDate(new Date(event.startTime))
    setSelectedEvent(event.id)
    onNavigate?.()
  }

  return (
    <>
    <div
      data-todo-view
      className={`${embedded ? 'min-h-64' : 'h-full'} todo-view w-full bg-slate-50/60 dark:bg-slate-900 flex flex-col overflow-hidden`}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDrop={(e) => {
        e.preventDefault()
        const evtId = dragIdRef.current || e.dataTransfer.getData('text/plain')
        if (evtId && !courseEvents.some(e => e.id === evtId)) {
          useEventStore.getState().updateEvent(evtId, { pinned: false, isHighlight: false })
        }
        setDragId(null); dragIdRef.current = null; setDragPosition(null)
      }}>
      <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700/60 flex-shrink-0"
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move' }}
        onDrop={(e) => {
          e.preventDefault(); e.stopPropagation()
          const evtId = dragIdRef.current || e.dataTransfer.getData('text/plain')
          if (evtId && !courseEvents.some(e => e.id === evtId)) {
            useEventStore.getState().updateEvent(evtId, { pinned: true })
          }
          setDragId(null); dragIdRef.current = null; setDragPosition(null)
        }}>
        <div className="min-w-0"><h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100"><ListTodo size={18} className="text-indigo-500" />待办清单</h2><p className="mt-1 text-xs text-slate-500">{now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</p></div>
        <div className="flex items-center gap-1">
          <button onClick={handleReorder} className="todo-icon-button" aria-label="一键重排" title="重排其他安排；课程任务始终按时间排序">
            <RefreshCw size={16} />
          </button>
          <div className="relative flex items-center" ref={settingsWrapperRef}>
            <button onClick={() => setShowSettings(!showSettings)} className="todo-icon-button" aria-label="Todo 设置" aria-expanded={showSettings} title="Todo 设置">
              <Settings size={16} />
            </button>
            {showSettings && (
              <div className="absolute right-0 top-full mt-1 w-60 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200/60 dark:border-slate-700/60 p-3 z-50 space-y-3" onClick={(e) => e.stopPropagation()}>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">重点事项时间范围（天）</label>
                  <input aria-label="重点事项时间范围（天）" type="number" min={1} max={365} value={todoHighlightDays}
                    onChange={e => setTodoHighlightDays(Math.min(365, Math.max(1, Number(e.target.value))))}
                    className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent-500/40" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">待办事项时间范围（天）</label>
                  <input aria-label="待办事项时间范围（天）" type="number" min={1} max={365} value={todoUpcomingDays}
                    onChange={e => setTodoUpcomingDays(Math.min(365, Math.max(1, Number(e.target.value))))}
                    className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent-500/40" />
                </div>
                <div className="border-t border-slate-200/60 dark:border-slate-600/60 pt-3">
                  <p className="mb-2 text-xs text-slate-500">课程任务列在清单底部，显示全部日期（含逾期），仅统计今天起 7 天内的任务；时间范围和来源设置仅影响其他事件。</p>
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
        </div>
      </div>

      <div className="shrink-0 space-y-3 px-3 py-3">
        <div className="grid grid-cols-2 gap-2">
          {statistics.map(item => <div key={item.key} data-todo-stats={item.key} className="min-w-0 rounded-xl border border-indigo-100 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.name}</p>
            <p className="mt-1 text-[10px] text-slate-500">{item.scope}</p>
            <p className="mt-1 text-xs text-slate-500"><strong className="mr-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{item.events.length - item.completed}</strong>待完成</p>
            <p className="mt-1 text-[10px] tabular-nums text-slate-500">已完成 {item.completed} / 共 {item.events.length} 项</p>
            <div role="progressbar" aria-label={`${item.name}完成进度`} aria-valuemin={0} aria-valuemax={item.events.length || 1} aria-valuenow={item.completed} className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${item.events.length ? item.completed / item.events.length * 100 : 0}%` }} /></div>
          </div>)}
        </div>
        <div role="group" aria-label="筛选待办状态" className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {([{ id: 'all', name: '全部' }, { id: 'pending', name: '待完成' }, { id: 'completed', name: '已完成' }] as const).map(item => <button key={item.id} aria-pressed={filter === item.id} onClick={() => { setFilter(item.id); setShowAll(false) }} className={`min-h-10 min-w-0 flex-1 rounded-lg px-1 text-xs font-medium transition-colors ${filter === item.id ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}>{item.name}</button>)}
        </div>
      </div>
      <div className={`${embedded ? '' : 'min-h-0 flex-1 overflow-y-auto'} space-y-3 px-3 pb-4`}>
        {allTodoEvents.length === 0 && courseEvents.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-700"><ListTodo size={28} className="mx-auto mb-3 text-indigo-400" /><p className="text-sm font-medium">清单里还没有安排</p><p className="mt-2 text-xs leading-relaxed text-slate-500">在日程中添加事件，或在设置里调整显示范围与来源。</p></div>}
        {sections.map(section => <section key={section.key} data-todo-section={section.key}
          onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
          onDrop={e => {
            e.preventDefault(); e.stopPropagation()
            const id = dragIdRef.current || e.dataTransfer.getData('text/plain')
            if (id && section.key !== 'course' && !courseEvents.some(e => e.id === id)) useEventStore.getState().updateEvent(id, { pinned: section.key === 'pinned', ...(section.key !== 'pinned' ? { isHighlight: section.key === 'highlight' } : {}) })
            handleDragEnd()
          }}>
          <button aria-expanded={!collapsedSections.has(section.key)} onClick={() => toggleSection(section.key)} className="flex min-h-11 w-full items-center gap-2 rounded-lg text-left text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            <section.icon size={15} className={section.tone} /><span>{section.name}</span><span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 tabular-nums text-slate-500 dark:bg-slate-800">{section.key === 'course' ? `近 7 天 ${visible(weeklyCourseEvents).length}` : section.events.length}</span>
            {collapsedSections.has(section.key) ? <ChevronRight size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
          </button>
          {!collapsedSections.has(section.key) && <div className="space-y-2">
            {section.events.length === 0 && dragId && <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs leading-relaxed text-slate-400 dark:border-slate-700">{filter === 'all' ? section.empty : '没有符合筛选条件的事项。'}</p>}
            {(section.key === 'upcoming' && !showAll ? section.events.slice(0, 10) : section.events).map(event => <TodoItem key={event.id} event={event} now={now}
              sequence={courseSchedule.entries.get(event.id)?.sequence} selected={selectedTodoId === event.id} onSelect={() => setSelectedTodoId(event.id)} onDoubleClick={() => jumpToEvent(event)}
              onTogglePin={() => togglePinEvent(event.id)} onToggleHighlight={() => handleToggleHighlight(event.id)}
              onDragStart={handleDragStart} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onDragEnd={handleDragEnd}
              onContextMenu={handleContextMenu} dragId={dragId} dragPosition={dragId && dragOverId.current === event.id ? dragPosition : null} eventStore={eventStore} />)}
            {section.key === 'upcoming' && section.events.length > 10 && <button className="min-h-11 w-full rounded-lg text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950" onClick={() => setShowAll(!showAll)}>{showAll ? '收起更多' : `展开其余 ${section.events.length - 10} 项`}</button>}
          </div>}
        </section>)}
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
    </>
  )
}

interface TodoItemProps {
  sequence?: number
  event: Event
  now: Date
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

function TodoItem({ event, now, sequence, selected, onSelect, onDoubleClick, onTogglePin, onToggleHighlight, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd, onContextMenu, dragId, dragPosition, eventStore }: TodoItemProps) {
  const type = eventStore.getEventType(event.typeId)
  const chain = eventStore.getEventChain(event.chainId)
  const kind = courseTaskKind(event, Array.from(eventStore.eventTypes.values()))
  const completed = kind ? courseTaskCompleted(event, kind, now) : event.properties.completed === 'true'
  const task = kind ? !['实验课', '考试'].includes(kind) : !!event.properties.taskKind
  const when = kind ? courseTaskTime(event, kind) : task ? new Date(event.endTime) : new Date(event.startTime)
  const status = kind ? courseTaskStatus(event, kind, now) : completed ? '已完成' : +event.endTime < +now ? (task ? '已逾期' : '已结束') : +event.startTime <= +now ? (task ? '即将截止' : '进行中') : ''

  function fmtDate(d: Date): string {
    const day = (v: Date) => Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())
    const days = Math.round((day(d) - day(now)) / 86400000)
    if (days === 0) return '今天'
    if (days === 1) return '明天'
    if (days === 2) return '后天'
    if (days === -1) return '昨天'
    return d.toLocaleDateString('zh-CN', { ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } as const : {}), month: 'numeric', day: 'numeric' })
  }

  function fmtTime(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div
      draggable={!kind}
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
      <article data-todo-event={event.id} data-completed={completed} onClick={onSelect} onDoubleClick={onDoubleClick}
        className={`todo-card ${kind === '考试' && !completed ? 'todo-exam-card' : ''} ${selected ? 'is-selected' : ''} ${completed ? 'is-completed' : ''}`}>
        <div className="flex items-start gap-2">
          <button type="button" role="checkbox" aria-checked={completed} aria-label={`${kind === '实验验收' ? '验收' : task ? '提交' : '完成'}：${event.name}`} title={completed ? '标记为待完成' : kind === '实验验收' ? '标记为已验收' : task ? '标记为已提交' : '标记为已完成'}
            onDoubleClick={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); const current = useEventStore.getState().events.get(event.id); if (current) useEventStore.getState().updateEvent(event.id, { properties: completionProperties(current, !completed, new Date(), kind === '实验课' || kind === '考试') }) }}
            className="todo-check shrink-0"><span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${completed ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300 dark:border-slate-500'}`}>{completed && <Check size={13} strokeWidth={3} />}</span></button>
          <div className="min-w-0 flex-1 py-1.5">
            {kind && <span className="mb-1 flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-300"><CourseTaskIcon kind={kind} size={12} />{kind}{sequence !== undefined ? ` · 第 ${sequence} 次` : ''}</span>}
            {kind === '考试' && !completed && +event.endTime >= +now && +event.startTime - +now <= 7 * 86400000 && <p className="mb-1 text-sm font-bold text-rose-600">{+event.startTime <= +now ? '考试正在进行' : `距考试 ${Math.ceil((+event.startTime - +now) / 3600000)} 小时`}</p>}
            <p className={`break-words text-sm font-medium leading-5 ${completed ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100'}`}>{event.name}</p>
            <p className={`mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs ${status === '已逾期' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}><Clock size={12} aria-hidden="true" /><span>{fmtDate(when)} {fmtTime(when)}{task ? ' 截止' : ` – ${fmtDate(new Date(event.endTime)) !== fmtDate(when) ? fmtDate(new Date(event.endTime)) + ' ' : ''}${fmtTime(new Date(event.endTime))}`}</span></p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]"><span className="max-w-full truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-500 dark:bg-slate-700 dark:text-slate-300" title={chain?.name || type?.name}>{type?.emoji || '📌'} {chain?.name || type?.name || '独立事件'}</span>{status && <span className={`rounded-md px-1.5 py-0.5 ${completed ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' : status === '已逾期' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>{status}</span>}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1 dark:border-slate-700" onDoubleClick={e => e.stopPropagation()}>
          {kind ? <span className="ml-2 text-[10px] text-slate-400">按{task ? '截止' : '上课'}时间排序</span> : <GripVertical size={14} aria-hidden="true" className="ml-2 cursor-grab text-slate-300 dark:text-slate-600" />}
          <div className="flex items-center gap-0.5">
            {!kind && <button className="todo-icon-button" aria-label={event.pinned ? '取消置顶' : '置顶'} aria-pressed={!!event.pinned} title={event.pinned ? '取消置顶' : '置顶'} onClick={e => { e.stopPropagation(); onTogglePin() }}><Pin size={15} className={event.pinned ? 'fill-indigo-100 text-indigo-500 dark:fill-indigo-950' : ''} /></button>}
            <button className="todo-icon-button" aria-label={event.isHighlight ? '取消重点' : '标记重点'} aria-pressed={event.isHighlight} title={event.isHighlight ? '取消重点' : '标记重点'} onClick={e => { e.stopPropagation(); onToggleHighlight() }}><Star size={15} className={event.isHighlight ? 'fill-amber-400 text-amber-400' : ''} /></button>
            <button className="todo-icon-button" aria-label={`更多操作：${event.name}`} title="更多操作" onClick={e => { e.stopPropagation(); onContextMenu(e, event) }}><MoreHorizontal size={16} /></button>
            <button className="todo-icon-button text-indigo-500" aria-label={`定位：${event.name}`} title="在日程中查看" onClick={e => { e.stopPropagation(); onDoubleClick() }}><ArrowUpRight size={17} /></button>
          </div>
        </div>
      </article>
      {dragPosition === 'below' && (
        <div className="h-0.5 bg-accent-500 mx-3 rounded pointer-events-none" />
      )}
    </div>
  )
}
