import { create } from 'zustand'

export type ArchiveKey = 'eventStore' | 'eventGroupStore'
type StorageIssue = { kind: 'unreadable' | 'unsaved'; message: string }
type PersistenceState = { issues: Partial<Record<ArchiveKey, StorageIssue>>; lastSavedAt: number | null }

/** Protect unreadable archives until the user explicitly restores a validated backup. */
export function createPersistenceManager(storage: () => Pick<Storage, 'getItem' | 'setItem'>) {
  const useStatus = create<PersistenceState>(() => ({ issues: {}, lastSavedAt: null }))
  const protect = (key: ArchiveKey) => {
    useStatus.setState(s => ({ issues: { ...s.issues, [key]: { kind: 'unreadable', message: '本地存档无法读取，原始数据已保护；新修改暂存在本次页面中。' } } }))
  }
  const acknowledge = (key: ArchiveKey) => {
    useStatus.setState(s => { const issues = { ...s.issues }; delete issues[key]; return { issues, lastSavedAt: Date.now() } })
  }
  return {
    useStatus, protect, acknowledge,
    read(key: ArchiveKey) {
      try { return storage().getItem(key) }
      catch { protect(key); return null }
    },
    write(key: ArchiveKey, value: unknown) {
      if (useStatus.getState().issues[key]?.kind === 'unreadable') return false
      try { storage().setItem(key, JSON.stringify(value)); acknowledge(key); return true }
      catch {
        useStatus.setState(s => ({ issues: { ...s.issues, [key]: { kind: 'unsaved', message: '浏览器存储空间不足或不可用，最新修改尚未保存。请立即导出备份。' } } }))
        return false
      }
    },
  }
}

export const persistence = createPersistenceManager(() => localStorage)
export default persistence.useStatus

export function validateStoredEntries(value: unknown): asserts value is [string, Record<string, any>][] {
  if (!Array.isArray(value) || value.some(entry => !Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || !entry[1] || typeof entry[1] !== 'object' || entry[0] !== entry[1].id || typeof entry[1].name !== 'string')) throw new Error('存档结构无效')
  if (new Set(value.map(entry => entry[0])).size !== value.length) throw new Error('存档包含重复 ID')
}
