import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, CalendarDays, Check, ChevronRight, Cloud, HardDrive, WifiOff } from 'lucide-react'
import useEventStore from '../stores/eventStore'
import useUIStore from '../stores/uiStore'
import usePersistenceStore from '../stores/persistenceStore'
import useCloudSyncStore from '../stores/cloudSyncStore'
import useNow from '../utils/useNow'
import { getStartOfDay, addDays } from '../utils/dateUtils'
import { navigateToEvent } from '../utils/navigation'

export default function WorkspaceOverview() {
  const events = useEventStore(s => s.events)
  const issues = usePersistenceStore(s => s.issues)
  const cloudStatus = useCloudSyncStore(s => s.status)
  const now = useNow()
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => { const update = () => setOnline(navigator.onLine); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) } }, [])
  const { today, upcoming } = useMemo(() => {
    const start = getStartOfDay(now), end = addDays(start, 1)
    const ordered = [...events.values()].sort((a, b) => +a.startTime - +b.startTime)
    return { today: ordered.filter(e => e.startTime < end && e.endTime > start), upcoming: ordered.find(e => e.endTime > now) }
  }, [events, now])
  const hasIssue = Object.keys(issues).length > 0
  const label = hasIssue ? '保存需要处理' : !online ? '离线 · 保存在此设备' : cloudStatus === 'synced' ? '已同步到云端' : cloudStatus === 'syncing' || cloudStatus === 'connecting' ? '正在同步…' : cloudStatus === 'error' || cloudStatus === 'conflict' ? '云同步需要处理' : '保存在此设备'
  return <section className="workspace-overview" aria-label="日程概览">
    <div className="min-w-0 flex-1">
      <div className="workspace-eyebrow"><CalendarDays size={13} aria-hidden="true" /> 我的日程 <span>/</span><span>{now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</span></div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1"><h1>日程工作台</h1><span className="overview-today">今天 <strong>{today.length}</strong> 个日程</span></div>
      {upcoming && <button className="overview-next" onClick={() => navigateToEvent(upcoming.id)}><span>{upcoming.startTime <= now ? '进行中' : '接下来'}</span><time>{upcoming.startTime.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time><span className="truncate">{upcoming.name}</span><ArrowUpRight size={13} className="shrink-0" /></button>}
    </div>
    <button className={`save-status ${hasIssue || cloudStatus === 'error' || cloudStatus === 'conflict' ? 'needs-attention' : ''}`} aria-label={`保存状态：${label}`} onClick={() => useUIStore.getState().setIsSettingsOpen(true)}>
      {hasIssue ? <HardDrive size={15} /> : !online ? <WifiOff size={15} /> : cloudStatus === 'synced' ? <Cloud size={15} /> : <Check size={15} />}<span>{label}</span><ChevronRight size={13} />
    </button>
  </section>
}
