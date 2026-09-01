import React from 'react'
import { ChevronLeft, ChevronRight, Menu, Moon, Search, SlidersHorizontal, Sun } from 'lucide-react'
import useUIStore from '../stores/uiStore'

export default function MobileHeader() {
  const currentDate = useUIStore((state) => state.currentDate)
  const setCurrentDate = useUIStore((state) => state.setCurrentDate)
  const viewMode = useUIStore((state) => state.viewMode)
  const setViewMode = useUIStore((state) => state.setViewMode)
  const hiddenGroupIds = useUIStore((state) => state.hiddenGroupIds)
  const themeMode = useUIStore((state) => state.themeMode)
  const setThemeMode = useUIStore((state) => state.setThemeMode)

  const move = (direction: -1 | 1) => {
    const next = new Date(currentDate)
    if (viewMode === 'month') next.setMonth(next.getMonth() + direction)
    else next.setDate(next.getDate() + direction)
    setCurrentDate(next)
  }

  const title = viewMode === 'month'
    ? currentDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
    : currentDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })

  return (
    <header className="mobile-header md:hidden">
      <div className="flex h-14 items-center gap-2 px-3">
        <button type="button" aria-label="打开导航" className="mobile-icon-button" onClick={() => useUIStore.getState().setIsLeftSidebarOpen(true)}>
          <Menu className="h-5 w-5" />
        </button>
        <button type="button" aria-label="上一页" className="mobile-icon-button" onClick={() => move(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" className="min-w-0 flex-1 text-center" onClick={() => setCurrentDate(new Date())}>
          <span className="block truncate text-[15px] font-bold text-slate-900 dark:text-white">{title}</span>
          <span className="text-[10px] font-medium text-accent-600 dark:text-accent-400">轻触回到今天</span>
        </button>
        <button type="button" aria-label="下一页" className="mobile-icon-button" onClick={() => move(1)}>
          <ChevronRight className="h-5 w-5" />
        </button>
        <button type="button" aria-label="搜索" className="mobile-icon-button" onClick={() => useUIStore.getState().setIsSearchOpen(true)}>
          <Search className="h-5 w-5" />
        </button>
      </div>
      <div className="flex h-12 items-center gap-2 border-t border-slate-100/80 px-3 dark:border-slate-800/80">
        <div className="flex flex-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(['day', 'week', 'month'] as const).map(mode => (
            <button key={mode} type="button" onClick={() => setViewMode(mode)}
              className={`min-h-8 flex-1 rounded-lg text-xs font-semibold ${viewMode === mode ? 'bg-white text-accent-600 shadow-sm dark:bg-slate-700 dark:text-accent-400' : 'text-slate-500 dark:text-slate-400'}`}>
              {mode === 'day' ? '日程' : mode === 'week' ? '多日' : '月览'}
            </button>
          ))}
        </div>
        <button type="button" aria-label="筛选" className="mobile-icon-button relative" onClick={() => useUIStore.getState().setIsLeftSidebarOpen(true)}>
          <SlidersHorizontal className="h-[18px] w-[18px]" />
          {hiddenGroupIds.size > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />}
        </button>
        <button type="button" aria-label="切换明暗主题" className="mobile-icon-button bg-accent-50 text-accent-600 dark:bg-accent-900/20 dark:text-accent-400"
          onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}>
          <Sun className="h-[18px] w-[18px] dark:hidden" />
          <Moon className="hidden h-[18px] w-[18px] dark:block" />
        </button>
      </div>
    </header>
  )
}
