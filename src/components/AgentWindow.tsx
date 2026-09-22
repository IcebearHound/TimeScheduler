import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Minus, Sparkles, X, PanelLeftOpen, PanelRightOpen, Move } from 'lucide-react'
import IntegrationPanel from './IntegrationPanel'
import useUIStore from '../stores/uiStore'
import useLayoutStore from '../stores/layoutStore'

export default function AgentWindow() {
  const open = useUIStore(s => s.isAgentOpen), setOpen = useUIStore(s => s.setIsAgentOpen)
  const dock = useUIStore(s => s.agentDock), setDock = useUIStore(s => s.setAgentDock)
  const mobile = useLayoutStore(s => s.isMobile)
  const [mounted, setMounted] = useState(open), [minimized, setMinimized] = useState(false), [expanded, setExpanded] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => { try { const p = JSON.parse(localStorage.getItem('agent-position') || 'null'); return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null } catch { return null } })
  const [dockMenu, setDockMenu] = useState(false), [dropTarget, setDropTarget] = useState<'left' | 'right' | null>(null)
  const [slot, setSlot] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const restoreDock = useRef(dock)
  const [view, setView] = useState(() => ({ width: innerWidth, height: window.visualViewport?.height || innerHeight, top: window.visualViewport?.offsetTop || 0 }))
  const root = useRef<HTMLDivElement>(null), previous = useRef<HTMLElement | null>(null)
  const drag = useRef<{ id: number; x: number; y: number; grabX: number; grabY: number; moved: boolean; originalDock: typeof dock; originalPosition: typeof position; target: 'left' | 'right' | null; position: typeof position } | null>(null)
  const docked = !mobile && dock !== 'floating' && !expanded
  useEffect(() => { if (open) { setMounted(true); setMinimized(false); previous.current = document.activeElement as HTMLElement; if (mobile) useUIStore.getState().setIsRightPanelOpen(false) } }, [open, mobile])
  useEffect(() => {
    const resize = () => { setView({ width: innerWidth, height: window.visualViewport?.height || innerHeight, top: window.visualViewport?.offsetTop || 0 }) }
    window.addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize); window.visualViewport?.addEventListener('scroll', resize)
    return () => { window.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('scroll', resize) }
  }, [])
  useLayoutEffect(() => {
    if (!open || !docked) { setSlot(null); return }
    const target = document.querySelector<HTMLElement>(`[data-agent-dock-slot="${dock}"]`)
    if (!target) return
    const measure = () => { const b = target.getBoundingClientRect(); setSlot({ x: b.left + (dock === 'right' ? 5 : 0), y: b.top, width: Math.max(0, b.width - 5), height: b.height }) }
    const observer = new ResizeObserver(measure); observer.observe(target)
    const main = document.querySelector('.app-main'); if (main) observer.observe(main)
    measure(); window.addEventListener('resize', measure)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [open, docked, dock])
  useEffect(() => {
    const node = root.current
    const dismiss = () => setOpen(false)
    node?.addEventListener('panel-dismiss', dismiss)
    if (open && !minimized) node?.focus({ preventScroll: true })
    return () => node?.removeEventListener('panel-dismiss', dismiss)
  }, [open, mounted, minimized, setOpen])
  const close = () => { setDockMenu(false); setOpen(false); previous.current?.focus({ preventScroll: true }) }
  const floatWidth = Math.min(view.width - 24, expanded ? 1000 : 480), floatHeight = Math.min(view.height - 24, expanded ? view.height - 24 : 740)
  const width = docked && slot ? slot.width : floatWidth, height = docked && slot ? slot.height : floatHeight
  const left = mobile ? 12 : docked && slot ? slot.x : Math.max(0, Math.min(view.width - width, position?.x ?? view.width - width - 24))
  const top = mobile ? view.top + 12 : docked && slot ? slot.y : Math.max(view.top, Math.min(view.top + view.height - height, position?.y ?? Math.max(12, (view.height - height) / 2)))
  const chooseDock = (next: typeof dock) => { setExpanded(false); setDockMenu(false); setDock(next) }
  const finishDrag = (cancelled = false) => {
    const d = drag.current; drag.current = null; setDropTarget(null)
    if (!d?.moved) return
    if (cancelled) { setDock(d.originalDock); setPosition(d.originalPosition); return }
    setDock(d.target || 'floating')
    if (!d.target && d.position) try { localStorage.setItem('agent-position', JSON.stringify(d.position)) } catch {}
  }
  return <>
    {dropTarget && <div aria-label={`松开吸附到${dropTarget === 'left' ? '左' : '右'}边栏`} data-agent-drop-target={dropTarget} className="pointer-events-none fixed bottom-3 top-16 z-[49] flex w-64 items-center justify-center rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-100/60 text-sm font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300" style={{ [dropTarget]: 8 }}>松开吸附到{dropTarget === 'left' ? '左' : '右'}边栏</div>}
    {minimized && <button className="agent-restore workspace-button primary" onClick={() => setOpen(true)}><Sparkles size={18} />恢复 Agent</button>}
    {mounted && <div ref={root} role="dialog" aria-label="日程 Agent" tabIndex={-1} data-agent-window data-agent-dock={mobile ? 'mobile' : docked ? dock : 'floating'} data-dismiss-panel={open && !minimized ? '' : undefined}
      onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation() }}
      className={`agent-window ${docked ? 'is-docked' : ''}`} style={{ display: open && !minimized ? 'flex' : 'none', width, height, left, top }}>
      <header className="agent-window-header relative" title={mobile ? '日程 Agent' : '拖动标题栏移动，靠近屏幕左右边缘可吸附'} onPointerDown={e => {
        if (mobile || expanded || e.button !== 0 || (e.target as HTMLElement).closest('button')) return
        const box = root.current!.getBoundingClientRect(); drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, grabX: e.clientX - box.left, grabY: e.clientY - box.top, moved: false, originalDock: dock, originalPosition: position, target: null, position }; setDockMenu(false); e.currentTarget.setPointerCapture(e.pointerId)
      }} onPointerMove={e => {
        const d = drag.current; if (!d || d.id !== e.pointerId) return
        if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return
        if (!d.moved) { d.moved = true; setDock('floating') }
        d.position = { x: Math.max(0, Math.min(view.width - floatWidth, e.clientX - Math.min(d.grabX, floatWidth - 24))), y: Math.max(view.top, Math.min(view.top + view.height - floatHeight, e.clientY - d.grabY)) }
        d.target = e.clientX <= 64 ? 'left' : e.clientX >= view.width - 64 ? 'right' : null
        setPosition(d.position); setDropTarget(d.target)
      }} onPointerUp={e => { finishDrag(); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId) }} onPointerCancel={() => finishDrag(true)} onLostPointerCapture={() => { if (drag.current) finishDrag(true) }}>
        <h2 className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-semibold"><Sparkles size={16} className="shrink-0" />Agent</h2>
        {!mobile && <button aria-label="Agent 停靠位置" aria-expanded={dockMenu} onClick={() => setDockMenu(!dockMenu)}>{dock === 'left' ? <PanelLeftOpen size={16} /> : dock === 'right' ? <PanelRightOpen size={16} /> : <Move size={16} />}</button>}
        <button aria-label="最小化 Agent" onClick={() => { setMinimized(true); setOpen(false) }}><Minus size={17} /></button>
        {!mobile && <button aria-label={expanded ? '还原 Agent 大小' : '放大 Agent'} onClick={() => { if (expanded) { setExpanded(false); setDock(restoreDock.current) } else { restoreDock.current = dock; setDock('floating'); setExpanded(true) } }}>{expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>}
        <button aria-label="关闭 Agent" onClick={close}><X size={18} /></button>
      </header>
      {dockMenu && <div role="menu" aria-label="Agent 停靠位置" className="absolute right-2 top-12 z-50 rounded-xl border bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">{(['left', 'right', 'floating'] as const).map(value => <button key={value} role="menuitem" className="task-menu-item" onClick={() => chooseDock(value)}>{value === 'left' ? <PanelLeftOpen size={14} /> : value === 'right' ? <PanelRightOpen size={14} /> : <Move size={14} />}{value === 'left' ? '吸附左边栏' : value === 'right' ? '吸附右边栏' : '自由悬浮'}</button>)}</div>}
      <div className="min-h-0 flex-1 overflow-hidden"><IntegrationPanel /></div>
    </div>}
  </>
}
