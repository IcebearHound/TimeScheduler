import { useLayoutEffect } from 'react'
import useUIStore from '../stores/uiStore'

// Shared across effect remounts so React StrictMode cannot schedule two Back calls.
let historyBackPending = false

/** Existing backdrops own cancellation; Escape and browser Back invoke only the top one. */
export default function PanelNavigation() {
  useLayoutEffect(() => {
    const marker = '__timeSchedulerPanel'
    let guarded = false, restoring = historyBackPending, disposed = false
    const restoreHistory = () => { restoring = true; if (!historyBackPending) { historyBackPending = true; history.back() } }
    const layers = () => [...document.querySelectorAll<HTMLElement>('[data-dismiss-layer], [data-sheet-backdrop], [data-dismiss-panel]')]
      .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none')
      .sort((a, b) => a.contains(b) ? -1 : b.contains(a) ? 1 : (Number(getComputedStyle(a).zIndex) || 0) - (Number(getComputedStyle(b).zIndex) || 0))
    const dismiss = () => {
      const all = layers(), top = all[all.length - 1]
      if (!top) return false
      if (top.hasAttribute('data-dismiss-panel')) { top.dispatchEvent(new Event('panel-dismiss')); return true }
      const ui = useUIStore.getState()
      if (top.hasAttribute('data-sheet-backdrop') && top.querySelector('[data-right-sidebar]') && ui.rightPanelExpanded) { ui.setRightPanelExpanded(false); return true }
      // MobileSheet deliberately requires an outside pointer-down before a click.
      top.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', button: 0 }))
      top.click()
      return true
    }
    const sync = () => {
      if (disposed || restoring) return
      if (layers().length && !guarded) { history.pushState({ ...history.state, [marker]: true }, ''); guarded = true }
      else if (!layers().length && guarded) {
        guarded = false
        if (history.state?.[marker]) restoreHistory()
      }
    }
    const pop = () => {
      if (restoring || historyBackPending) { historyBackPending = false; restoring = false; sync(); return }
      if (guarded) { guarded = false; dismiss(); requestAnimationFrame(sync) }
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && layers().length) { e.preventDefault(); e.stopImmediatePropagation(); dismiss() }
    }
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style', 'data-dismiss-panel'] })
    window.addEventListener('keydown', key, true); window.addEventListener('popstate', pop)
    if (history.state?.[marker]) restoreHistory(); else sync()
    return () => { disposed = true; observer.disconnect(); window.removeEventListener('keydown', key, true); window.removeEventListener('popstate', pop); if (guarded && history.state?.[marker]) restoreHistory() }
  }, [])
  return null
}
