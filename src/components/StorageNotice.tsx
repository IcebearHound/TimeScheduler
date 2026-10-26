import { AlertTriangle, Download } from 'lucide-react'
import usePersistenceStore from '../stores/persistenceStore'
import useUIStore from '../stores/uiStore'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import { captureArchive } from '../integrations/archive'
import { downloadJSON } from '../utils/download'
import { dialogAlert } from '../utils/dialog'

export default function StorageNotice() {
  const issues = usePersistenceStore(s => s.issues)
  const entries = Object.values(issues)
  if (!entries.length) return null
  const protectedArchive = entries.some(issue => issue?.kind === 'unreadable')
  return <section role="alert" className="storage-notice">
    <AlertTriangle size={18} className="shrink-0" aria-hidden="true" />
    <div className="min-w-0 flex-1"><strong>{protectedArchive ? '原始存档已保护' : '最新修改尚未保存'}</strong><p>{(entries.find(issue => issue?.kind === 'unreadable') || entries[0])?.message} 请勿关闭页面。</p></div>
    <button className="workspace-button" onClick={async () => { try { downloadJSON(captureArchive(), '时间规划器紧急备份.json') } catch (error) { await dialogAlert(error instanceof Error ? error.message : '备份失败') } }}><Download size={15} />导出备份</button>
    <button className="workspace-button" onClick={() => { if (protectedArchive) useUIStore.getState().setIsSettingsOpen(true); else { useEventStore.getState().save(); useEventGroupStore.getState().save() } }}>{protectedArchive ? '处理存档' : '重试保存'}</button>
  </section>
}
