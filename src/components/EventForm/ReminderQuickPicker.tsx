import React, { useState, useCallback } from 'react'
import { Bell, X, Plus } from 'lucide-react'
import { Reminder, ReminderTime } from '../../types/event'
import { generateId } from '../../utils/idGenerator'

interface Props {
  reminders: Reminder[]
  onChange: (reminders: Reminder[]) => void
  compact?: boolean
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
  { value: 'at-time', label: '发生时', pinned: false },
]

const LABELS: Record<string, string> = {
  '1w': '1周前', '3d': '3天前', '1d': '1天前', '6h': '6h前', '2h': '2h前',
  '30min': '30min前', '10min': '10min前', '5min': '5min前', '2min': '2min前', 'at-time': '发生时',
}

export default function ReminderQuickPicker({ reminders, onChange, compact }: Props) {
  const [showMore, setShowMore] = useState(false)
  const [customMin, setCustomMin] = useState('')

  const pinned = DEFAULT_OPTIONS.filter(o => o.pinned)
  const unpinned = DEFAULT_OPTIONS.filter(o => !o.pinned)

  const handleToggle = useCallback((id: string) => {
    onChange(reminders.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }, [reminders, onChange])

  const handleRemove = useCallback((id: string) => {
    onChange(reminders.filter(r => r.id !== id))
  }, [reminders, onChange])

  const handleAdd = useCallback((time: ReminderTime) => {
    if (reminders.some(r => r.time === time && r.enabled)) return
    onChange([...reminders, { id: generateId('reminder'), time, enabled: true, notified: false }])
  }, [reminders, onChange])

  const handleCustomAdd = useCallback(() => {
    const min = parseInt(customMin)
    if (isNaN(min) || min <= 0 || min > 10080) return
    const timeStr = `${min}min` as ReminderTime
    if (reminders.some(r => r.time === timeStr)) return
    onChange([...reminders, { id: generateId('reminder'), time: timeStr, enabled: true, notified: false }])
    setCustomMin('')
  }, [customMin, reminders, onChange])

  const pad = compact ? 'px-2 py-1' : 'px-3 py-1.5'

  return (
    <div className={compact ? 'space-y-2 p-2 min-w-52' : 'space-y-3'}>
      {/* Active reminders */}
      {reminders.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400"><Bell className="w-3.5 h-3.5" /> 已激活</div>
          <div className="flex flex-wrap gap-1">
            {reminders.map(r => (
              <label key={r.id}
                className={`inline-flex items-center gap-1 ${pad} text-xs rounded-full cursor-pointer border transition-colors ${
                  r.enabled
                    ? 'bg-accent-100 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300 border-accent-200 dark:border-accent-800'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400 border-slate-200 dark:border-slate-600 line-through'
                }`}>
                <input type="checkbox" checked={r.enabled} onChange={() => handleToggle(r.id)} className="w-3 h-3 rounded" />
                <span>{LABELS[r.time] || r.time}</span>
                <button onClick={(e) => { e.preventDefault(); handleRemove(r.id) }}
                  className="text-slate-400 hover:text-red-500 ml-0.5"><X className="w-3 h-3" /></button>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Quick add presets */}
      <div className="flex flex-wrap gap-1">
        {pinned.map(o => {
          const exists = reminders.some(r => r.time === o.value && r.enabled)
          return (
            <button key={o.value} onClick={() => handleAdd(o.value)}
              className={`${pad} text-xs rounded-full border transition-colors ${
                exists
                  ? 'bg-accent-100 dark:bg-accent-900/20 text-accent-400 border-accent-200 dark:border-accent-800 cursor-default'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-accent-100 dark:hover:bg-accent-900/20 hover:text-accent-700 dark:hover:text-accent-300 hover:border-accent-200'
              }`}>
              {o.label}
            </button>
          )
        })}
        {!showMore ? (
          <button onClick={() => setShowMore(true)}
            className={`${pad} text-xs rounded-full border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700`}>
            <Plus className="w-3 h-3 inline mr-0.5" />更多
          </button>
        ) : (
          <button onClick={() => setShowMore(false)}
            className={`${pad} text-xs rounded-full border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700`}>
            收起
          </button>
        )}
      </div>

      {/* More presets + custom */}
      {showMore && (
        <>
          <div className="flex flex-wrap gap-1">
            {unpinned.map(o => {
              const exists = reminders.some(r => r.time === o.value && r.enabled)
              return (
                <button key={o.value} onClick={() => handleAdd(o.value)}
                  className={`${pad} text-xs rounded-full border transition-colors ${
                    exists
                      ? 'bg-accent-100 dark:bg-accent-900/20 text-accent-400 border-accent-200 dark:border-accent-800 cursor-default'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-accent-100 dark:hover:bg-accent-900/20 hover:text-accent-700 dark:hover:text-accent-300 hover:border-accent-200'
                  }`}>
                  {o.label}
                </button>
              )
            })}
          </div>
          <div className="flex gap-1">
            <input type="number" value={customMin} onChange={e => setCustomMin(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCustomAdd() }}
              placeholder="分钟" min="1" max="10080"
              className={`${compact ? 'w-14 text-[10px] px-1.5 py-1' : 'w-20 text-xs px-2 py-1'} border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-accent-500/40 focus:border-accent-500`} />
            <button onClick={handleCustomAdd}
              className={`${compact ? 'text-[10px] px-2 py-1' : 'text-xs px-3 py-1'} bg-accent-600 text-white rounded hover:bg-accent-700 shadow-sm shadow-accent-600/20`}>
              添加
            </button>
          </div>
        </>
      )}

    </div>
  )
}
