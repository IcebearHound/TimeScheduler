import { ReactNode, useRef } from 'react'
import useFocusTrap from '../utils/useFocusTrap'
import useLayoutStore from '../stores/layoutStore'
import MobileSheet from './MobileSheet'

export default function ModalShell({ title, closeLabel, onClose, className, children, keepHeader = false }: {
  title: string; closeLabel?: string; onClose: () => void; className: string; children: ReactNode; keepHeader?: boolean
}) {
  const isMobile = useLayoutStore(s => s.isMobile)
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, !isMobile)
  if (isMobile) return <MobileSheet title={title} closeLabel={closeLabel} onClose={onClose}><div className={`mobile-sheet-legacy ${keepHeader ? 'keep-header' : ''}`}>{children}</div></MobileSheet>
  return <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} data-dismiss-layer className={`${className} outline-none`} onClick={e => { if (e.target === e.currentTarget) onClose() }}>{children}</div>
}
