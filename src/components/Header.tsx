import React, { useState } from 'react'
import { Calendar, Plus, Download, Settings, Search, Undo2, Redo2, User, Filter, Sun, Moon, Monitor } from 'lucide-react'
import useUIStore from '../stores/uiStore'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import EventChainFilter from './EventChainFilter'
import SearchDialog from './SearchDialog'
import { dialogConfirm } from '../utils/dialog'

export default function Header() {
  const viewMode = useUIStore((s) => s.viewMode)
  const setViewMode = useUIStore((s) => s.setViewMode)
  const setIsImportDialogOpen = useUIStore((s) => s.setIsImportDialogOpen)
  const setIsEventPanelOpen = useUIStore((s) => s.setIsEventPanelOpen)
  const setIsTypeManagerOpen = useUIStore((s) => s.setIsTypeManagerOpen)
  const canUndo = useEventStore((s) => s.canUndo)
  const canRedo = useEventStore((s) => s.canRedo)
  const undo = useEventStore((s) => s.undo)
  const redo = useEventStore((s) => s.redo)
  const showGroupEmoji = useUIStore((s) => s.showGroupEmoji)
  const setShowGroupEmoji = useUIStore((s) => s.setShowGroupEmoji)
  const isSearchOpen = useUIStore((s) => s.isSearchOpen)
  const setIsSearchOpen = useUIStore((s) => s.setIsSearchOpen)
  const themeMode = useUIStore((s) => s.themeMode)
  const setThemeMode = useUIStore((s) => s.setThemeMode)
  const [showSettings, setShowSettings] = useState(false)
  const [showFilter, setShowFilter] = useState(false)

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0">
      <div className="px-5 py-3 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <Calendar className="w-8 h-8 text-blue-600" />
          <span className="text-base font-bold text-slate-800 dark:text-white tracking-tight">时间规划器</span>
        </div>

        {/* 分隔线 */}
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

        {/* 撤销/重做 */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={undo} disabled={!canUndo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors" title="撤销 Ctrl+Z">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={redo} disabled={!canRedo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors" title="重做 Ctrl+Y">
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* 视图切换 */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 flex-shrink-0">
          {(['day', 'week', 'month'] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === mode ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}>{mode === 'day' ? '日' : mode === 'week' ? '周·灵活' : '月'}</button>
          ))}
        </div>

        {/* 弹性空间 */}
        <div className="flex-1" />

        {/* 搜索 */}
        <div className="relative">
            <button onClick={() => setIsSearchOpen(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-all min-w-[120px]">
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">搜索</span>
            <span className="text-[10px] text-slate-300 ml-auto hidden sm:inline">Ctrl+F</span>
          </button>
        </div>

        {/* 筛选 */}
        <div className="relative">
          <button onClick={() => setShowFilter(!showFilter)}
            className={`p-2 rounded-lg transition-colors ${showFilter ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
            <Filter className="w-4 h-4" />
          </button>
          {showFilter && (
            <div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-3 z-50 min-w-48" onClick={() => setShowFilter(false)}>
              <div onClick={e => e.stopPropagation()}><EventChainFilter /></div>
            </div>
          )}
        </div>

        {/* 新建 */}
        <button onClick={() => setIsEventPanelOpen(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-blue-600/20 flex-shrink-0">
          <Plus className="w-4 h-4" /> 新建
        </button>

        {/* 导入 */}
        <button onClick={() => setIsImportDialogOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors flex-shrink-0">
          <Download className="w-4 h-4" /> 导入
        </button>

        {/* 用户 */}
        <div className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer flex-shrink-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        {/* 设置 */}
        <div className="relative flex-shrink-0">
          <button onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <Settings className="w-4 h-4" />
          </button>
          {showSettings && (
            <div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 min-w-44 overflow-hidden">
              <button onClick={() => { setIsTypeManagerOpen(true); setShowSettings(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">管理事件类型</button>
              <button onClick={() => { setThemeMode(themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'system' : 'light') }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2">
                {themeMode === 'light' ? <Sun className="w-4 h-4" /> : themeMode === 'dark' ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                {themeMode === 'light' ? '浅色模式' : themeMode === 'dark' ? '深色模式' : '跟随系统'}
              </button>
              <button onClick={() => { setShowGroupEmoji(!showGroupEmoji); setShowSettings(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">{showGroupEmoji ? '✓ ' : ''}显示事件组emoji</button>
              <div className="border-t border-slate-100 dark:border-slate-700" />
              <button onClick={() => {
                const es = useEventStore.getState(); const gs = useEventGroupStore.getState()
                const data = { events: Array.from(es.events.entries()), eventChains: Array.from(es.eventChains.entries()), eventTypes: Array.from(es.eventTypes.entries()), groups: Array.from(gs.groups.entries()) }
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob)
                const a = document.createElement('a'); a.href = url; a.download = '全部数据备份.json'; a.click(); URL.revokeObjectURL(url); setShowSettings(false)
              }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">导出全部数据</button>
              <button onClick={async () => {
                const ok = await dialogConfirm('确定清除所有数据？', '清除数据', 'danger')
                if (ok) {
                  useEventStore.getState().clear()
                  useEventStore.getState().loadDefaultData()
                  localStorage.removeItem('eventGroupStore')
                  useEventGroupStore.setState({ groups: new Map(), groupOrder: [], activeGroupId: '' })
                  useEventGroupStore.getState().load()
                }
                setShowSettings(false)
              }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">清除所有数据</button>
            </div>
          )}
        </div>
      </div>
      {isSearchOpen && <SearchDialog onClose={() => setIsSearchOpen(false)} />}
    </header>
  )
}
