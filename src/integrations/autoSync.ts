import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import useCloudSyncStore from '../stores/cloudSyncStore'
import useWorkspaceStore from '../stores/workspaceStore'
import { browserVault } from './browserVault'
import { CloudAccount, CloudAPIError, cloudEndpoint, completeCloudLogin, ensureCloudRepository, readCloudArchive, refreshCloudAccount, writeCloudArchive } from './cloudAPI'
import { captureArchive, installArchive } from './archive'
import { mergeArchives, sameArchive, SyncConflict } from './syncMerge'
import { Snapshot } from './contracts'

let account: CloudAccount | undefined
let boot: Promise<void> | undefined
let running = false, queued = false, epoch = 0, stoppedForAuth = false
let timer: ReturnType<typeof setTimeout> | undefined
const state = useCloudSyncStore.setState
function later(delay = 1500) { clearTimeout(timer); timer = setTimeout(() => void syncNow(), delay) }
function current(version: number) { return account && epoch === version }

export function startAutoSync(): Promise<void> {
  return boot ||= (async () => {
    if (!cloudEndpoint) return
    const hasCallback = /(?:^#|&)ts_oauth(?:=|_error=)/.test(location.hash)
    state({ status: 'connecting', message: hasCallback ? '正在完成登录…' : '正在恢复同步…' })
    try {
      account = await completeCloudLogin() || await browserVault.get<CloudAccount>('account')
      if (account) {
        state({ provider: account.provider, login: account.login, repositoryUrl: account.repositoryUrl, message: '账号已连接，正在同步…' })
        if (hasCallback) useWorkspaceStore.getState().open('account', account.provider)
      } else state({ status: 'signed-out', message: '登录后自动同步到你的私有仓库' })
    } catch (e) {
      state({ status: 'error', message: e instanceof Error ? e.message : '登录未完成，请重试' })
      if (hasCallback) useWorkspaceStore.getState().open('account')
    }
    useEventStore.subscribe((next, prev) => { if (next.events !== prev.events || next.eventChains !== prev.eventChains || next.eventTypes !== prev.eventTypes || next.semesterStartDate !== prev.semesterStartDate) later() })
    useEventGroupStore.subscribe((next, prev) => { if (next.groups !== prev.groups || next.groupOrder !== prev.groupOrder) later() })
    window.addEventListener('online', () => { stoppedForAuth = false; later(0) })
    window.addEventListener('offline', () => { if (account) state({ status: 'offline', message: '当前离线，修改已保存在此设备，联网后自动同步' }) })
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') later(0) })
    window.addEventListener('focus', () => later(0))
    setInterval(() => { if (document.visibilityState === 'visible') later(0) }, 30000)
    await syncNow()
  })()
}

async function commitSynced(version: number, before: Snapshot, remote: Snapshot, url: string) {
  if (!current(version)) return
  const latest = captureArchive()
  let merged: Snapshot
  try { merged = sameArchive(before, latest) ? remote : mergeArchives(before, latest, remote) }
  catch (error) { state({ status: 'conflict', conflict: { remote, message: (error as Error).message }, message: '有同时修改的内容，需要选择保留的版本' }); return }
  if (!sameArchive(latest, merged)) installArchive(merged, '自动同步存档')
  account!.base = remote; account!.repositoryUrl = url
  await browserVault.set('account', account)
  if (!current(version)) return
  state({ status: 'synced', lastSynced: Date.now(), repositoryUrl: url, message: '所有更改已同步', conflict: undefined })
  if (!sameArchive(captureArchive(), remote)) { state({ message: '此设备有新更改，正在继续同步…' }); later(100) }
}

async function syncOnce() {
  if (!account || stoppedForAuth || useCloudSyncStore.getState().conflict) return
  if (!navigator.onLine) { state({ status: 'offline', message: '当前离线，修改已保存在此设备，联网后自动同步' }); return }
  const version = epoch, active = account
  state({ status: 'syncing', message: '正在同步…' })
  try {
    await refreshCloudAccount(active)
    if (!current(version)) return
    const repo = await ensureCloudRepository(active), remote = await readCloudArchive(active, repo)
    if (!current(version)) return
    const local = captureArchive()
    if (!remote && active.base) throw new Error('云端存档被删除，已保留此设备的数据。请恢复仓库中的存档后重试')
    let candidate: Snapshot
    try { candidate = remote ? mergeArchives(active.base, local, remote.snapshot) : local }
    catch (error) {
      if (!(error instanceof SyncConflict) || !remote) throw error
      state({ status: 'conflict', conflict: { remote: remote.snapshot, message: error.message }, message: '两台设备修改了同一内容，请选择要保留的版本' }); return
    }
    if (!remote || !sameArchive(candidate, remote.snapshot)) await writeCloudArchive(active, repo, candidate, remote?.sha)
    if (!current(version)) return
    await commitSynced(version, local, candidate, repo.url)
  } catch (error) {
    if (!current(version)) return
    if (error instanceof CloudAPIError && error.status === 401) stoppedForAuth = true
    const message = error instanceof Error ? error.message : '同步未完成，稍后会重试'
    state({ status: navigator.onLine ? 'error' : 'offline', message })
    if (error instanceof CloudAPIError && error.status === 409) later(2000)
  }
}

export async function syncNow() {
  if (!account) return
  if (running) { queued = true; return }
  running = true
  try {
    if (navigator.locks) await navigator.locks.request('time-scheduler-cloud-sync', { ifAvailable: true }, async lock => {
      if (!lock) return
      // Refresh credentials from other tabs while retaining this tab's merge baseline.
      const stored = await browserVault.get<CloudAccount>('account')
      if (!account) return
      if (!stored || stored.login !== account.login || stored.provider !== account.provider) {
        ++epoch; account = undefined
        state({ provider: undefined, login: undefined, repositoryUrl: undefined, status: 'signed-out', conflict: undefined, lastSynced: undefined, message: '账号已在其他页面退出或切换，请重新登录' })
        return
      }
      account = { ...stored, base: account.base }
      await syncOnce()
    })
    else await syncOnce()
  } finally { running = false; if (queued) { queued = false; later() } }
}

export async function resolveSyncConflict(choice: 'local' | 'remote') {
  const resolve = async () => {
    const conflict = useCloudSyncStore.getState().conflict
    if (!account || !conflict) return
    const version = epoch, stored = await browserVault.get<CloudAccount>('account')
    if (!current(version)) return
    if (!stored || stored.provider !== account.provider || stored.login !== account.login) throw new Error('账号已在其他页面退出或切换，请重新登录')
    account = { ...stored, base: account.base }
    // Serialize with logout so this write cannot restore credentials after another tab clears them.
    const before = captureArchive()
    await browserVault.set('conflict-backup', { local: before, remote: conflict.remote, savedAt: Date.now() })
    if (!current(version)) return
    if (!sameArchive(before, captureArchive())) throw new Error('此设备的日程刚有更新，请再选择一次')
    if (choice === 'remote') installArchive(conflict.remote, '采用云端存档')
    account.base = conflict.remote
    await browserVault.set('account', account)
    if (!current(version)) return
    state({ conflict: undefined, message: '正在继续同步…' }); later(0)
  }
  if (navigator.locks) await navigator.locks.request('time-scheduler-cloud-sync', resolve)
  else await resolve()
}
export async function logoutCloud() {
  ++epoch; clearTimeout(timer)
  account = undefined; stoppedForAuth = false
  const clear = async () => { await browserVault.remove('account'); await browserVault.remove('pending-login') }
  if (navigator.locks) await navigator.locks.request('time-scheduler-cloud-sync', clear)
  else await clear()
  state({ provider: undefined, login: undefined, repositoryUrl: undefined, status: 'signed-out', conflict: undefined, lastSynced: undefined, message: '已退出，此设备的日程仍然保留' })
}
