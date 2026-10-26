import { ArrowRight, CalendarPlus, Download, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import useUIStore from '../stores/uiStore'
import useEventStore from '../stores/eventStore'

export default function CalendarEmptyState() {
  const count = useEventStore(s => s.events.size)
  const [dismissed, setDismissed] = useState(false)
  if (count || dismissed) return null
  const ui = useUIStore.getState()
  return <section className="calendar-empty" aria-label="开始规划">
    <button className="empty-dismiss" aria-label="收起开始规划" onClick={() => setDismissed(true)}><X size={16} /></button>
    <div className="empty-icon" aria-hidden="true"><CalendarPlus size={26} /></div>
    <div className="min-w-0 flex-1"><p className="empty-eyebrow">给新计划一个开始</p><h2>你的下一件重要小事，安排在这里。</h2><p className="empty-description">添加日程、导入课表，把课程和生活放在同一张日历里。</p>
      <div className="empty-actions"><button className="btn-primary" onClick={() => { ui.setSelectedEvent(undefined); ui.setIsEventPanelOpen(true) }}>创建第一个日程<ArrowRight size={15} /></button><button className="btn-secondary" onClick={() => ui.setIsImportDialogOpen(true)}><Download size={15} />导入课表</button><button className="btn-ghost" onClick={() => ui.setIsSettingsOpen(true)}>恢复备份</button></div>
      <p className="empty-privacy"><ShieldCheck size={13} aria-hidden="true" />无需登录即可使用，日程保存在当前浏览器。</p>
    </div>
  </section>
}
