import ModalShell from './ModalShell'
import { X } from 'lucide-react'
import TodoView from './TodoView'
import useLayoutStore from '../stores/layoutStore'

export default function TodoModal({ onClose }: { onClose: () => void }) {
  const isMobile = useLayoutStore(s => s.isMobile)
  return <ModalShell title="待办事项" closeLabel="关闭待办" onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-modal-backdrop" keepHeader>
    <div className="animate-modal-panel relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900" style={{ width: '90vw', height: '90vh', maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
      <div className="hidden desktop:flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-2 dark:border-slate-800"><h2 className="text-sm font-semibold">待办事项</h2><button className="todo-icon-button" aria-label="关闭待办" onClick={onClose}><X size={18} /></button></div>
      <div className="min-h-0 flex-1"><TodoView embedded={isMobile} onNavigate={onClose} /></div>
    </div>
  </ModalShell>
}
