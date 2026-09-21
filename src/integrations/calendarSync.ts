import { create } from 'zustand'
import { browserVault } from './browserVault'
import { captureArchive } from './archive'
import { calendarEntries, calendarIcs } from './calendarIcs'
import useEventStore from '../stores/eventStore'

interface Config { enabled: boolean; endpoint: string; secret: string; defaultMinutes: number; lastSynced?: number }
const vaultKey = 'system-calendar-sync-v1'
const defaultEndpoint = (import.meta.env.VITE_CALENDAR_SERVICE_URL || import.meta.env.VITE_AUTH_SERVICE_URL || '').replace(/\/$/, '')
export const useCalendarSync = create<{ ready: boolean; enabled: boolean; endpoint: string; defaultMinutes: number; url: string; lastSynced?: number; busy: boolean; message: string; error: boolean }>(() => ({ ready: false, enabled: false, endpoint: defaultEndpoint, defaultMinutes: 30, url: '', busy: false, message: '', error: false }))
const set = useCalendarSync.setState
let config: Config | undefined, boot: Promise<void> | undefined, queue = Promise.resolve(), timer: ReturnType<typeof setTimeout> | undefined
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('')
const feedUrl = async (c: Config) => `${c.endpoint}/calendar/${await hash(c.secret)}.ics`
function endpoint(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw Error('日历服务地址需要 HTTPS')
  if (url.username || url.password || url.search || url.hash) throw Error('日历服务地址不能包含凭据或参数')
  return value.replace(/\/$/, '')
}
async function display(c: Config) { set({ enabled: c.enabled, endpoint: c.endpoint, defaultMinutes: c.defaultMinutes, lastSynced: c.lastSynced, url: c.enabled ? await feedUrl(c) : '' }) }
async function request(c: Config, method: 'PUT' | 'DELETE') {
  const response = await fetch(await feedUrl(c), { method, headers: { Authorization: `Bearer ${c.secret}`, ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}) }, ...(method === 'PUT' ? { body: JSON.stringify(calendarEntries(captureArchive(), c.defaultMinutes)) } : {}), signal: AbortSignal.timeout(20000), redirect: 'error' })
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw Error(data.error || `日历同步失败（HTTP ${response.status}），请检查日历服务部署`) }
}
function enqueue(job: () => Promise<void>) {
  const run = async () => {
    set({ busy: true, error: false })
    try {
      if (navigator.locks) await navigator.locks.request('time-scheduler-calendar', job); else await job()
    } catch (error) { set({ error: true, message: error instanceof Error ? error.message : '日历同步失败，联网后可重试' }) }
    finally { set({ busy: false }) }
  }
  queue = queue.then(run, run)
  return queue
}
const later = () => { clearTimeout(timer); timer = setTimeout(() => { void syncCalendarNow() }, 1200) }
export function startCalendarSync() {
  return boot ||= (async () => {
    try { config = await browserVault.get<Config>(vaultKey); if (config) await display(config) }
    catch (error) { set({ error: true, message: error instanceof Error ? error.message : '无法读取日历设置' }) }
    set({ ready: true })
    useEventStore.subscribe((a, b) => { if (a.events !== b.events || a.eventChains !== b.eventChains || a.eventTypes !== b.eventTypes) later() })
    window.addEventListener('online', later); window.addEventListener('focus', later)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') later() })
    await syncCalendarNow()
  })()
}
export function syncCalendarNow() {
  return enqueue(async () => {
    config = await browserVault.get<Config>(vaultKey)
    if (!config?.enabled) { if (config) await display(config); return }
    if (!navigator.onLine) { set({ message: '当前离线，联网后自动更新订阅日历', error: true }); return }
    await display(config); set({ message: '正在更新订阅日历…' })
    await request(config, 'PUT')
    config = { ...config, lastSynced: Date.now() }; await browserVault.set(vaultKey, config); await display(config)
    set({ message: '订阅内容已更新，等待系统日历自行刷新', error: false })
  })
}
export async function enableCalendarSync(address: string, defaultMinutes: number) {
  await enqueue(async () => {
    const target = endpoint(address)
    const response = await fetch(`${target}/calendar/status`, { signal: AbortSignal.timeout(10000), redirect: 'error' })
    if (!response.ok || !(await response.json()).enabled) throw Error('此服务尚未开通日历订阅，请部署日历存储后重试；也可先下载日历文件')
    const previous = await browserVault.get<Config>(vaultKey)
    if (previous?.enabled && previous.endpoint !== target) throw Error('请先停用原订阅，再更换服务地址')
    const secret = previous?.endpoint === target ? previous.secret : Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
    config = { enabled: true, endpoint: target, secret, defaultMinutes }
    await browserVault.set(vaultKey, config); await display(config)
    await request(config, 'PUT'); config.lastSynced = Date.now(); await browserVault.set(vaultKey, config); await display(config)
    set({ message: '订阅已生成。首次请在系统日历中添加订阅并开启提醒', error: false })
  })
}
export function disableCalendarSync() {
  return enqueue(async () => {
    const stored = await browserVault.get<Config>(vaultKey)
    if (!stored) return
    // Only mark disabled after the remote feed is cleared; failed revocations can retry.
    await request(stored, 'DELETE')
    config = { ...stored, enabled: false }; await browserVault.set(vaultKey, config); await display(config)
    set({ message: '订阅内容已清空；请在系统日历中移除该订阅。刷新前旧提醒可能仍保留', error: false })
  })
}
export function downloadCalendar(defaultMinutes = 30) {
  const blob = new Blob([calendarIcs(calendarEntries(captureArchive(), defaultMinutes))], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = '时间规划器.ics'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
