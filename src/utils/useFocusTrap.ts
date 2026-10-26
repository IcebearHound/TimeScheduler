import { RefObject, useEffect, useRef } from 'react'

const focusable = 'button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]'

export function restoreFocus(previous: HTMLElement | null | undefined) {
  queueMicrotask(() => {
    const target = previous?.isConnected && previous !== document.body ? previous : document.querySelector<HTMLElement>('header button[aria-label="用户"]')
    if (target && !target.closest('[inert]')) target.focus({ preventScroll: true })
  })
}

/** Traps the top modal only and restores the actual invoking control on dismissal. */
export default function useFocusTrap(ref: RefObject<HTMLElement>, enabled = true) {
  const invoker = useRef(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null)
  useEffect(() => {
    const root = ref.current
    if (!enabled || !root) return
    const previous = invoker.current
    const items = () => Array.from(root.querySelectorAll<HTMLElement>(focusable)).filter(el => el.getClientRects().length && !el.closest('[inert]'))
    if (!root.contains(document.activeElement)) (root.querySelector<HTMLElement>('[autofocus]') || items()[0] || root).focus({ preventScroll: true })
    const isTop = () => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).filter(el => el.getClientRects().length)
      const level = (el: HTMLElement) => { let z = 0; for (let node: HTMLElement | null = el; node; node = node.parentElement) z = Math.max(z, Number(getComputedStyle(node).zIndex) || 0); return z }
      dialogs.sort((a, b) => a.contains(b) ? -1 : b.contains(a) ? 1 : level(a) - level(b))
      return dialogs[dialogs.length - 1] === root
    }
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !isTop()) return
      const list = items(), first = list[0], last = list[list.length - 1]
      if (!first) { event.preventDefault(); root.focus(); return }
      if (!root.contains(document.activeElement) || (event.shiftKey && (document.activeElement === first || document.activeElement === root))) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', key, true)
    return () => { window.removeEventListener('keydown', key, true); restoreFocus(previous) }
  }, [ref, enabled])
}
