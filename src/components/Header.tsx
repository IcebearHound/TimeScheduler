import React, { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Plus, Download, Settings, Search, Undo2, Redo2, User, Filter, Sun, Moon, Monitor, BookOpen, Trash2, ChevronDown, X, Link, ListTodo, Edit2, FolderOpen, Tag } from 'lucide-react'
import useUIStore from '../stores/uiStore'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import EventChainFilter from './EventChainFilter'
import SearchDialog from './SearchDialog'
import { dialogConfirm } from '../utils/dialog'
import { Event, EventChain, EventGroup, EventType } from '../types/event'
import { scrollToEventBlock } from '../utils/scrollTarget'

export default function Header() {
  const viewMode = useUIStore((s) => s.viewMode)
  const setViewMode = useUIStore((s) => s.setViewMode)
  const setIsImportDialogOpen = useUIStore((s) => s.setIsImportDialogOpen)
  const setIsEventPanelOpen = useUIStore((s) => s.setIsEventPanelOpen)
  const selectedEventId = useUIStore((s) => s.selectedEventId)
  const isEditingEvent = !!(selectedEventId && useEventStore.getState().events.has(selectedEventId))
  const setIsTypeManagerOpen = useUIStore((s) => s.setIsTypeManagerOpen)
  const setCurrentDate = useUIStore((s) => s.setCurrentDate)
  const setSelectedEvent = useUIStore((s) => s.setSelectedEvent)
  const setFlashEventId = useUIStore((s) => s.setFlashEventId)
  const canUndo = useEventStore((s) => s.canUndo)
  const canRedo = useEventStore((s) => s.canRedo)
  const eventUndo = useEventStore((s) => s.undo)
  const eventRedo = useEventStore((s) => s.redo)
  const handleUndo = () => {
    const es = useEventStore.getState()
    if (!es.canUndo) return
    eventUndo()
    useUIStore.getState().addToast(`已撤销: ${es.lastRedoAction || '操作'}`, '重做', () => { eventRedo() }, es.lastAffected)
  }
  const handleRedo = () => {
    const es = useEventStore.getState()
    if (!es.canRedo) return
    eventRedo()
    useUIStore.getState().addToast(`已重做: ${es.lastUndoAction || '操作'}`, '撤销', () => { eventUndo() }, es.lastAffected)
  }

  const showGroupEmoji = useUIStore((s) => s.showGroupEmoji)
  const setShowGroupEmoji = useUIStore((s) => s.setShowGroupEmoji)
  const isSearchOpen = useUIStore((s) => s.isSearchOpen)
  const setIsSearchOpen = useUIStore((s) => s.setIsSearchOpen)
  const setIsTodoModalOpen = useUIStore((s) => s.setIsTodoModalOpen)
  const themeMode = useUIStore((s) => s.themeMode)
  const setThemeMode = useUIStore((s) => s.setThemeMode)
  const setIsWelcomeGuideOpen = useUIStore((s) => s.setIsWelcomeGuideOpen)
  const showDebugPanel = useUIStore((s) => s.showDebugPanel)
  const setShowDebugPanel = useUIStore((s) => s.setShowDebugPanel)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [themeExpanded, setThemeExpanded] = useState(false)
  const userMenuWrapperRef = useRef<HTMLDivElement>(null)

  // 内联搜索
  const [inlineQuery, setInlineQuery] = useState('')
  const [showInlineResults, setShowInlineResults] = useState(false)
  const inlineInputRef = useRef<HTMLInputElement>(null)
  const inlineContainerRef = useRef<HTMLDivElement>(null)

  const eventStore = useEventStore.getState()
  const allEvents = useEventStore((s) => Array.from(s.events.values()))
  const allChains = useEventStore((s) => Array.from(s.eventChains.values()))
  const allTypes = useEventStore((s) => Array.from(s.eventTypes.values()))
  const allGroups = useEventGroupStore((s) => Array.from(s.groups.values()))
  const setActiveGroup = useEventGroupStore((s) => s.setActiveGroup)

  const inlineResults = useMemo(() => {
    if (!inlineQuery.trim()) return { chains: [] as EventChain[], groups: [] as EventGroup[], types: [] as EventType[], events: [] as Event[] }
    const q = inlineQuery.toLowerCase()
    const chains = allChains.filter(c =>
      c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)
    ).slice(0, 3)
    const groups = allGroups.filter(g =>
      g.name.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q)
    ).slice(0, 3)
    const types = allTypes.filter(t =>
      t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
    ).slice(0, 3)
    const events = allEvents.filter(e => {
      const chain = eventStore.getEventChain(e.chainId)
      const type = eventStore.getEventType(e.typeId)
      if (e.name.toLowerCase().includes(q)) return true
      if ((e.description || '').toLowerCase().includes(q)) return true
      if (chain && chain.name.toLowerCase().includes(q)) return true
      if (type && type.name.toLowerCase().includes(q)) return true
      return Object.values(e.properties).some(v => String(v).toLowerCase().includes(q))
    }).slice(0, 8)
    return { chains, groups, types, events }
  }, [inlineQuery, allEvents, allChains, allTypes, allGroups])

  const hasInlineResults = inlineResults.chains.length > 0 || inlineResults.groups.length > 0 || inlineResults.types.length > 0 || inlineResults.events.length > 0

  useEffect(() => {
    if (!showUserMenu) return
    const handler = (e: MouseEvent) => {
      if (userMenuWrapperRef.current && !userMenuWrapperRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showUserMenu])

  useEffect(() => {
    if (!showInlineResults) return
    const handler = (e: MouseEvent) => {
      if (inlineContainerRef.current && !inlineContainerRef.current.contains(e.target as Node)) {
        setShowInlineResults(false)
        setInlineQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showInlineResults])

  function handleInlineSelectEvent(eventId: string) {
    useUIStore.getState().setSelectedChain(undefined)
    const e = eventStore.getEvent(eventId)
    if (!e) return
    setCurrentDate(new Date(e.startTime))
    setSelectedEvent(eventId)
    setViewMode('week')
    scrollToEventBlock(eventId)
    setFlashEventId(eventId)
    setShowInlineResults(false)
    setInlineQuery('')
  }

  function handleInlineSelectChain(chainId: string) {
    useUIStore.getState().setSelectedChain(chainId)
    const evts = eventStore.getEventsByChain(chainId)
    if (evts.length > 0) {
      setCurrentDate(new Date(evts[0].startTime))
      setSelectedEvent(evts[0].id)
      setViewMode('week')
      scrollToEventBlock(evts[0].id)
      setFlashEventId(evts[0].id)
    }
    setShowInlineResults(false)
    setInlineQuery('')
  }

  function handleInlineSelectGroup(groupId: string) {
    useUIStore.getState().setSelectedChain(undefined)
    setActiveGroup(groupId)
    setShowInlineResults(false)
    setInlineQuery('')
  }

  function handleInlineSelectType(typeId: string) {
    useUIStore.getState().setSelectedChain(undefined)
    useUIStore.getState().setTypeToEditId(typeId)
    setIsTypeManagerOpen(true)
    setShowInlineResults(false)
    setInlineQuery('')
  }

  function fmtDate(d: Date) {
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${m}/${day}`
  }

  function fmtTime(d: Date) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <header className="bg-white/90 dark:bg-slate-900/90 border-b border-slate-200/60 dark:border-slate-800/60 flex-shrink-0">
      <div className="px-4 py-2 flex items-center gap-3">
        {/* ====== 左侧区：Logo + 视图切换 ====== */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shadow-sm shadow-accent-500/25">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 tracking-tight hidden sm:inline">时间规划器</span>
          </div>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700/50" />
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            {(['day', 'week', 'month'] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  viewMode === mode ? 'bg-white dark:bg-slate-700 text-accent-600 dark:text-accent-400 shadow-sm scale-[1.02]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}>{mode === 'day' ? '日' : mode === 'week' ? '周·灵活' : '月'}</button>
            ))}
          </div>
        </div>

        {/* ====== 中间区：搜索 + 筛选 ====== */}
        <div className="flex-1 flex items-center justify-center">
          <div ref={inlineContainerRef} className="relative flex items-center w-full max-w-md">
            {showInlineResults ? (
              <input
                ref={inlineInputRef}
                type="text"
                value={inlineQuery}
                onChange={e => setInlineQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setShowInlineResults(false); setInlineQuery('') } }}
                placeholder="搜索事件、事件链、组、类型..."
                className="flex-1 h-[34px] px-3 text-sm bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 shadow-sm"
                autoFocus
              />
            ) : (
              <button onClick={() => setShowInlineResults(true)}
                className="flex items-center gap-2 px-3 h-[34px] text-sm text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow transition-all duration-200 flex-1 min-w-0">
                <Search className="w-4 h-4 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                <span className="truncate text-left">搜索事件、事件链、组、类型...</span>
              </button>
            )}
            <button onClick={() => setShowFilter(!showFilter)}
              className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-all duration-200 flex-shrink-0 ml-2 ${
                showFilter ? 'bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400 border-accent-200 dark:border-accent-700' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
              }`}>
              <Filter className="w-4 h-4" />
            </button>
            {showFilter && (
              <div className="absolute right-0 top-full mt-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-overlay border border-slate-200/60 dark:border-slate-700/60 p-3 z-[100] min-w-48" onClick={() => setShowFilter(false)}>
                <div onClick={e => e.stopPropagation()}><EventChainFilter /></div>
              </div>
            )}

            {/* 内联搜索结果 */}
            {showInlineResults && inlineQuery.trim() && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-overlay border border-slate-200/60 dark:border-slate-700/60 z-[100] overflow-hidden max-h-96 overflow-y-auto">
                {!hasInlineResults ? (
                  <div className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">没有匹配结果</div>
                ) : (
                  <>
                    {/* 事件链 */}
                    {inlineResults.chains.length > 0 && (
                      <div className="border-b border-slate-100 dark:border-slate-700/50 last:border-b-0">
                        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">事件链</p>
                        {inlineResults.chains.map(c => (
                          <button key={c.id} onClick={() => handleInlineSelectChain(c.id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left">
                            <Link className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
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
                    {inlineResults.groups.length > 0 && (
                      <div className="border-b border-slate-100 dark:border-slate-700/50 last:border-b-0">
                        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">事件组</p>
                        {inlineResults.groups.map(g => (
                          <button key={g.id} onClick={() => handleInlineSelectGroup(g.id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left">
                            <FolderOpen className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{g.emoji} {g.name}</p>
                              {g.description && <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{g.description}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 事件类型 */}
                    {inlineResults.types.length > 0 && (
                      <div className="border-b border-slate-100 dark:border-slate-700/50 last:border-b-0">
                        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">事件类型</p>
                        {inlineResults.types.map(t => (
                          <button key={t.id} onClick={() => handleInlineSelectType(t.id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left">
                            <Tag className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{t.emoji} {t.name}</p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{t.category}</p>
                            </div>
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 事件 */}
                    {inlineResults.events.length > 0 && (
                      <div>
                        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">事件</p>
                        {inlineResults.events.map(evt => {
                          const chain = eventStore.getEventChain(evt.chainId)
                          const g = allGroups.find(gr => gr.eventIds.includes(evt.id) || gr.eventChainIds.includes(evt.chainId))
                          const t = allTypes.find(et => et.id === evt.typeId)
                          const qLower = inlineQuery.toLowerCase()
                          const matchSource = evt.name.toLowerCase().includes(qLower) ? '' :
                            (chain && chain.name.toLowerCase().includes(qLower)) ? chain.name :
                            (t && t.name.toLowerCase().includes(qLower)) ? t.name :
                            Object.entries(evt.properties).find(([,v]) => String(v).toLowerCase().includes(qLower))?.[0] || ''
                          return (
                            <button key={evt.id} onClick={() => handleInlineSelectEvent(evt.id)}
                              className="w-full px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left">
                              <div className="flex items-center gap-2.5">
                                <span className="text-sm flex-shrink-0">{t?.emoji || '📌'}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{evt.name}</p>
                                    {evt.isHighlight && <span className="text-[10px] text-amber-500 flex-shrink-0">⭐</span>}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                    <span>{fmtDate(new Date(evt.startTime))} {fmtTime(new Date(evt.startTime))} ~ {fmtTime(new Date(evt.endTime))}</span>
                                    {chain && (
                                      <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: chain.color }} />
                                        <span className="truncate max-w-[120px]">{chain.name}</span>
                                      </span>
                                    )}
                                    {g && <span className="truncate max-w-[100px]">{g.emoji} {g.name}</span>}
                                  </div>
                                  {matchSource && (
                                    <div className="text-[10px] text-amber-500 dark:text-amber-400 mt-0.5 truncate">
                                      匹配: {matchSource}
                                    </div>
                                  )}
                                </div>
                                {chain && (
                                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: chain.color }} />
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ====== 右侧区：操作按钮 + 用户 ====== */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => setIsEventPanelOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent-600 hover:bg-accent-700 active:bg-accent-800 text-white rounded-lg text-sm font-medium shadow-sm shadow-accent-600/25 transition-all duration-200">
            {isEditingEvent ? <><Edit2 className="w-4 h-4" /> 编辑</> : <><Plus className="w-4 h-4" /> 新建</>}
          </button>

          <button onClick={() => setIsImportDialogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 transition-all duration-200">
            <Download className="w-4 h-4" /> 导入
          </button>

          <button onClick={() => setIsTodoModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 transition-all duration-200">
            <ListTodo className="w-4 h-4" /> Todo
          </button>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700/50 mx-1" />

          <button onClick={handleUndo} disabled={!canUndo}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200" title="撤销 Ctrl+Z">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={handleRedo} disabled={!canRedo}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200" title="重做 Ctrl+Y">
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="relative" ref={userMenuWrapperRef}>
            <button onClick={() => setShowUserMenu(!showUserMenu)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all duration-200 ${
                showUserMenu
                  ? 'bg-accent-50 dark:bg-accent-900/20 border-accent-200 dark:border-accent-700'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}>
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <User className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-200 hidden sm:inline">用户</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-modal dark:shadow-modal-dark border border-slate-200/60 dark:border-slate-700/60 z-[100] w-72 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">本地用户</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">离线模式</p>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800" />

                <div className="px-4 pt-3 pb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">管理</p>
                  <div className="space-y-0.5">
                    <button onClick={() => { setIsTypeManagerOpen(true); setShowUserMenu(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <Settings className="w-4 h-4 text-slate-400 flex-shrink-0" /> 事件类型
                    </button>
                    <button onClick={() => { setIsWelcomeGuideOpen(true); setShowUserMenu(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <BookOpen className="w-4 h-4 text-slate-400 flex-shrink-0" /> 功能导览
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 mx-4 my-1" />

                {/* 显示 */}
                <div className="px-4 py-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">显示</p>
                  <div className="space-y-0.5">
                    <div onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                        onClick={() => setThemeExpanded(!themeExpanded)}>
                        <div className="flex items-center gap-3">
                          {themeMode === 'light' ? <Sun className="w-4 h-4 text-amber-500 flex-shrink-0" />
                           : themeMode === 'dark' ? <Moon className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                           : <Monitor className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                          <div className="text-left">
                            <p className="text-sm text-slate-700 dark:text-slate-200">主题模式</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                              {themeMode === 'light' ? '当前：浅色模式' : themeMode === 'dark' ? '当前：深色模式' : '当前：跟随系统'}
                            </p>
                          </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${themeExpanded ? 'rotate-180' : ''}`} />
                      </div>
                      {themeExpanded && (
                        <div className="ml-9 mr-3 mt-1 mb-1 flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5" onClick={e => e.stopPropagation()}>
                          {([
                            { key: 'light' as const, icon: Sun },
                            { key: 'dark' as const, icon: Moon },
                            { key: 'system' as const, icon: Monitor },
                          ]).map(({ key, icon: Icon }) => (
                            <button key={key} onClick={() => setThemeMode(key)}
                              className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                                themeMode === key
                                  ? 'bg-white dark:bg-slate-700 text-accent-600 dark:text-accent-400 shadow-sm'
                                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                              }`}>
                              <Icon className="w-4 h-4" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                      onClick={() => setShowGroupEmoji(!showGroupEmoji)}>
                      <div className="flex items-center gap-3">
                        <span className="w-4 h-4 flex items-center justify-center text-sm flex-shrink-0">🎨</span>
                        <div className="text-left">
                          <p className="text-sm text-slate-700 dark:text-slate-200">事件组图标</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">侧栏显示事件组表情符号</p>
                        </div>
                      </div>
                      <div className={`w-8 h-5 rounded-full p-0.5 transition-colors duration-200 ${showGroupEmoji ? 'bg-accent-600' : 'bg-slate-200 dark:bg-slate-600'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${showGroupEmoji ? 'translate-x-3' : ''}`} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 mx-4 my-1" />

                <div className="px-4 py-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">数据</p>
                  <div className="space-y-0.5">
                    <button onClick={() => {
                      const es = useEventStore.getState(); const gs = useEventGroupStore.getState()
                      const data = { events: Array.from(es.events.entries()), eventChains: Array.from(es.eventChains.entries()), eventTypes: Array.from(es.eventTypes.entries()), groups: Array.from(gs.groups.entries()) }
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob)
                      const a = document.createElement('a'); a.href = url; a.download = '全部数据备份.json'; a.click(); URL.revokeObjectURL(url); setShowUserMenu(false)
                    }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <Download className="w-4 h-4 text-slate-400 flex-shrink-0" /> 导出全部数据
                    </button>
                    <button onClick={async () => {
                      const ok = await dialogConfirm('确定清除所有数据？此操作不可撤销。', '清除数据', 'danger')
                      if (ok) {
                        useEventStore.getState().clear()
                        useEventStore.getState().loadDefaultData()
                        localStorage.removeItem('eventGroupStore')
                        useEventGroupStore.setState({ groups: new Map(), groupOrder: [], activeGroupId: '' })
                        useEventGroupStore.getState().load()
                      }
                      setShowUserMenu(false)
                    }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                      <Trash2 className="w-4 h-4 text-red-400 flex-shrink-0" /> 清除所有数据
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 mx-4 my-1" />

                <div className="px-4 py-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">关于</p>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg">
                      <span className="text-sm text-slate-700 dark:text-slate-200">版本</span>
                      <span className="text-xs text-slate-400">v1.0beta</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                      onClick={() => setShowDebugPanel(!showDebugPanel)}>
                      <span className="text-sm text-slate-700 dark:text-slate-200">调试面板</span>
                      <div className={`w-8 h-5 rounded-full p-0.5 transition-colors duration-200 ${showDebugPanel ? 'bg-accent-600' : 'bg-slate-200 dark:bg-slate-600'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${showDebugPanel ? 'translate-x-3' : ''}`} />
                      </div>
                    </div>
                    <div className="px-3 py-1">
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">IcebearHound@gamil.com</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">QQ: 3092825040</p>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">快捷键 Ctrl+K 搜索 · Ctrl+Z/Y 撤销重做</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {isSearchOpen && createPortal(<SearchDialog onClose={() => setIsSearchOpen(false)} />, document.body)}
    </header>
  )
}
