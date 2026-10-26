import ModalShell from './ModalShell'
/**
 * 搜索对话框 - 支持按名称、属性、时间查找，支持事件链/组/类型
 */
import React, { useState, useMemo, useEffect, useRef, useDeferredValue } from 'react'
import { X, Search as SearchIcon, Star, Link, FolderOpen, Tag } from 'lucide-react'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import useUIStore from '../stores/uiStore'
import { Event, EventChain, EventGroup, EventType } from '../types/event'
import { scrollToEventBlock } from '../utils/scrollTarget'
import { parseTimeQuery, EN_TO_CN } from '../utils/searchParser'

interface SearchDialogProps {
  onClose: () => void
}

export default function SearchDialog({ onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const root = useRef<HTMLDivElement>(null)
  const events = useEventStore(s => s.events)
  const chains = useEventStore(s => s.eventChains)
  const types = useEventStore(s => s.eventTypes)
  const groups = useEventGroupStore(s => s.groups)
  const eventStore = useEventStore.getState()
  const setSelectedEvent = useUIStore((state) => state.setSelectedEvent)
  const setCurrentDate = useUIStore((state) => state.setCurrentDate)
  const setViewMode = useUIStore((state) => state.setViewMode)
  const setFlashEventId = useUIStore((state) => state.setFlashEventId)
  const setIsTypeManagerOpen = useUIStore((state) => state.setIsTypeManagerOpen)
  const setActiveGroup = useEventGroupStore((state) => state.setActiveGroup)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSelectEvent = (eventId: string) => {
    useUIStore.getState().setSelectedChain(undefined)
    const event = eventStore.getEvent(eventId)
    if (event) {
      setSelectedEvent(eventId)
      setCurrentDate(new Date(event.startTime))
      setViewMode('week')
      scrollToEventBlock(eventId)
      setFlashEventId(eventId)
      onClose()
    }
  }

  const handleSelectChain = (chainId: string) => {
    useUIStore.getState().setSelectedChain(chainId)
    const events = eventStore.getEventsByChain(chainId)
    if (events.length > 0) {
      setCurrentDate(new Date(events[0].startTime))
      setSelectedEvent(events[0].id)
      setViewMode('week')
      scrollToEventBlock(events[0].id)
      setFlashEventId(events[0].id)
    }
    onClose()
  }

  const handleSelectGroup = (groupId: string) => {
    useUIStore.getState().setSelectedChain(undefined)
    setActiveGroup(groupId)
    onClose()
  }

  const handleSelectType = (typeId: string) => {
    useUIStore.getState().setSelectedChain(undefined)
    useUIStore.getState().setTypeToEditId(typeId)
    setIsTypeManagerOpen(true)
    onClose()
  }

  const results = useMemo(() => {
    const empty = { chains: [] as EventChain[], groups: [] as EventGroup[], types: [] as EventType[], events: [] as { event: Event; source: string }[] }
    if (!deferredQuery.trim()) return empty
    const { text, dateFilter } = parseTimeQuery(deferredQuery.trim())
    const q = text.trim().toLowerCase()

    const allEvents = Array.from(events.values()).sort((a, b) => +a.startTime - +b.startTime)
    const allChains = Array.from(chains.values())
    const allGroups = Array.from(groups.values())
    const allTypes = Array.from(types.values())

    // 搜索事件链
    const matchedChains = q
      ? allChains.filter(c =>
          c.name.toLowerCase().includes(q) ||
          (c.description || '').toLowerCase().includes(q)
        ).slice(0, 4)
      : []

    // 搜索事件组
    const matchedGroups = q
      ? allGroups.filter(g =>
          g.name.toLowerCase().includes(q) ||
          (g.description || '').toLowerCase().includes(q)
        ).slice(0, 4)
      : []

    // 搜索事件类型
    const matchedTypes = q
      ? allTypes.filter(t =>
          t.name.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
        ).slice(0, 4)
      : []

    // 搜索事件
    const matchedEvents: { event: Event; source: string }[] = []
    for (const e of allEvents) {
      if (dateFilter && !dateFilter(new Date(e.startTime))) continue
      if (!q && !dateFilter) continue
      const chain = eventStore.getEventChain(e.chainId)
      const type = eventStore.getEventType(e.typeId)
      let source = ''
      if (e.name.toLowerCase().includes(q)) source = e.name
      else if (e.description && e.description.toLowerCase().includes(q)) source = e.description
      else if (chain && chain.name.toLowerCase().includes(q)) source = chain.name
      else if (type && type.name.toLowerCase().includes(q)) source = type.name
      else {
        for (const [k, v] of Object.entries(e.properties || {})) {
          if (v && String(v).toLowerCase().includes(q)) { source = `${EN_TO_CN[k] || k}: ${v}`; break }
        }
      }
      if (source) matchedEvents.push({ event: e, source })
    }

    return { chains: matchedChains, groups: matchedGroups, types: matchedTypes, events: matchedEvents.slice(0, 20) }
  }, [deferredQuery, events, chains, types, groups])

  const hasResults = results.chains.length > 0 || results.groups.length > 0 || results.types.length > 0 || results.events.length > 0

  return (
    <ModalShell title="搜索" onClose={onClose} keepHeader className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[20vh] z-50 animate-modal-backdrop">
      <div ref={root} className="bg-white dark:bg-slate-900 rounded-2xl shadow-modal dark:shadow-modal-dark border border-slate-200/60 dark:border-slate-700/60 max-w-lg w-full mx-4 animate-modal-panel" onClick={e => e.stopPropagation()} onKeyDown={e => {
        const buttons = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[data-search-results] button') || [])
        if (!buttons.length) return
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) { e.preventDefault(); buttons[0].click() }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
          const next = buttons[e.key === 'ArrowDown' ? (index + 1) % buttons.length : (index <= 0 ? buttons.length - 1 : index - 1)]
          next.focus(); next.scrollIntoView({ block: 'nearest' })
        }
      }}>
        <div className="flex items-center gap-3 p-4 border-b border-slate-200/60 dark:border-slate-700/60">
          <SearchIcon className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            aria-label="搜索日程"
            aria-controls="search-results"
            aria-describedby="search-keyboard-hint"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索事件、事件链、组、类型、日期、属性..."
            className="flex-1 bg-transparent text-slate-900 dark:text-white focus:outline-none text-lg"
            autoFocus
          />
          <button aria-label="关闭搜索" onClick={onClose} className="hidden desktop:block text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {query.trim() && (
          <div id="search-results" data-search-results className="max-h-80 overflow-y-auto p-2" aria-busy={query !== deferredQuery}>
            {!hasResults ? (
              <div role="status" className="p-6 text-center text-slate-500 dark:text-slate-400"><p className="font-medium">没有找到匹配结果</p><p className="mt-2 text-xs">试试课程名称、地点，或「明天」「本周」。</p></div>
            ) : (
              <>
                {/* 事件链 */}
                {results.chains.length > 0 && (
                  <div className="mb-2">
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">事件链</p>
                    {results.chains.map(c => (
                      <button key={c.id} onClick={() => handleSelectChain(c.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left rounded-lg">
                        <Link className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{c.name}</p>
                          {c.description && <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{c.description}</p>}
                        </div>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                      </button>
                    ))}
                  </div>
                )}

                {/* 事件组 */}
                {results.groups.length > 0 && (
                  <div className="mb-2">
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">事件组</p>
                    {results.groups.map(g => (
                      <button key={g.id} onClick={() => handleSelectGroup(g.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left rounded-lg">
                        <FolderOpen className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{g.emoji} {g.name}</p>
                          {g.description && <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{g.description}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* 事件类型 */}
                {results.types.length > 0 && (
                  <div className="mb-2">
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">事件类型</p>
                    {results.types.map(t => (
                      <button key={t.id} onClick={() => handleSelectType(t.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left rounded-lg">
                        <Tag className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{t.emoji} {t.name}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">分类: {t.category}</p>
                        </div>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                      </button>
                    ))}
                  </div>
                )}

                {/* 事件 */}
                {results.events.length > 0 && (
                  <div>
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">事件</p>
                    {results.events.map(({ event, source }) => {
                      const type = eventStore.getEventType(event.typeId)
                      return (
                        <button key={event.id} onClick={() => handleSelectEvent(event.id)}
                          className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{type?.emoji}</span>
                            <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{event.name}</span>
                            {event.isHighlight && <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 ml-7">
                            {new Date(event.startTime).toLocaleDateString('zh-CN')}{' '}
                            {new Date(event.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                            {event.properties.location && ` · ${event.properties.location}`}
                          </div>
                          {source && (
                            <div className="text-[10px] text-amber-500 dark:text-amber-400 mt-0.5 ml-7 truncate">
                              {source}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="border-t border-slate-200/60 dark:border-slate-700/60 p-3">
          <div id="search-keyboard-hint" className="text-xs text-slate-500 dark:text-slate-400 text-center">
            支持名称、地点和「今天」「本周」 · ↑↓ 选择 · Enter 打开 · Esc 关闭
          </div>
        </div>
      </div>
    </ModalShell>
  )
}
