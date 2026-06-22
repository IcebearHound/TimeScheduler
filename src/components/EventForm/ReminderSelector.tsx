/**
 * 提醒选择器 - 可编辑快速添加、自定义时间、置顶预设
 */
import React, { useState, useMemo, useCallback } from 'react'
import { ChevronDown, Bell, X, Pin, PinOff } from 'lucide-react'
import { ReminderTime, Reminder } from '../../types/event'
import { generateId } from '../../utils/idGenerator'

interface ReminderSelectorProps {
  reminders: Reminder[]
  onChange: (reminders: Reminder[]) => void
  isHighlight?: boolean
}

const DEFAULT_OPTIONS: Array<{ value: ReminderTime; label: string; pinned: boolean }> = [
  { value: '1w', label: '1周前', pinned: false },
  { value: '3d', label: '3天前', pinned: false },
  { value: '1d', label: '1天前', pinned: true },
  { value: '6h', label: '6小时前', pinned: false },
  { value: '2h', label: '2小时前', pinned: true },
  { value: '30min', label: '30分钟前', pinned: true },
  { value: '10min', label: '10分钟前', pinned: false },
  { value: '5min', label: '5分钟前', pinned: false },
  { value: '2min', label: '2分钟前', pinned: false },
  { value: 'at-time', label: '事件开始时刻', pinned: false },
]

const TIME_LABELS: Record<string, string> = {
  '1w': '1周前', '3d': '3天前', '1d': '1天前', '6h': '6h前', '2h': '2h前',
  '30min': '30min前', '10min': '10min前', '5min': '5min前', '2min': '2min前', 'at-time': '发生时',
}

export default function ReminderSelector({ reminders, onChange, isHighlight }: ReminderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customMin, setCustomMin] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const [pinnedSet, setPinnedSet] = useState<Set<string>>(new Set(DEFAULT_OPTIONS.filter(o => o.pinned).map(o => o.value)))

  const displayR = useMemo(() => {
    if (isHighlight && reminders.length === 0) {
      return [
        { id: 'hl-1d', time: '1d' as ReminderTime, enabled: true, notified: false },
        { id: 'hl-2h', time: '2h' as ReminderTime, enabled: true, notified: false },
        { id: 'hl-30min', time: '30min' as ReminderTime, enabled: true, notified: false },
      ]
    }
    return reminders
  }, [isHighlight, reminders])

  const activeLabels = displayR.filter(r => r.enabled).map(r => TIME_LABELS[r.time] || r.time)

  const handleAdd = useCallback((time: ReminderTime) => {
    if (displayR.some(r => r.time === time && r.enabled)) return
    onChange([...reminders, { id: generateId('reminder'), time, enabled: true, notified: false }])
  }, [reminders, onChange, displayR])

  const handleRemove = useCallback((id: string) => {
    onChange(reminders.filter(r => r.id !== id))
  }, [reminders, onChange])

  const handleToggle = useCallback((id: string) => {
    onChange(reminders.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }, [reminders, onChange])

  const handleCustomAdd = useCallback(() => {
    const min = parseInt(customMin)
    if (isNaN(min) || min <= 0) return
    const label = customLabel.trim() || `${min}分钟前`
    const timeStr = `${min}min` as ReminderTime
    if (displayR.some(r => r.time === timeStr)) return
    onChange([...reminders, { id: generateId('reminder'), time: timeStr, enabled: true, notified: false }])
    setCustomMin(''); setCustomLabel('')
  }, [customMin, customLabel, reminders, onChange, displayR])

  const togglePin = useCallback((value: string) => {
    setPinnedSet(prev => { const n = new Set(prev); if (n.has(value)) n.delete(value); else n.add(value); return n })
  }, [])

  const pinnedOpts = DEFAULT_OPTIONS.filter(o => pinnedSet.has(o.value))
  const unpinnedOpts = DEFAULT_OPTIONS.filter(o => !pinnedSet.has(o.value))

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">提醒时间</label>

      <button type="button" onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:border-slate-400 dark:hover:border-slate-500 transition-colors">
        <div className="flex items-center gap-2 text-left">
          <Bell className="w-4 h-4 text-slate-500" />
          <span className="text-sm">{displayR.length === 0 ? '未设置提醒' : `${displayR.filter(r => r.enabled).length} 个提醒`}</span>
          {activeLabels.length > 0 && <span className="text-xs text-slate-500 dark:text-slate-400">({activeLabels.slice(0, 3).join(', ')}{activeLabels.length > 3 ? '...' : ''})</span>}
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
          {/* 已激活提醒 */}
          {displayR.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">已激活</h4>
              {displayR.map(r => (
                <div key={r.id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-700/50 rounded">
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input type="checkbox" checked={r.enabled} onChange={() => handleToggle(r.id)} className="w-4 h-4 rounded" />
                    <span className="text-sm text-slate-700 dark:text-slate-200">{TIME_LABELS[r.time] || r.time}</span>
                  </label>
                  <button type="button" onClick={() => handleRemove(r.id)} className="text-red-400 hover:text-red-600 text-xs"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}

          {/* 置顶快速添加 */}
          <div className="border-t border-slate-200 dark:border-slate-600 pt-3">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">快速添加（置顶）</h4>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {pinnedOpts.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => handleAdd(opt.value)}
                  className="group flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-accent-100 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300 hover:bg-accent-200 dark:hover:bg-accent-900/40 transition-colors">
                  {opt.label}
                  <span onClick={e => { e.stopPropagation(); togglePin(opt.value) }}
                    className="opacity-0 group-hover:opacity-100 text-accent-400 hover:text-accent-600" title="取消置顶">
                    <PinOff className="w-2.5 h-2.5" />
                  </span>
                </button>
              ))}
            </div>

            {/* 未置顶项 */}
            <details className="cursor-pointer">
              <summary className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">更多选项</summary>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {unpinnedOpts.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => handleAdd(opt.value)}
                    className="group flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                    {opt.label}
                    <span onClick={e => { e.stopPropagation(); togglePin(opt.value) }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600" title="置顶">
                      <Pin className="w-2.5 h-2.5" />
                    </span>
                  </button>
                ))}
              </div>
            </details>
          </div>

          {/* 自定义时间 */}
          <div className="border-t border-slate-200 dark:border-slate-600 pt-3">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">自定义提醒时间</h4>
            <div className="flex gap-2">
              <input type="number" value={customMin} onChange={e => setCustomMin(e.target.value)} min="1" max="10080"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCustomAdd() } }}
                className="w-24 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-accent-500/40 focus:border-accent-500" placeholder="分钟数" />
              <input type="text" value={customLabel} onChange={e => setCustomLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCustomAdd() } }}
                className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-accent-500/40 focus:border-accent-500" placeholder="标签（可选）" />
              <button type="button" onClick={handleCustomAdd}
                className="px-3 py-1 text-xs bg-accent-600 text-white rounded hover:bg-accent-700 shadow-sm shadow-accent-600/20 transition-colors">添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
