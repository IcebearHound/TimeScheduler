import { RefObject, useLayoutEffect, useRef } from 'react'

/** Register a floating panel with the shared Escape / browser Back controller. */
export default function useDismissiblePanel(ref: RefObject<HTMLElement>, active: boolean, onClose: () => void) {
  const close = useRef(onClose); close.current = onClose
  useLayoutEffect(() => {
    const element = ref.current
    if (!active || !element) return
    const dismiss = () => close.current()
    element.setAttribute('data-dismiss-panel', '')
    element.addEventListener('panel-dismiss', dismiss)
    return () => { element.removeAttribute('data-dismiss-panel'); element.removeEventListener('panel-dismiss', dismiss) }
  }, [active, ref])
}
