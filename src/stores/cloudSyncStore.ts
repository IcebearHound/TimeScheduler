import { create } from 'zustand'
import { AccountProvider } from './workspaceStore'
import { Snapshot } from '../integrations/contracts'

export type CloudStatus = 'signed-out' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict'
const useCloudSyncStore = create<{
  status: CloudStatus
  provider?: AccountProvider
  login?: string
  message: string
  lastSynced?: number
  repositoryUrl?: string
  conflict?: { remote: Snapshot; message: string }
}>(() => ({ status: 'signed-out', message: '登录后自动同步到你的私有仓库' }))
export default useCloudSyncStore
