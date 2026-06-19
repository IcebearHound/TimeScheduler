/**
 * 冲突解决对话框 - 拖拽排序设置优先级
 */
import React, { useState } from 'react'
import { X, GripVertical, Star, ChevronUp, ChevronDown } from 'lucide-react'
import { EventConflict } from '../types/event'
import useEventStore from '../stores/eventStore'

interface Props {
  conflicts: EventConflict[]
  onClose: () => void
  onResolve: () => void
}

export default function ConflictDialog({ conflicts, onClose, onResolve }: Props) {
  const eventStore = useEventStore.getState()
  const allEventIds = conflicts.flatMap(c => c.eventIds)
  const uniqueIds = [...new Set(allEventIds)]
  const [orderedIds, setOrderedIds] = useState<string[]>(uniqueIds)

  const moveUp = (i: number) => {
    if (i === 0) return
    const no = [...orderedIds]; [no[i - 1], no[i]] = [no[i], no[i - 1]]; setOrderedIds(no)
  }
  const moveDown = (i: number) => {
    if (i === orderedIds.length - 1) return
    const no = [...orderedIds]; [no[i], no[i + 1]] = [no[i + 1], no[i]]; setOrderedIds(no)
  }

  const handleConfirm = () => {
    orderedIds.forEach((id, i) => { eventStore.updateEvent(id, { priority: i + 1 }) })
    onResolve()
  }

  if (conflicts.length === 0) return null

  const formatDT = (d: Date) => d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">时间冲突检测</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">以下事件存在重叠，请调整优先级（越靠上越优先）</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-6">
          {conflicts.map((conflict, ci) => (
            <div key={ci} className="mb-6 last:mb-0">
              <div className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-3">
                {formatDT(new Date(conflict.startTime))} - {formatDT(new Date(conflict.endTime))}
              </div>
              <div className="space-y-2">
                {orderedIds.filter(id => conflict.eventIds.includes(id)).map((eid, idx) => {
                  const evt = eventStore.getEvent(eid)
                  const chain = evt ? eventStore.getEventChain(evt.chainId) : null
                  const type = evt ? eventStore.getEventType(evt.typeId) : null
                  if (!evt) return null
                  return (
                    <div key={eid}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30"
                      style={{ borderLeft: `4px solid ${chain?.color || '#3B82F6'}` }}>
                      <div className="flex flex-col gap-1">
                        <button onClick={() => moveUp(idx)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><ChevronUp className="w-4 h-4" /></button>
                        <button onClick={() => moveDown(idx)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><ChevronDown className="w-4 h-4" /></button>
                      </div>
                      <GripVertical className="w-4 h-4 text-slate-400" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{type?.emoji}</span>
                          <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{evt.name}</span>
                          {evt.isHighlight && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                        </div>
                        {chain && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{chain.name}</div>}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">优先级: {idx + 1}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button onClick={onClose} className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-medium transition-colors">取消</button>
            <button onClick={handleConfirm} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">确认优先级</button>
          </div>
        </div>
      </div>
    </div>
  )
}
