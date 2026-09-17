import { useState } from 'react'

export function useSidebarWidth(side: 'left' | 'right', initial: number) {
  const [width, setWidth] = useState(() => { try { const saved = Number(localStorage.getItem(`${side}-sidebar-width`)); return saved >= 240 && saved <= 640 ? saved : initial } catch { return initial } })
  return { width, resize: (next: number) => { const value = Math.round(Math.max(240, Math.min(640, window.innerWidth * .45, next))); setWidth(value); try { localStorage.setItem(`${side}-sidebar-width`, String(value)) } catch {} } }
}
export default function SidebarResizeHandle({ side, width, onResize }: { side: 'left' | 'right'; width: number; onResize: (width: number) => void }) {
  const [drag, setDrag] = useState<{ x: number; width: number } | null>(null)
  return <div role="separator" aria-label={side === 'left' ? '调整左边栏宽度' : '调整右边栏宽度'} aria-orientation="vertical" aria-valuemin={240} aria-valuemax={640} aria-valuenow={width} tabIndex={0} className={`sidebar-resize-handle ${side}`}
    onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ x: e.clientX, width }); document.documentElement.classList.add('resizing-sidebar') }}
    onPointerMove={e => { if (drag) onResize(drag.width + (e.clientX - drag.x) * (side === 'left' ? 1 : -1)) }}
    onPointerUp={e => { setDrag(null); e.currentTarget.releasePointerCapture(e.pointerId); document.documentElement.classList.remove('resizing-sidebar') }}
    onLostPointerCapture={() => { setDrag(null); document.documentElement.classList.remove('resizing-sidebar') }}
    onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); onResize(width + (e.key === 'ArrowRight' ? 20 : -20) * (side === 'left' ? 1 : -1)) } }} />
}
