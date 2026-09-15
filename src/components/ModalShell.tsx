import { ReactNode } from 'react'
import useLayoutStore from '../stores/layoutStore'
import MobileSheet from './MobileSheet'

export default function ModalShell({ title, closeLabel, onClose, className, children, keepHeader = false }: {
  title: string; closeLabel?: string; onClose: () => void; className: string; children: ReactNode; keepHeader?: boolean
}) {
  const isMobile = useLayoutStore(s => s.isMobile)
  if (isMobile) return <MobileSheet title={title} closeLabel={closeLabel} onClose={onClose}><div className={`mobile-sheet-legacy ${keepHeader ? 'keep-header' : ''}`}>{children}</div></MobileSheet>
  return <div className={className} onClick={e => { if (e.target === e.currentTarget) onClose() }}>{children}</div>
}
