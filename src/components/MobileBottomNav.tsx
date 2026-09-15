import { FolderKanban, ListTodo, Plus, BookOpen, Grid2X2 } from 'lucide-react'
import useUIStore from '../stores/uiStore'
import useWorkspaceStore from '../stores/workspaceStore'

export default function MobileBottomNav() {
  const ui = useUIStore()
  const resetPanels = () => { ui.setIsLeftSidebarOpen(false); ui.setIsRightPanelOpen(false) }
  return <nav className="mobile-bottom-nav" aria-label="主导航">
    <button aria-pressed={ui.isLeftSidebarOpen} onClick={() => { ui.setIsRightPanelOpen(false); ui.setIsLeftSidebarOpen(!ui.isLeftSidebarOpen) }} className="mobile-nav-item"><FolderKanban size={20} /><span>分组</span></button>
    <button onClick={() => { resetPanels(); ui.setIsTodoModalOpen(true) }} className="mobile-nav-item"><ListTodo size={20} /><span>待办</span></button>
    <button aria-label="新建事件" onClick={() => { resetPanels(); ui.setSelectedEvent(undefined); ui.clearMultiSelect(); ui.setIsEventPanelOpen(true) }} className="mobile-create-button"><Plus size={24} /></button>
    <button aria-label="课程作业 / 实验" onClick={() => { resetPanels(); useWorkspaceStore.getState().open('assignments') }} className="mobile-nav-item"><BookOpen size={20} /><span>课程</span></button>
    <button onClick={() => { resetPanels(); ui.setIsMobileToolsOpen(true) }} className="mobile-nav-item"><Grid2X2 size={20} /><span>工具</span></button>
  </nav>
}
