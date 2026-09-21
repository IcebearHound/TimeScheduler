import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { disableCalendarSync, downloadCalendar, enableCalendarSync, startCalendarSync, syncCalendarNow, useCalendarSync } from '../integrations/calendarSync'

export default function CalendarSyncSettings() {
  const sync = useCalendarSync(), [address, setAddress] = useState(sync.endpoint), [minutes, setMinutes] = useState(sync.defaultMinutes), [message, setMessage] = useState('')
  useEffect(() => { void startCalendarSync() }, [])
  useEffect(() => { setAddress(sync.endpoint); setMinutes(sync.defaultMinutes) }, [sync.endpoint, sync.defaultMinutes])
  return <section aria-label="系统日历提醒" className="space-y-3 rounded-xl border border-indigo-200 p-3 dark:border-indigo-900">
    <h3 className="flex items-center gap-2 font-semibold"><CalendarDays size={18} />系统日历提醒</h3>
    <p className="text-sm">首次添加订阅后，每次打开网站、返回前台或修改日程都会自动更新订阅内容，由系统日历发送提醒。</p>
    <p className="text-xs text-slate-500">系统日历决定刷新时间，更新不会立刻到达手机。需要即时调整的临近提醒，请在系统日历中检查。</p>
    <label className="block text-sm">无单独提醒的事件，默认提前<select aria-label="日历默认提醒" className="workspace-input w-full" disabled={sync.busy} value={minutes} onChange={e => setMinutes(Number(e.target.value))}>{[0, 5, 10, 30, 60].map(m => <option key={m} value={m}>{m ? `${m} 分钟` : '事件发生时'}</option>)}</select></label>
    <p className="text-xs text-slate-500">已配置的事件提醒优先。作业、验收和报告按截止时间提醒；已完成事项不带提醒，跳过的事项不进入订阅。</p>
    <details open={!address ? true : undefined}><summary className="cursor-pointer text-xs text-slate-500">日历服务地址</summary><input aria-label="日历服务地址" type="url" className="workspace-input mt-2 w-full" disabled={sync.enabled || sync.busy} value={address} onChange={e => setAddress(e.target.value)} placeholder="https://你的日历服务.workers.dev" /></details>
    <p className="text-xs text-slate-500">开启后，将日程名称、时间、地点及提醒上传到订阅服务，不上传备注和提交链接。持有订阅链接的人可读取这些日程，请勿公开分享。</p>
    <div className="flex flex-wrap gap-2">
      <button className="workspace-button primary" disabled={!sync.ready || sync.busy || !address} onClick={() => void enableCalendarSync(address, minutes)}>{sync.enabled ? '保存提醒设置并同步' : '开启自动同步并生成订阅'}</button>
      <button className="workspace-button" onClick={() => { try { downloadCalendar(minutes); setMessage('日历文件已下载。手动导入不会自动更新，多次导入可能重复；建议使用订阅') } catch (e) { setMessage(e instanceof Error ? e.message : '导出失败') } }}>下载日历文件</button>
    </div>
    {sync.enabled && <div className="space-y-2">
      <label className="block text-xs">订阅链接<input aria-label="日历订阅链接" className="workspace-input w-full" readOnly value={sync.url} onFocus={e => e.currentTarget.select()} /></label>
      <div className="flex flex-wrap gap-2"><a className="workspace-button primary" href={sync.url.replace(/^https?:/, 'webcal:')}>添加到系统日历</a><button className="workspace-button" onClick={() => void navigator.clipboard.writeText(sync.url).then(() => setMessage('已复制订阅链接')).catch(() => setMessage('请长按上方链接复制'))}>复制链接</button><button className="workspace-button" disabled={sync.busy} onClick={() => void syncCalendarNow()}>立即同步</button><button className="workspace-button text-rose-600" disabled={sync.busy} onClick={() => void disableCalendarSync()}>停用并清空订阅</button></div>
      <p className="text-xs text-slate-500">iOS：点击添加并确认订阅；若未打开，请在系统设置搜索“添加订阅日历”，粘贴链接。开启日历通知，并检查订阅是否关闭了提醒（如有“移除提醒”，请关闭该选项）。</p>
    </div>}
    {sync.lastSynced && <p className="text-xs text-slate-500">最近更新订阅：{new Date(sync.lastSynced).toLocaleString('zh-CN')}</p>}
    {sync.message && <p role={sync.error ? 'alert' : 'status'} className={`text-sm ${sync.error ? 'text-rose-600' : 'text-indigo-600'}`}>{sync.message}</p>}
    {message && <p role="status" className="text-xs text-slate-500">{message}</p>}
  </section>
}
