import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, User, Settings, CalendarDays } from 'lucide-react'
import useUIStore from '../stores/uiStore'
import AccountMenuEntries from './AccountMenuEntries'
import useCloudSyncStore from '../stores/cloudSyncStore'

export default function MobileHeader() {
  const cloudLogin = useCloudSyncStore(s => s.login), cloudMessage = useCloudSyncStore(s => s.message)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const ui = useUIStore()
  useEffect(() => {
    if (!showUserMenu) return
    const click = (e: PointerEvent) => { if (!userMenuRef.current?.contains(e.target as Node)) setShowUserMenu(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowUserMenu(false) }
    document.addEventListener('pointerdown', click); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', click); document.removeEventListener('keydown', key) }
  }, [showUserMenu])
  const move = (direction: number) => {
    const next = new Date(ui.currentDate)
    if (ui.viewMode === 'month') { next.setDate(1); next.setMonth(next.getMonth() + direction) }
    else next.setDate(next.getDate() + direction * (ui.viewMode === 'week' ? ui.calendarDayCount : 1))
    ui.setCurrentDate(next)
  }
  const dateValue = `${ui.currentDate.getFullYear()}-${String(ui.currentDate.getMonth()+1).padStart(2, '0')}-${String(ui.currentDate.getDate()).padStart(2, '0')}`
  return <header className="mobile-header">
    <div className="flex h-14 items-center gap-1 px-2">
      <button aria-label="上一页" className="mobile-icon-button" onClick={() => move(-1)}><ChevronLeft size={20} /></button>
      <button aria-label="回到今天" className="min-w-0 flex-1 text-center" onClick={() => ui.setCurrentDate(new Date())}><span className="block truncate text-sm font-bold">{ui.currentDate.toLocaleDateString('zh-CN', ui.viewMode === 'month' ? { year: 'numeric', month: 'long' } : { month: 'long', day: 'numeric', weekday: 'short' })}</span><span className="text-[10px] text-slate-500">轻触回到今天</span></button>
      <button aria-label="下一页" className="mobile-icon-button" onClick={() => move(1)}><ChevronRight size={20} /></button>
      <button aria-label="搜索" className="mobile-icon-button" onClick={() => ui.setIsSearchOpen(true)}><Search size={20} /></button>
      <div ref={userMenuRef} className="relative">
        <button aria-label="用户" aria-expanded={showUserMenu} className="mobile-icon-button" onClick={() => setShowUserMenu(!showUserMenu)}><User size={20} /></button>
        {showUserMenu && <div className="absolute right-0 top-full z-[100] mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b px-4 py-3 dark:border-slate-700"><p className="truncate text-sm font-medium">{cloudLogin || '本地用户'}</p><p className="mt-1 text-xs text-slate-500">{cloudMessage}</p></div>
          <AccountMenuEntries onSelect={() => setShowUserMenu(false)} />
          <div className="border-t p-2 dark:border-slate-700"><button className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm" onClick={() => { setShowUserMenu(false); ui.setIsSettingsOpen(true) }}><Settings size={18} />设置</button></div>
        </div>}
      </div>
    </div>
    <div className="flex h-12 items-center gap-2 border-t border-slate-100 px-3 dark:border-slate-800">
      <div className="flex flex-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="日历视图">
        {(['day', 'week', 'month'] as const).map((mode, i) => <button key={mode} aria-pressed={ui.viewMode === mode} onClick={() => ui.setViewMode(mode)} className={`min-h-8 flex-1 rounded-lg text-xs font-semibold ${ui.viewMode === mode ? 'bg-white text-accent-600 shadow-sm dark:bg-slate-700' : 'text-slate-500'}`}>{['日程', '多日', '月览'][i]}</button>)}
      </div>
      <label className="mobile-icon-button relative" title="选择日期"><CalendarDays size={20} /><input aria-label="选择日期" type="date" value={dateValue} className="absolute inset-0 w-full opacity-0" onChange={e => { if (e.target.value) ui.setCurrentDate(new Date(e.target.value + 'T12:00:00')) }} /></label>
    </div>
  </header>
}
