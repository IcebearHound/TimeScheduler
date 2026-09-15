import { create } from 'zustand'

type WorkspacePanel = 'assignments' | 'ai' | 'account'
export type AccountProvider = 'github' | 'gitee'

/** Navigation only: no credentials or connection tokens are stored here. */
const useWorkspaceStore = create<{
  panel: WorkspacePanel | null
  provider: AccountProvider
  open: (panel: WorkspacePanel, provider?: AccountProvider) => void
  close: () => void
}>(set => ({
  panel: null,
  provider: 'github',
  open: (panel, provider = 'github') => set({ panel, provider }),
  close: () => set({ panel: null }),
}))

export default useWorkspaceStore
