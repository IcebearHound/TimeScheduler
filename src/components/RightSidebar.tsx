import IntegrationPanel from './IntegrationPanel'
import { useEffect, useRef } from 'react'
import { Maximize2, Minimize2, PanelRightClose } from 'lucide-react'
import useUIStore from '../stores/uiStore'
import useLayoutStore from '../stores/layoutStore'
import RightPanel from './RightPanel'
import TodoView from './TodoView'
import AssignmentPanel from './AssignmentPanel'

export default function RightSidebar() {
  const tab = useUIStore(s => s.rightPanelTab)
  const expanded = useUIStore(s => s.rightPanelExpanded)
  const selected = useUIStore(s => s.selectedEventId)
  const open = useUIStore(s => s.openRightPanelTab)
  const setExpanded = useUIStore(s => s.setRightPanelExpanded)
  const isMobile = useLayoutStore(s => s.isMobile)
  const root = useRef<HTMLDivElement>(null)
  const expandButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!expanded || isMobile) return
    const previous = document.activeElement as HTMLElement
    expandButton.current?.focus()
    const handle = (e: KeyboardEvent) => {
      if (useUIStore.getState().dialogConfig || document.querySelector('[data-mobile-sheet], .animate-modal-backdrop, [data-app-panel], #workspace-title')) return
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); setExpanded(false) }
      if (e.key === 'Tab') {
        const items = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary') || [])].filter(el => el.getClientRects().length)
        if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items[items.length - 1]?.focus() }
        if (!e.shiftKey && document.activeElement === items[items.length - 1]) { e.preventDefault(); items[0]?.focus() }
      }
    }
    window.addEventListener('keydown', handle, true)
    return () => { window.removeEventListener('keydown', handle, true); if (previous?.isConnected) previous.focus() }
  }, [expanded, isMobile, setExpanded])
  return <div ref={root} data-right-sidebar role={expanded && !isMobile ? 'dialog' : undefined} aria-modal={expanded && !isMobile ? true : undefined} aria-label="待办与课程任务" className="flex h-full min-h-0 flex-col bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-200">
    <div className="flex shrink-0 items-center gap-1 border-b p-2 dark:border-slate-700">
      <nav aria-label="右边栏栏目" className="flex min-w-0 flex-1 flex-wrap gap-1">
        <button className="sidebar-tab" aria-pressed={tab === 'todo'} onClick={() => open('todo')}>TODO</button>
        <button className="sidebar-tab" aria-pressed={tab === 'ai'} onClick={() => open('ai')}>Agent</button>
        {selected && <button className="sidebar-tab" aria-pressed={tab === 'details'} onClick={() => open('details')}>详情</button>}
      </nav>
      <button ref={expandButton} className="sidebar-panel-action" aria-label={expanded ? '退出全屏' : '全屏放大'} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
      {!isMobile && <button className="sidebar-panel-action" aria-label="收起详情面板" onClick={() => useUIStore.getState().setIsRightPanelOpen(false)}><PanelRightClose size={17} /></button>}
    </div>
    <div className="min-h-0 flex-1 overflow-hidden">
      {(tab === 'todo' || tab === 'assignments') && <div className="h-full overflow-y-auto"><div className="assignment-scroll p-3"><AssignmentPanel /></div><TodoView embedded /></div>}
      {tab === 'ai' && <IntegrationPanel />}
      {tab === 'details' && <RightPanel />}

    </div>
  </div>
}
