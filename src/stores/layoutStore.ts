import { create } from 'zustand'

export type LayoutMode = 'auto' | 'desktop' | 'mobile'
function savedMode(): LayoutMode {
  try { const value = localStorage.getItem('layoutMode'); if (value === 'desktop' || value === 'mobile') return value } catch {}
  return 'auto'
}
const media = typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)') : undefined
const resolve = (mode: LayoutMode) => mode === 'auto' ? !!media?.matches : mode === 'mobile'
const mode = savedMode()
const useLayoutStore = create<{ mode: LayoutMode; isMobile: boolean; setMode: (mode: LayoutMode) => void }>(set => ({
  mode, isMobile: resolve(mode),
  setMode: mode => {
    try { localStorage.setItem('layoutMode', mode) } catch {}
    set({ mode, isMobile: resolve(mode) })
  },
}))
function apply() {
  if (typeof document !== 'undefined') document.documentElement.dataset.layout = useLayoutStore.getState().isMobile ? 'mobile' : 'desktop'
}
apply()
useLayoutStore.subscribe(apply)
media?.addEventListener('change', () => { const { mode } = useLayoutStore.getState(); useLayoutStore.setState({ isMobile: resolve(mode) }) })
export default useLayoutStore
