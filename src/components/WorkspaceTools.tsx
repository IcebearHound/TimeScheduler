import useLayoutStore from '../stores/layoutStore'
import MobileSheet from './MobileSheet'
import { useEffect, useRef } from 'react'
import { Plug, X } from 'lucide-react'
import IntegrationPanel from './IntegrationPanel'
import CloudAccountPanel from './CloudAccountPanel'
import useWorkspaceStore from '../stores/workspaceStore'

export default function WorkspaceTools() {
  const isMobile = useLayoutStore(s => s.isMobile)
  const tab = useWorkspaceStore(s => s.panel)
  const provider = useWorkspaceStore(s => s.provider)
  const open = useWorkspaceStore(s => s.open)
  const close = useWorkspaceStore(s => s.close)
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!tab || isMobile) return
    const previous = document.activeElement as HTMLElement
    dialog.current?.focus()
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close() }
      if (e.key === 'Tab') {
        const items = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary') || [])].filter(e => e.getClientRects().length)
        const first = items[0], last = items[items.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
      // Keep global calendar shortcuts out of this workspace dialog.
      if ((e.ctrlKey || e.metaKey) && ['z', 'y', 'n', 'f'].includes(e.key.toLowerCase())) e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', handle, true)
    return () => { window.removeEventListener('keydown', handle, true); previous?.focus() }
  }, [!!tab, isMobile])
  if (tab && isMobile) return <MobileSheet title={tab === 'account' ? '用户账号与私有仓库同步' : 'AI 与存档连接'} closeLabel="关闭工作台" onClose={close}><div className="p-4">{tab === 'account' ? <CloudAccountPanel key={provider} initialProvider={provider} /> : <IntegrationPanel />}</div></MobileSheet>
  return <>
    <nav aria-label="扩展工具" className="hidden desktop:flex shrink-0 gap-2 border-b border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
      <button className="workspace-button inline-flex items-center gap-1" onClick={() => open('ai')}><Plug size={14} />AI / MCP</button>
    </nav>
    {tab && <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/50 p-2 backdrop-blur-sm sm:p-6">
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="workspace-title" className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white text-slate-800 shadow-2xl outline-none dark:bg-slate-900 dark:text-slate-200">
        <header className="flex items-center justify-between border-b p-4 dark:border-slate-700"><h2 id="workspace-title" className="font-bold">{tab === 'account' ? '用户账号与私有仓库同步' : 'AI 与存档连接'}</h2><button aria-label="关闭工作台" onClick={close} className="workspace-button"><X size={18} /></button></header>
        <div className="overflow-y-auto p-4 sm:p-6">{tab === 'account' ? <CloudAccountPanel key={provider} initialProvider={provider} /> : <IntegrationPanel />}</div>
      </div>
    </div>}
  </>
}
