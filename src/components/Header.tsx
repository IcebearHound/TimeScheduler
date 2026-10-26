import { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronDown, Download, Filter, ListTodo, PanelLeft, Plus, Redo2, Search, Settings, Sparkles, Undo2, User } from 'lucide-react'
import useUIStore from '../stores/uiStore'
import useEventStore from '../stores/eventStore'
import useCloudSyncStore from '../stores/cloudSyncStore'
import useDismissiblePanel from '../utils/useDismissiblePanel'
import EventChainFilter from './EventChainFilter'
import AccountMenuEntries from './AccountMenuEntries'

export default function Header() {
  const viewMode = useUIStore(s => s.viewMode)
  const leftOpen = useUIStore(s => s.isLeftSidebarOpen)
  const canUndo = useEventStore(s => s.canUndo), canRedo = useEventStore(s => s.canRedo)
  const login = useCloudSyncStore(s => s.login), message = useCloudSyncStore(s => s.message)
  const [userOpen, setUserOpen] = useState(false), [filterOpen, setFilterOpen] = useState(false)
  const userRef = useRef<HTMLDivElement>(null), filterRef = useRef<HTMLDivElement>(null)
  useDismissiblePanel(userRef, userOpen, () => setUserOpen(false))
  useDismissiblePanel(filterRef, filterOpen, () => setFilterOpen(false))
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!userRef.current?.contains(event.target as Node)) setUserOpen(false); if (!filterRef.current?.contains(event.target as Node)) setFilterOpen(false) }
    if (!userOpen && !filterOpen) return
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [userOpen, filterOpen])
  const history = (direction: 'undo' | 'redo') => {
    const store = useEventStore.getState()
    store[direction]()
    const after = useEventStore.getState(), reverse = direction === 'undo' ? 'redo' : 'undo'
    useUIStore.getState().addToast(`${direction === 'undo' ? '已撤销' : '已重做'}：${direction === 'undo' ? after.lastRedoAction : after.lastUndoAction}`, direction === 'undo' ? '重做' : '撤销', () => useEventStore.getState()[reverse](), after.lastAffected)
  }
  return <header className="app-header">
    <div className="flex shrink-0 items-center gap-3">
      <button className="header-icon" aria-label="分组导航" aria-expanded={leftOpen} onClick={() => useUIStore.getState().setIsLeftSidebarOpen(!leftOpen)}><PanelLeft size={18} /></button>
      <div className="flex items-center gap-2.5"><span className="brand-icon" aria-hidden="true"><Calendar size={19} /></span><span className="text-sm font-semibold tracking-tight">时间规划器</span></div>
      <div role="group" aria-label="日历视图" className="header-view-switch">
        {(['day', 'week', 'month'] as const).map((mode, index) => <button key={mode} aria-pressed={viewMode === mode} onClick={() => useUIStore.getState().setViewMode(mode)}>{['日', '周·灵活', '月'][index]}</button>)}
      </div>
    </div>
    <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
      <button aria-label="搜索日程（Ctrl+K）" className="header-search" onClick={() => useUIStore.getState().setIsSearchOpen(true)}><Search size={16} aria-hidden="true" /><span className="truncate">搜索日程、课程、日期…</span><kbd>Ctrl K</kbd></button>
      <div ref={filterRef} className="relative"><button aria-label="筛选日历" aria-expanded={filterOpen} className="header-icon" onClick={() => setFilterOpen(!filterOpen)}><Filter size={17} /></button>
        {filterOpen && <div className="absolute right-0 top-full z-[100] mt-2 min-w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-overlay dark:border-slate-700 dark:bg-slate-900"><EventChainFilter /></div>}
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-1.5">
      <button className="header-primary" onClick={() => { const ui = useUIStore.getState(); ui.setSelectedEvent(undefined); ui.clearMultiSelect(); ui.setIsEventPanelOpen(true) }}><Plus size={17} />新建</button>
      <button className="header-action" onClick={() => useUIStore.getState().setIsImportDialogOpen(true)}><Download size={16} />导入</button>
      <button className="header-action" onClick={() => useUIStore.getState().setIsTodoModalOpen(true)}><ListTodo size={16} />Todo</button>
      <button aria-label="AI / MCP" className="header-action" onClick={() => useUIStore.getState().openRightPanelTab('ai')}><Sparkles size={16} />Agent</button>
      <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
      <button className="header-icon" aria-label="撤销" title="撤销 Ctrl+Z" disabled={!canUndo} onClick={() => history('undo')}><Undo2 size={17} /></button>
      <button className="header-icon" aria-label="重做" title="重做 Ctrl+Y" disabled={!canRedo} onClick={() => history('redo')}><Redo2 size={17} /></button>
      <div ref={userRef} className="relative">
        <button aria-label="用户" aria-expanded={userOpen} className="header-account" onClick={() => setUserOpen(!userOpen)}><span className="account-avatar"><User size={15} /></span><span className="max-w-24 truncate">{login || '用户'}</span><ChevronDown size={14} /></button>
        {userOpen && <div className="absolute right-0 top-full z-[100] mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-overlay dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800"><p className="truncate text-sm font-semibold">{login || '本地用户'}</p><p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{message}</p></div>
          <AccountMenuEntries onSelect={() => setUserOpen(false)} />
          <div className="border-t border-slate-100 p-2 dark:border-slate-800"><button className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { setUserOpen(false); useUIStore.getState().setIsSettingsOpen(true) }}><Settings size={17} />设置</button></div>
        </div>}
      </div>
    </div>
  </header>
}
