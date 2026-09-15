import useUIStore from '../stores/uiStore'
import { ReactNode, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function AppPanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    ref.current?.focus()
    const key = (event: KeyboardEvent) => {
      if (useUIStore.getState().dialogConfig) return
      if (document.querySelector('[data-app-panel]') !== ref.current) return
      if (event.key === 'Tab') {
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, a[href]') || []).filter(el => el.getClientRects().length)
        const first = items[0], last = items[items.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); if (previous?.isConnected) previous.focus() }
  }, [])
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/40 p-3 backdrop-blur-sm desktop:items-center" onClick={onClose}>
    <div ref={ref} data-app-panel role="dialog" aria-label={title} aria-modal="true" tabIndex={-1} className="flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl outline-none dark:bg-slate-900" onClick={e => e.stopPropagation()}>
      <header className="flex shrink-0 items-center justify-between border-b p-4 dark:border-slate-700"><h2 className="font-bold">{title}</h2><button aria-label={`关闭${title}`} className="mobile-icon-button" onClick={onClose}><X size={20} /></button></header>
      <div className="min-h-0 overflow-y-auto p-4 pb-6">{children}</div>
    </div>
  </div>
}
