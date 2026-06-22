import React, { useMemo, useEffect } from 'react'
import { X, Play } from 'lucide-react'
import { BatchRule, Event } from '../types/event'
import useEventStore from '../stores/eventStore'
import { executeCreateRule, executeModifyRule } from '../utils/batchRuleUtils'

interface BatchRulePreviewModalProps {
  chainId: string
  rule: BatchRule
  onExecute: () => void
  onClose: () => void
}

export default function BatchRulePreviewModal({ chainId, rule, onExecute, onClose }: BatchRulePreviewModalProps) {
  const events = useEventStore((s) => s.events)
  const eventChains = useEventStore((s) => s.eventChains)
  const semesterStartDate = useEventStore((s) => s.semesterStartDate)
  const chain = eventChains.get(chainId)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const createResults = useMemo(() => {
    if (rule.mode !== 'create') return []
    return executeCreateRule(rule, chainId, semesterStartDate)
  }, [rule, chainId, semesterStartDate])

  const modifyResults = useMemo(() => {
    if (rule.mode !== 'modify') return []
    const allEvents = Array.from(events.values())
    return executeModifyRule(rule, chainId, allEvents, semesterStartDate)
  }, [rule, chainId, events, semesterStartDate])

  function fmtDate(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  function fmtTime(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  function getDayLabel(d: Date): string {
    return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  }

  const weekLabel = { every: '每周', odd: '奇数周', even: '偶数周' }[rule.weekPattern]
  const dayLabel = rule.daysOfWeek.map((d) => ['日', '一', '二', '三', '四', '五', '六'][d]).join('、')

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] animate-modal-backdrop" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-modal dark:shadow-modal-dark max-w-xl w-full max-h-[85vh] flex flex-col animate-modal-panel border border-slate-200/60 dark:border-slate-700/60" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">规则预览</h2>
            <p className="text-sm text-slate-500 mt-0.5">{rule.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <p>模式：{rule.mode === 'create' ? '批量创建' : '批量修改'} | {weekLabel} | 周{dayLabel}</p>
          {rule.mode === 'create' && rule.createTime && (
            <p>时间段：{rule.createTime.startTime} ~ {rule.createTime.endTime}</p>
          )}
          {rule.mode === 'modify' && rule.modifyFilter && (
            <p>目标：每天第 {rule.modifyFilter.position} 个事件</p>
          )}
          <p>
            将影响
            <span className="font-semibold text-accent-600">
              {rule.mode === 'create' ? createResults.length : modifyResults.length}
            </span>
            个事件
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {rule.mode === 'create' && createResults.length === 0 && (
            <p className="text-slate-500 text-center py-8">没有匹配的日期，请检查规则配置</p>
          )}
          {rule.mode === 'modify' && modifyResults.length === 0 && (
            <p className="text-slate-500 text-center py-8">没有匹配的事件，请检查规则配置</p>
          )}

          {rule.mode === 'create' && createResults.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500 mb-2">将创建以下事件：</p>
              {createResults.slice(0, 100).map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded bg-slate-50 dark:bg-slate-700/50 text-sm">
                  <span className="text-slate-400 w-6 text-right">{i + 1}</span>
                  <span className="text-slate-700 dark:text-slate-300">{fmtDate(r.startTime)}</span>
                  <span className="text-slate-500">周{getDayLabel(r.startTime)}</span>
                  <span className="text-accent-600 font-medium">{fmtTime(r.startTime)} ~ {fmtTime(r.endTime)}</span>
                </div>
              ))}
              {createResults.length > 100 && (
                <p className="text-xs text-slate-500 text-center pt-2">... 共 {createResults.length} 条，仅展示前 100 条</p>
              )}
            </div>
          )}

          {rule.mode === 'modify' && modifyResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 mb-2">将修改以下事件：</p>
              {modifyResults.slice(0, 100).map((r, i) => (
                <div key={i} className="px-3 py-2 rounded bg-slate-50 dark:bg-slate-700/50 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 w-6 text-right">{i + 1}</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{r.event.name}</span>
                    <span className="text-slate-500">{fmtDate(new Date(r.event.startTime))} 周{getDayLabel(new Date(r.event.startTime))}</span>
                  </div>
                  <div className="ml-8 text-xs text-slate-500 space-y-0.5">
                    <p>时间：{fmtTime(new Date(r.event.startTime))} ~ {fmtTime(new Date(r.event.endTime))}</p>
                    {Object.entries(r.updates).map(([key, val]) => {
                      if (key === 'startTime' || key === 'endTime') {
                        return <p key={key}>{key === 'startTime' ? '开始' : '结束'}时间 → {fmtTime(new Date(val as Date))}</p>
                      }
                      return <p key={key}>{key} → {String(val)}</p>
                    })}
                  </div>
                </div>
              ))}
              {modifyResults.length > 100 && (
                <p className="text-xs text-slate-500 text-center pt-2">... 共 {modifyResults.length} 条，仅展示前 100 条</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-medium transition-colors">
            取消
          </button>
          <button
            onClick={onExecute}
            disabled={rule.mode === 'create' ? createResults.length === 0 : modifyResults.length === 0}
            className="flex-1 px-4 py-2 bg-accent-600 hover:bg-accent-700 shadow-sm shadow-accent-600/20 disabled:bg-accent-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            确认执行
          </button>
        </div>
      </div>
    </div>
  )
}
