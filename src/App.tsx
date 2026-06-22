import React, { useEffect, useState, useRef, useCallback } from 'react'
import useEventStore from './stores/eventStore'
import useEventGroupStore from './stores/eventGroupStore'
import useUIStore from './stores/uiStore'
import Header from './components/Header'
import TimeTable from './components/TimeTable'
import LeftSidebar from './components/LeftSidebar'
import RightPanel from './components/RightPanel'
import EventModal from './components/EventModal'
import CourseImportModal from './components/CourseImportModal'
import ConflictDialog from './components/ConflictDialog'
import TypeManagerModal from './components/TypeManagerModal'
import DialogModal from './components/DialogModal'
import ToastContainer from './components/ToastContainer'
import DebugOverlay from './components/DebugOverlay'
import KeyboardShortcuts from './components/KeyboardShortcuts'
import WelcomeGuide from './components/WelcomeGuide'
import NotificationPermissionPrompt from './components/NotificationPermissionPrompt'
import TodoModal from './components/TodoModal'
import { PanelLeftOpen, PanelRightOpen } from 'lucide-react'
import { getReminderMilliseconds } from './utils/eventUtils'

export default function App() {
  const [initialized, setInitialized] = useState(false)
  const isConflictDialogOpen = useUIStore((s) => s.isConflictDialogOpen)
  const setIsConflictDialogOpen = useUIStore((s) => s.setIsConflictDialogOpen)
  const conflictConflicts = useUIStore((s) => s.conflictConflicts)
  const setConflictConflicts = useUIStore((s) => s.setConflictConflicts)
  const isTypeManagerOpen = useUIStore((s) => s.isTypeManagerOpen)
  const setIsTypeManagerOpen = useUIStore((s) => s.setIsTypeManagerOpen)
  const typeToEditId = useUIStore((s) => s.typeToEditId)
  const isLeftSidebarOpen = useUIStore((s) => s.isLeftSidebarOpen)
  const setIsLeftSidebarOpen = useUIStore((s) => s.setIsLeftSidebarOpen)
  const isRightPanelOpen = useUIStore((s) => s.isRightPanelOpen)
  const setIsRightPanelOpen = useUIStore((s) => s.setIsRightPanelOpen)
  const dialogConfig = useUIStore((s) => s.dialogConfig)
  const closeDialog = useUIStore((s) => s.closeDialog)
  const isWelcomeGuideOpen = useUIStore((s) => s.isWelcomeGuideOpen)
  const setIsWelcomeGuideOpen = useUIStore((s) => s.setIsWelcomeGuideOpen)
  const isNotificationPromptOpen = useUIStore((s) => s.isNotificationPromptOpen)
  const setIsNotificationPromptOpen = useUIStore((s) => s.setIsNotificationPromptOpen)
  const isTodoModalOpen = useUIStore((s) => s.isTodoModalOpen)
  const setIsTodoModalOpen = useUIStore((s) => s.setIsTodoModalOpen)
  const showDebugPanel = useUIStore((s) => s.showDebugPanel)
  const groupSize = useEventGroupStore((s) => s.groups.size)
  const activeId = useEventGroupStore((s) => s.activeGroupId)
  const sideKey = `${groupSize}-${activeId || 'none'}`

  // 边栏展开/折叠动画状态（延迟卸载以完成关闭动画）
  const [leftRender, setLeftRender] = useState(isLeftSidebarOpen)
  const [rightRender, setRightRender] = useState(isRightPanelOpen)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isLeftSidebarOpen) setLeftRender(true)
  }, [isLeftSidebarOpen])

  useEffect(() => {
    if (isRightPanelOpen) setRightRender(true)
  }, [isRightPanelOpen])

  const handleLeftTransitionEnd = useCallback(() => {
    if (!isLeftSidebarOpen) setLeftRender(false)
  }, [isLeftSidebarOpen])

  const handleRightTransitionEnd = useCallback(() => {
    if (!isRightPanelOpen) setRightRender(false)
  }, [isRightPanelOpen])

  // 安全兜底：如果事件组数量变为0，立即创建默认组
  useEffect(() => {
    if (initialized && groupSize === 0) {
      const now = Date.now()
      const defId = `group-${now}`
      const dg = { id: defId, name: '默认事件组', emoji: '📁', eventChainIds: [], eventIds: [], createdAt: new Date(), updatedAt: new Date() }
      useEventGroupStore.setState({
        groups: new Map([[defId, dg]]),
        groupOrder: [defId],
        activeGroupId: defId,
      })
    }
  }, [groupSize, initialized])

  useEffect(() => {
    useEventStore.getState().load()
    useEventGroupStore.getState().load()
    setInitialized(true)
  }, [])

  // 首次启动自动弹出功能导览
  useEffect(() => {
    if (!initialized) return
    try {
      if (!localStorage.getItem('hasSeenWelcomeGuide')) {
        setIsWelcomeGuideOpen(true)
      }
    } catch {}
  }, [initialized])

  // 启动时检测通知权限，未授权/已拒绝则弹窗提醒
  useEffect(() => {
    if (!initialized) return
    try {
      if (localStorage.getItem('notificationPromptSeen')) return
    } catch {}
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') return
    const timer = setTimeout(() => setIsNotificationPromptOpen(true), 500)
    return () => clearTimeout(timer)
  }, [initialized])

  // 全局 ESC 关闭所有弹窗/浮窗
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const s = useUIStore.getState()
      if (s.isSearchOpen) { s.setIsSearchOpen(false); return }
      if (s.isTypeManagerOpen) { s.setIsTypeManagerOpen(false); s.setTypeToEditId(null); return }
      if (s.isEventPanelOpen) { s.setIsEventPanelOpen(false); return }
      if (s.isImportDialogOpen) { s.setIsImportDialogOpen(false); return }
      if (s.isConflictDialogOpen) { s.setIsConflictDialogOpen(false); return }
      if (s.isWelcomeGuideOpen) { s.setIsWelcomeGuideOpen(false); return }
      if (s.isNotificationPromptOpen) { s.setIsNotificationPromptOpen(false); return }
      if (s.isTodoModalOpen) { s.setIsTodoModalOpen(false); return }
      if (s.dialogConfig) { s.closeDialog(); return }
      if (s.popoverEditorId) { s.setPopoverEditorId(null); return }
      if (s.selectedEventId) { s.setSelectedEvent(undefined); return }
      s.triggerClosePopovers()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 主题初始化 + 跟随系统监听
  useEffect(() => {
    const store = useUIStore.getState()
    const mode = store.themeMode
    if (mode === 'dark') document.documentElement.classList.add('dark')
    else if (mode === 'light') document.documentElement.classList.remove('dark')
    else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark')
      else document.documentElement.classList.remove('dark')
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      const currentMode = useUIStore.getState().themeMode
      if (currentMode === 'system') {
        if (e.matches) document.documentElement.classList.add('dark')
        else document.documentElement.classList.remove('dark')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (!initialized) return
    const u1 = useEventStore.subscribe(() => useEventStore.getState().save())
    const u2 = useEventGroupStore.subscribe(() => useEventGroupStore.getState().save())
    return () => { u1(); u2() }
  }, [initialized])

  const notifiedPermissionRef = useRef(false)

  useEffect(() => {
    if (!('Notification' in window)) return
    const interval = setInterval(() => {
      const store = useEventStore.getState()
      const now = new Date()
      const cutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      for (const event of store.getAllEvents()) {
        if (new Date(event.startTime) > cutoff) continue
        for (const reminder of event.reminders) {
          if (!reminder.enabled || reminder.notified) continue
          const ms = getReminderMilliseconds(reminder.time)
          if (ms === null) continue
          const rt = new Date(new Date(event.startTime).getTime() - ms)
          const diff = rt.getTime() - now.getTime()
          if (diff <= 0 && diff > -60000) {
            if (Notification.permission === 'granted') {
              new Notification(`提醒: ${event.name}`, {
                body: `${new Date(event.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
                tag: event.id,
              })
            } else if (Notification.permission === 'default' && !notifiedPermissionRef.current) {
              notifiedPermissionRef.current = true
              useUIStore.getState().addToast(
                '需要通知权限来发送事件提醒',
                '启用',
                () => { Notification.requestPermission() },
              )
            }
            store.updateEvent(event.id, {
              reminders: event.reminders.map(r => r.id === reminder.id ? { ...r, notified: true } : r),
            })
          }
        }
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent-500/30 border-t-accent-500 animate-spin" />
          <div className="text-sm text-slate-500 dark:text-slate-400">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <KeyboardShortcuts />
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {!isLeftSidebarOpen && (
          <button onClick={() => setIsLeftSidebarOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 rounded-r-xl shadow-elevated hover:bg-white dark:hover:bg-slate-800 hover:shadow-overlay transition-all duration-200">
            <PanelLeftOpen className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </button>
        )}
        <div ref={leftRef}
          onTransitionEnd={handleLeftTransitionEnd}
          className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isLeftSidebarOpen ? 'w-[min(20vw,18rem)] opacity-100' : 'w-0 opacity-0'}`}>
          <div className="w-[min(20vw,18rem)]">{leftRender && <LeftSidebar key={sideKey} />}</div>
        </div>
        <div className="flex-1 overflow-hidden"><TimeTable /></div>
        <div ref={rightRef}
          onTransitionEnd={handleRightTransitionEnd}
          className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isRightPanelOpen ? 'w-[min(22vw,20rem)] opacity-100' : 'w-0 opacity-0'}`}>
          <div className="w-[min(22vw,20rem)]">{rightRender && <RightPanel />}</div>
        </div>
        {!isRightPanelOpen && (
          <button onClick={() => setIsRightPanelOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 rounded-l-xl shadow-elevated hover:bg-white dark:hover:bg-slate-800 hover:shadow-overlay transition-all duration-200">
            <PanelRightOpen className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </button>
        )}
      </div>
      <EventModal />
      <CourseImportModal />
      {isConflictDialogOpen && conflictConflicts.length > 0 && (
        <ConflictDialog conflicts={conflictConflicts}
          onClose={() => { setConflictConflicts([]); setIsConflictDialogOpen(false) }}
          onResolve={() => { setConflictConflicts([]); setIsConflictDialogOpen(false) }} />
      )}
      {isTypeManagerOpen && <TypeManagerModal editTypeId={typeToEditId} onClose={() => { setIsTypeManagerOpen(false); useUIStore.getState().setTypeToEditId(null) }} />}
      {dialogConfig && <DialogModal config={dialogConfig} onClose={closeDialog} />}
      <ToastContainer />
      {showDebugPanel && <DebugOverlay />}
      {isWelcomeGuideOpen && <WelcomeGuide onClose={() => setIsWelcomeGuideOpen(false)} />}
      {isNotificationPromptOpen && <NotificationPermissionPrompt onClose={() => setIsNotificationPromptOpen(false)} />}
      {isTodoModalOpen && <TodoModal onClose={() => setIsTodoModalOpen(false)} />}
    </div>
  )
}
