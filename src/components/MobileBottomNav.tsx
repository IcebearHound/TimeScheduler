import React from 'react'
import { CalendarDays, FolderKanban, ListTodo, Plus, Search } from 'lucide-react'
import useUIStore from '../stores/uiStore'

export default function MobileBottomNav() {
  const setViewMode = useUIStore((state) => state.setViewMode)

  const showCalendar = () => {
    const ui = useUIStore.getState()
    ui.setIsLeftSidebarOpen(false)
    ui.setIsRightPanelOpen(false)
    setViewMode('day')
  }

  return (
    <nav className="mobile-bottom-nav md:hidden" aria-label="主导航">
      <button type="button" onClick={showCalendar} className="mobile-nav-item">
        <CalendarDays className="h-5 w-5" /><span>日程</span>
      </button>
      <button type="button" onClick={() => { useUIStore.getState().setIsRightPanelOpen(false); useUIStore.getState().setIsLeftSidebarOpen(true) }} className="mobile-nav-item">
        <FolderKanban className="h-5 w-5" /><span>分组</span>
      </button>
      <button type="button" aria-label="新建事件" onClick={() => useUIStore.getState().setIsEventPanelOpen(true)} className="mobile-create-button">
        <Plus className="h-6 w-6" />
      </button>
      <button type="button" onClick={() => useUIStore.getState().setIsTodoModalOpen(true)} className="mobile-nav-item">
        <ListTodo className="h-5 w-5" /><span>待办</span>
      </button>
      <button type="button" onClick={() => useUIStore.getState().setIsSearchOpen(true)} className="mobile-nav-item">
        <Search className="h-5 w-5" /><span>搜索</span>
      </button>
    </nav>
  )
}
