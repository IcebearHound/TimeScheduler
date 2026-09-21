import { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Minus, Sparkles, X } from 'lucide-react'
import IntegrationPanel from './IntegrationPanel'
import useUIStore from '../stores/uiStore'
import useLayoutStore from '../stores/layoutStore'

export default function AgentWindow() {
  const open = useUIStore(s => s.isAgentOpen), setOpen = useUIStore(s => s.setIsAgentOpen)
  const mobile = useLayoutStore(s => s.isMobile)
  const [mounted, setMounted] = useState(open), [minimized, setMinimized] = useState(false), [expanded, setExpanded] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [view, setView] = useState(() => ({ width: innerWidth, height: window.visualViewport?.height || innerHeight, top: window.visualViewport?.offsetTop || 0 }))
  const root = useRef<HTMLDivElement>(null), previous = useRef<HTMLElement | null>(null)
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null)
  useEffect(() => { if (open) { setMounted(true); setMinimized(false); previous.current = document.activeElement as HTMLElement; if (mobile) useUIStore.getState().setIsRightPanelOpen(false) } }, [open, mobile])
  useEffect(() => {
    const resize = () => { setView({ width: innerWidth, height: window.visualViewport?.height || innerHeight, top: window.visualViewport?.offsetTop || 0 }); setPosition(null) }
    window.addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize); window.visualViewport?.addEventListener('scroll', resize)
    return () => { window.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('scroll', resize) }
  }, [])
  useEffect(() => {
    const node = root.current
    const dismiss = () => setOpen(false)
    node?.addEventListener('panel-dismiss', dismiss)
    if (open && !minimized) node?.focus({ preventScroll: true })
    return () => node?.removeEventListener('panel-dismiss', dismiss)
  }, [open, mounted, minimized, setOpen])
  const close = () => { setOpen(false); previous.current?.focus({ preventScroll: true }) }
  const width = Math.min(view.width - 24, expanded ? 1000 : 480), height = Math.min(view.height - 24, expanded ? view.height - 24 : 740)
  return <>
    {minimized && <button className="agent-restore workspace-button primary" onClick={() => setOpen(true)}><Sparkles size={18} />恢复 Agent</button>}
    {mounted && <div ref={root} role="dialog" aria-label="日程 Agent" tabIndex={-1} data-agent-window data-dismiss-panel={open && !minimized ? '' : undefined}
      onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation() }}
      className="agent-window" style={{ display: open && !minimized ? 'flex' : 'none', width, height, left: mobile ? 12 : position?.x ?? Math.max(12, view.width - width - 24), top: mobile ? view.top + 12 : position?.y ?? Math.max(12, (view.height - height) / 2) }}>
      <header className="agent-window-header" onPointerDown={e => {
        if (mobile || expanded || e.button !== 0 || (e.target as HTMLElement).closest('button')) return
        const box = root.current!.getBoundingClientRect(); drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: box.left, top: box.top }; e.currentTarget.setPointerCapture(e.pointerId)
      }} onPointerMove={e => { const d = drag.current; if (d?.id === e.pointerId) setPosition({ x: Math.max(0, Math.min(view.width - width, d.left + e.clientX - d.x)), y: Math.max(0, Math.min(view.height - height, d.top + e.clientY - d.y)) }) }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
        <h2 className="flex min-w-0 flex-1 items-center gap-2 font-semibold"><Sparkles size={18} />日程 Agent</h2>
        <button aria-label="最小化 Agent" onClick={() => { setMinimized(true); setOpen(false) }}><Minus size={17} /></button>
        {!mobile && <button aria-label={expanded ? '还原 Agent 大小' : '放大 Agent'} onClick={() => { setExpanded(!expanded); setPosition(null) }}>{expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>}
        <button aria-label="关闭 Agent" onClick={close}><X size={18} /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden"><IntegrationPanel /></div>
    </div>}
  </>
}
