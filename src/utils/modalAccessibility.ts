/** Isolate the highest visible dialog, including dialogs rendered through portals. */
export function createModalIsolation() {
  const changed = new Map<HTMLElement, { inert: boolean; hidden: string | null }>()
  const restore = () => { for (const [node, previous] of changed) { node.inert = previous.inert; if (previous.hidden === null) node.removeAttribute('aria-hidden'); else node.setAttribute('aria-hidden', previous.hidden) } changed.clear() }
  const sync = () => {
    restore()
    const level = (el: HTMLElement) => { let z = 0; for (let p: HTMLElement | null = el; p; p = p.parentElement) z = Math.max(z, Number(getComputedStyle(p).zIndex) || 0); return z }
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
    dialogs.sort((a, b) => a.contains(b) ? -1 : b.contains(a) ? 1 : level(a) - level(b))
    let current = dialogs[dialogs.length - 1]
    while (current?.parentElement) {
      for (const sibling of current.parentElement.children) {
        if (sibling instanceof HTMLElement && sibling !== current && !sibling.matches('.toast-region, script, style')) { changed.set(sibling, { inert: sibling.inert, hidden: sibling.getAttribute('aria-hidden') }); sibling.inert = true; sibling.setAttribute('aria-hidden', 'true') }
      }
      if (current.parentElement === document.body) break
      current = current.parentElement
    }
  }
  return { sync, restore }
}
