import { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import useUIStore from '../stores/uiStore'

let sequence = 0
const stack: number[] = []
const viewport = () => ({ top: window.visualViewport?.offsetTop || 0, height: window.visualViewport?.height || window.innerHeight })

/** Mobile modal with a fixed dismissal header and an independently scrolling body. */
export default function MobileSheet({ title, closeLabel, onClose, children, fill = false }: {
  title: string; closeLabel?: string; onClose: () => void; children: ReactNode; fill?: boolean
}) {
  const [id] = useState(() => ++sequence)
  const [layer] = useState(() => 180 + stack.length * 2)
  const [view, setView] = useState(viewport)
  const [offset, setOffset] = useState(0)
  const panel = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const close = useRef(onClose); close.current = onClose
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null)
  const beganOutside = useRef(false)
  const outsideTouch = useRef<{ x: number; y: number } | null>(null)
  const buttonTouch = useRef<{ x: number; y: number } | null>(null)
  const dismiss = () => { if (stack[stack.length - 1] === id) close.current() }
  useEffect(() => {
    stack.push(id)
    const previous = document.activeElement as HTMLElement
    closeButton.current?.focus({ preventScroll: true })
    const resize = () => setView(viewport())
    const key = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return
      const ui = useUIStore.getState()
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation()
        if (ui.dialogConfig) { ui.dialogConfig.onCancel?.(); ui.closeDialog() }
        else dismiss()
      }
      if (ui.dialogConfig) return
      if (event.key === 'Tab') {
        const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') || []).filter(el => el.getClientRects().length)
        const first = items[0], last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
      if ((event.ctrlKey || event.metaKey) && ['n', 'f', 'k', 'z', 'y'].includes(event.key.toLowerCase()) && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); event.stopImmediatePropagation() }
    }
    window.addEventListener('keydown', key, true)
    window.addEventListener('resize', resize)
    window.visualViewport?.addEventListener('resize', resize)
    window.visualViewport?.addEventListener('scroll', resize)
    return () => {
      const index = stack.indexOf(id); if (index >= 0) stack.splice(index, 1)
      window.removeEventListener('keydown', key, true); window.removeEventListener('resize', resize)
      window.visualViewport?.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('scroll', resize)
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [id])
  const height = Math.min(view.height * .78, 680)
  return createPortal(<div data-sheet-backdrop={title} className="mobile-sheet-backdrop" style={{ top: view.top, height: view.height, zIndex: layer }}
    onPointerDown={e => { beganOutside.current = e.target === e.currentTarget; outsideTouch.current = beganOutside.current && e.pointerType !== 'mouse' ? { x: e.clientX, y: e.clientY } : null }}
    onPointerUp={e => {
      const start = outsideTouch.current; outsideTouch.current = null
      if (start && e.target === e.currentTarget && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 12) { e.preventDefault(); requestAnimationFrame(dismiss) }
    }}
    onPointerCancel={() => { outsideTouch.current = null }}
    onClick={e => { if (e.target === e.currentTarget && beganOutside.current) dismiss() }}>
    <div ref={panel} role="dialog" aria-modal="true" aria-label={title} data-mobile-sheet={title} className="mobile-sheet" style={{ maxHeight: height, ...(fill ? { height } : {}), transform: offset ? `translateY(${offset}px)` : undefined } as CSSProperties}>
      <header className="mobile-sheet-header" data-sheet-drag
        onPointerDown={e => {
          if (!e.isPrimary || e.button !== 0 || (e.target as HTMLElement).closest('button')) return
          e.preventDefault()
          gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={e => { if (gesture.current?.id === e.pointerId) setOffset(Math.min(180, Math.max(0, e.clientY - gesture.current.y))) }}
        onPointerUp={e => {
          const start = gesture.current; gesture.current = null; setOffset(0)
          if (start?.id === e.pointerId) {
            e.preventDefault()
            if (e.clientY - start.y >= 72 && e.clientY - start.y > Math.abs(e.clientX - start.x) * 1.2) requestAnimationFrame(dismiss)
          }
        }}
        onPointerCancel={() => { gesture.current = null; setOffset(0) }}>
        <div className="mobile-sheet-grip" aria-hidden="true" />
        <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold">{title}</h2><p className="text-[10px] text-slate-500">下滑顶部或轻点外侧空白关闭</p></div>
          <button ref={closeButton} type="button" aria-label={closeLabel || `关闭${title}`} onClick={dismiss} className="mobile-sheet-close"
            onPointerDown={e => { buttonTouch.current = e.isPrimary && e.pointerType !== 'mouse' ? { x: e.clientX, y: e.clientY } : null }}
            onPointerCancel={() => { buttonTouch.current = null }}
            onPointerUp={e => {
              const start = buttonTouch.current; buttonTouch.current = null
              // Browsers may suppress the synthetic click immediately after touch scrolling.
              if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 12) { e.preventDefault(); e.stopPropagation(); requestAnimationFrame(dismiss) }
            }}><X size={20} /><span className="text-xs">关闭</span></button>
        </div>
      </header>
      <div className="mobile-sheet-body">{children}</div>
    </div>
  </div>, document.body)
}
