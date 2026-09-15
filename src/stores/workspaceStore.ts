import { create } from 'zustand'
import useUIStore from './uiStore'

type WorkspacePanel = 'assignments' | 'ai' | 'account'
export type AccountProvider = 'github' | 'gitee'

/** Navigation only: no credentials or connection tokens are stored here. */
const useWorkspaceStore = create<{
  panel: Exclude<WorkspacePanel, 'assignments'> | null
  provider: AccountProvider
  open: (panel: WorkspacePanel, provider?: AccountProvider) => void
  close: () => void
}>(set => ({
  panel: null,
  provider: 'github',
  open: (panel, provider = 'github') => {
    if (panel === 'assignments') { set({ panel: null }); useUIStore.getState().openRightPanelTab('assignments') }
    else set({ panel, provider })
  },
  close: () => set({ panel: null }),
}))

export default useWorkspaceStore
