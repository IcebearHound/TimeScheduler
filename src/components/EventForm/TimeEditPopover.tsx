import React from 'react'
import { Clock } from 'lucide-react'

interface Props {
  startTime: Date
  endTime: Date
  onStartChange: (d: Date) => void
  onEndChange: (d: Date) => void
  onClose: () => void
}

const DURATION_OPTS = [
  { label: '30min', min: 30 },
  { label: '1h', min: 60 },
  { label: '1.5h', min: 90 },
  { label: '2h', min: 120 },
  { label: '3h', min: 180 },
]

function toLocalDT(d: Date) {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0'); const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

export default function TimeEditPopover({ startTime, endTime, onStartChange, onEndChange, onClose }: Props) {
  const handleStart = (val: string) => {
    const d = new Date(val)
    if (isNaN(d.getTime())) return
    const dur = endTime.getTime() - startTime.getTime()
    onStartChange(d)
    onEndChange(new Date(d.getTime() + dur))
  }

  const handleEnd = (val: string) => {
    const d = new Date(val)
    if (isNaN(d.getTime())) return
    if (d.getTime() > startTime.getTime()) onEndChange(d)
  }

  const handleDuration = (min: number) => {
    onEndChange(new Date(startTime.getTime() + min * 60000))
  }

  const durMin = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-slate-500"><Clock className="w-3.5 h-3.5" /> 编辑时间</span>
      </div>

      <div className="space-y-1.5">
        <div>
          <label className="text-[10px] text-slate-400 block mb-0.5">开始</label>
          <input type="datetime-local" value={toLocalDT(startTime)} onChange={e => handleStart(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-accent-500/40 focus:border-accent-500" />
        </div>

        <div className="flex flex-wrap gap-1">
          {DURATION_OPTS.map(o => (
            <button key={o.min} onClick={() => handleDuration(o.min)}
              className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                durMin === o.min
                  ? 'bg-accent-600 text-white border-accent-600 shadow-sm shadow-accent-600/20'
                  : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 hover:border-accent-300'
              }`}>
              {o.label}
            </button>
          ))}
        </div>

        <div>
          <label className="text-[10px] text-slate-400 block mb-0.5">结束</label>
          <input type="datetime-local" value={toLocalDT(endTime)} onChange={e => handleEnd(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-accent-500/40 focus:border-accent-500" />
        </div>
      </div>
    </div>
  )
}
