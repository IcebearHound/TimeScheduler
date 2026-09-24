import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Minus, Sparkles, X, PanelLeftOpen, PanelRightOpen, Move } from 'lucide-react'
import IntegrationPanel from './IntegrationPanel'
import useUIStore from '../stores/uiStore'
import useLayoutStore from '../stores/layoutStore'

const AgentContent = memo(IntegrationPanel)
const resizeEdges = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const
type ResizeBox = { x: number; y: number; width: number; height: number }

export default function AgentWindow() {
  const open = useUIStore(s => s.isAgentOpen), setOpen = useUIStore(s => s.setIsAgentOpen)
  const dock = useUIStore(s => s.agentDock), setDock = useUIStore(s => s.setAgentDock)
  const mobile = useLayoutStore(s => s.isMobile)
  const [size, setSize] = useState(() => { try { const v = JSON.parse(localStorage.getItem('agent-size') || 'null'); if (v && Number.isFinite(v.width) && Number.isFinite(v.height)) return { width: Math.max(320, v.width), height: Math.max(360, v.height) } } catch {} return { width: 480, height: 740 } })
  const frame = useRef<number | null>(null)
  const cancelFrame = () => { if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null }
  const queueFrame = (update: () => void) => { cancelFrame(); frame.current = requestAnimationFrame(() => { frame.current = null; update() }) }
  useEffect(() => () => cancelFrame(), [])
  const resizing = useRef<{ id: number; x: number; y: number; box: ResizeBox; next: ResizeBox } | null>(null)
  const [mounted, setMounted] = useState(open), [minimized, setMinimized] = useState(false), [expanded, setExpanded] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => { try { const p = JSON.parse(localStorage.getItem('agent-position') || 'null'); return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null } catch { return null } })
  const [dockMenu, setDockMenu] = useState(false), [dropTarget, setDropTarget] = useState<'left' | 'right' | null>(null)
  const [slot, setSlot] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const restoreDock = useRef(dock)
  const [view, setView] = useState(() => ({ width: innerWidth, height: window.visualViewport?.height || innerHeight, top: window.visualViewport?.offsetTop || 0 }))
  const root = useRef<HTMLDivElement>(null), previous = useRef<HTMLElement | null>(null)
  const drag = useRef<{ id: number; x: number; y: number; grabX: number; grabY: number; moved: boolean; originalDock: typeof dock; originalExpanded: boolean; originalPosition: typeof position; target: 'left' | 'right' | null; position: typeof position } | null>(null)
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
  const floatWidth = Math.min(view.width - 24, expanded ? 1000 : mobile ? 480 : size.width), floatHeight = Math.min(view.height - 24, expanded ? view.height - 24 : mobile ? 740 : size.height)
  const width = docked && slot ? slot.width : floatWidth, height = docked && slot ? slot.height : floatHeight
  const left = mobile ? 12 : docked && slot ? slot.x : Math.max(0, Math.min(view.width - width, position?.x ?? view.width - width - 24))
  const top = mobile ? view.top + 12 : docked && slot ? slot.y : Math.max(view.top, Math.min(view.top + view.height - height, position?.y ?? Math.max(12, (view.height - height) / 2)))
  const chooseDock = (next: typeof dock) => { setExpanded(false); setDockMenu(false); setDock(next) }
  const finishDrag = (cancelled = false) => {
    cancelFrame()
    const d = drag.current; drag.current = null; setDropTarget(null)
    if (!d?.moved) return
    if (cancelled) { setExpanded(d.originalExpanded); setDock(d.originalDock); setPosition(d.originalPosition); return }
    if (d.originalExpanded) restoreDock.current = d.target || 'floating'
    setPosition(d.position); setDock(d.target || 'floating')
    if (!d.target && d.position) try { localStorage.setItem('agent-position', JSON.stringify(d.position)) } catch {}
  }
  const finishResize = (cancelled = false) => {
    cancelFrame()
    const r = resizing.current; resizing.current = null
    if (!r) return
    const box = cancelled ? r.box : r.next
    setPosition({ x: box.x, y: box.y }); setSize({ width: box.width, height: box.height })
    if (!cancelled) try { localStorage.setItem('agent-position', JSON.stringify({ x: box.x, y: box.y })); localStorage.setItem('agent-size', JSON.stringify({ width: box.width, height: box.height })) } catch {}
  }
  return <>
    {dropTarget && <div aria-label={`松开吸附到${dropTarget === 'left' ? '左' : '右'}边栏`} data-agent-drop-target={dropTarget} className="pointer-events-none fixed bottom-3 top-16 z-[49] flex w-64 items-center justify-center rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-100/60 text-sm font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300" style={{ [dropTarget]: 8 }}>松开吸附到{dropTarget === 'left' ? '左' : '右'}边栏</div>}
    {minimized && <button className="agent-restore workspace-button primary" onClick={() => setOpen(true)}><Sparkles size={18} />恢复 Agent</button>}
    {mounted && <div ref={root} role="dialog" aria-label="日程 Agent" tabIndex={-1} data-agent-window data-agent-dock={mobile ? 'mobile' : docked ? dock : 'floating'} data-dismiss-panel={open && !minimized ? '' : undefined}
      onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation() }}
      className={`agent-window ${docked ? 'is-docked' : ''}`} style={{ display: open && !minimized ? 'flex' : 'none', width, height, left: 0, top: 0, transform: `translate3d(${left}px, ${top}px, 0)` }}>
      <header className="agent-window-header relative" title={mobile ? '日程 Agent' : '拖动标题栏移动，靠近屏幕左右边缘可吸附'} onPointerDown={e => {
        if (mobile || e.button !== 0 || (e.target as HTMLElement).closest('button')) return
        const box = root.current!.getBoundingClientRect(); drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, grabX: e.clientX - box.left, grabY: e.clientY - box.top, moved: false, originalDock: dock, originalExpanded: expanded, originalPosition: position, target: null, position }; setDockMenu(false); e.currentTarget.setPointerCapture(e.pointerId)
      }} onPointerMove={e => {
        const d = drag.current; if (!d || d.id !== e.pointerId) return
        if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return
        const dragWidth = d.originalExpanded ? Math.min(view.width - 24, size.width) : floatWidth
        const dragHeight = d.originalExpanded ? Math.min(view.height - 24, size.height) : floatHeight
        d.position = { x: Math.max(0, Math.min(view.width - dragWidth, e.clientX - Math.min(d.grabX, dragWidth - 24))), y: Math.max(view.top, Math.min(view.top + view.height - dragHeight, e.clientY - d.grabY)) }
        d.target = e.clientX <= 64 ? 'left' : e.clientX >= view.width - 64 ? 'right' : null
        if (!d.moved) {
          d.moved = true
          if (d.originalExpanded) setExpanded(false)
          setDock('floating')
          setPosition(d.position)
        }
        queueFrame(() => { setPosition(d.position); setDropTarget(d.target) })
      }} onPointerUp={e => { finishDrag(); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId) }} onPointerCancel={() => finishDrag(true)} onLostPointerCapture={() => { if (drag.current) finishDrag(true) }}>
        <h2 className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-semibold"><Sparkles size={16} className="shrink-0" />Agent</h2>
        {!mobile && <button aria-label="Agent 停靠位置" aria-expanded={dockMenu} onClick={() => setDockMenu(!dockMenu)}>{dock === 'left' ? <PanelLeftOpen size={16} /> : dock === 'right' ? <PanelRightOpen size={16} /> : <Move size={16} />}</button>}
        <button aria-label="最小化 Agent" onClick={() => { setMinimized(true); setOpen(false) }}><Minus size={17} /></button>
        {!mobile && <button aria-label={expanded ? '还原 Agent 大小' : '放大 Agent'} onClick={() => { if (expanded) { setExpanded(false); setDock(restoreDock.current) } else { restoreDock.current = dock; setDock('floating'); setExpanded(true) } }}>{expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>}
        <button aria-label="关闭 Agent" onClick={close}><X size={18} /></button>
      </header>
      {dockMenu && <div role="menu" aria-label="Agent 停靠位置" className="absolute right-2 top-12 z-50 rounded-xl border bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">{(['left', 'right', 'floating'] as const).map(value => <button key={value} role="menuitem" className="task-menu-item" onClick={() => chooseDock(value)}>{value === 'left' ? <PanelLeftOpen size={14} /> : value === 'right' ? <PanelRightOpen size={14} /> : <Move size={14} />}{value === 'left' ? '吸附左边栏' : value === 'right' ? '吸附右边栏' : '自由悬浮'}</button>)}</div>}
      <div className="min-h-0 flex-1 overflow-hidden"><AgentContent /></div>
      {!mobile && !docked && !expanded && resizeEdges.map(edge => <div key={edge} data-agent-resize={edge} aria-label={`调整 Agent 大小 ${edge}`} className={`agent-resize-handle agent-resize-${edge}`} onPointerDown={e => {
        if (e.button !== 0) return
        e.preventDefault(); e.stopPropagation()
        const b = root.current!.getBoundingClientRect(), box = { x: b.x, y: b.y, width: b.width, height: b.height }
        resizing.current = { id: e.pointerId, x: e.clientX, y: e.clientY, box, next: box }
        e.currentTarget.setPointerCapture(e.pointerId)
      }} onPointerMove={e => {
        const r = resizing.current; if (!r || r.id !== e.pointerId) return
        const dx = e.clientX - r.x, dy = e.clientY - r.y, b = r.box
        const minWidth = Math.min(320, view.width - 24), minHeight = Math.min(360, view.height - 24)
        let x = b.x, y = b.y, right = b.x + b.width, bottom = b.y + b.height
        if (edge.includes('w')) x = Math.max(0, Math.min(right - minWidth, b.x + dx))
        if (edge.includes('e')) right = Math.min(view.width - 12, Math.max(x + minWidth, b.x + b.width + dx))
        if (edge.includes('n')) y = Math.max(view.top, Math.min(bottom - minHeight, b.y + dy))
        if (edge.includes('s')) bottom = Math.min(view.top + view.height - 12, Math.max(y + minHeight, b.y + b.height + dy))
        r.next = { x, y, width: right - x, height: bottom - y }
        queueFrame(() => { setPosition({ x: r.next.x, y: r.next.y }); setSize({ width: r.next.width, height: r.next.height }) })
      }} onPointerUp={e => { finishResize(); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId) }} onPointerCancel={() => finishResize(true)} onLostPointerCapture={() => { if (resizing.current) finishResize(true) }} />)}
    </div>}
  </>
}
