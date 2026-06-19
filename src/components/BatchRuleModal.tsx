import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { BatchRule, BatchRuleMode, WeekPattern } from '../types/event'
import { generateId } from '../utils/idGenerator'

interface BatchRuleModalProps {
  mode: 'create' | 'edit'
  rule?: BatchRule | null
  onSave: (rule: BatchRule) => void
  onClose: () => void
}

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function emptyRule(): BatchRule {
  return {
    id: generateId('rule'),
    name: '',
    mode: 'create',
    weekPattern: 'every',
    daysOfWeek: [1],
    weekRange: { type: 'weekNumber', startWeek: 1, endWeek: 16 },
    createTime: { startTime: '08:00', endTime: '10:00' },
  }
}

export default function BatchRuleModal({ mode, rule, onSave, onClose }: BatchRuleModalProps) {
  const [name, setName] = useState('')
  const [ruleMode, setRuleMode] = useState<BatchRuleMode>('create')
  const [weekPattern, setWeekPattern] = useState<WeekPattern>('every')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1])
  const [rangeType, setRangeType] = useState<'weekNumber' | 'dateRange'>('weekNumber')
  const [startWeek, setStartWeek] = useState(1)
  const [endWeek, setEndWeek] = useState(16)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [createStartTime, setCreateStartTime] = useState('08:00')
  const [createEndTime, setCreateEndTime] = useState('10:00')
  const [position, setPosition] = useState(1)
  const [updateName, setUpdateName] = useState('')
  const [updateDescription, setUpdateDescription] = useState('')
  const [startOffset, setStartOffset] = useState(0)
  const [endOffset, setEndOffset] = useState(0)

  useEffect(() => {
    if (mode === 'edit' && rule) {
      setName(rule.name || '')
      setRuleMode(rule.mode)
      setWeekPattern(rule.weekPattern)
      setDaysOfWeek(rule.daysOfWeek.length > 0 ? rule.daysOfWeek : [1])
      setRangeType(rule.weekRange.type)
      setStartWeek(rule.weekRange.startWeek ?? 1)
      setEndWeek(rule.weekRange.endWeek ?? 16)
      setStartDate(rule.weekRange.startDate ? toDateInput(rule.weekRange.startDate) : '')
      setEndDate(rule.weekRange.endDate ? toDateInput(rule.weekRange.endDate) : '')
      if (rule.mode === 'create' && rule.createTime) {
        setCreateStartTime(rule.createTime.startTime)
        setCreateEndTime(rule.createTime.endTime)
      }
      if (rule.mode === 'modify') {
        setPosition(rule.modifyFilter?.position ?? 1)
        setUpdateName(rule.modifyUpdates?.name ?? '')
        setUpdateDescription(rule.modifyUpdates?.description ?? '')
        setStartOffset(rule.modifyUpdates?.startTimeOffset ?? 0)
        setEndOffset(rule.modifyUpdates?.endTimeOffset ?? 0)
      }
    }
  }, [mode, rule])

  function toDateInput(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  function handleSave() {
    if (!name.trim()) return

    const batchRule: BatchRule = {
      id: mode === 'create' ? generateId('rule') : rule!.id,
      name: name.trim(),
      mode: ruleMode,
      weekPattern,
      daysOfWeek,
      weekRange: rangeType === 'weekNumber'
        ? { type: 'weekNumber', startWeek, endWeek }
        : { type: 'dateRange', startDate: startDate ? new Date(startDate) : undefined, endDate: endDate ? new Date(endDate) : undefined },
      ...(ruleMode === 'create' ? { createTime: { startTime: createStartTime, endTime: createEndTime } } : {}),
      ...(ruleMode === 'modify' ? {
        modifyFilter: { position },
        modifyUpdates: {
          name: updateName || undefined,
          description: updateDescription || undefined,
          startTimeOffset: startOffset,
          endTimeOffset: endOffset,
        },
      } : {}),
    }

    onSave(batchRule)
  }

  const btnBase = 'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors'
  const activeBtn = 'bg-blue-600 text-white'
  const inactiveBtn = 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
  const inputClass = 'w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {mode === 'create' ? '添加规则' : '编辑规则'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">规则名称 *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="如：周一上午课" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">操作模式</label>
            <div className="flex gap-2">
              <button onClick={() => setRuleMode('create')} className={`${btnBase} ${ruleMode === 'create' ? activeBtn : inactiveBtn}`}>批量创建</button>
              <button onClick={() => setRuleMode('modify')} className={`${btnBase} ${ruleMode === 'modify' ? activeBtn : inactiveBtn}`}>批量修改</button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">周模式</label>
            <div className="flex gap-2">
              {(['every', 'odd', 'even'] as const).map((p) => (
                <button key={p} onClick={() => setWeekPattern(p)} className={`${btnBase} ${weekPattern === p ? activeBtn : inactiveBtn}`}>
                  {{ every: '每周', odd: '奇数周', even: '偶数周' }[p]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">星期</label>
            <div className="flex gap-2">
              {DAY_LABELS.map((label, i) => (
                <button key={i} onClick={() => toggleDay(i)} className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${daysOfWeek.includes(i) ? activeBtn : inactiveBtn}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">周范围类型</label>
            <div className="flex gap-2 mb-2">
              <button onClick={() => setRangeType('weekNumber')} className={`${btnBase} ${rangeType === 'weekNumber' ? activeBtn : inactiveBtn}`}>按周编号</button>
              <button onClick={() => setRangeType('dateRange')} className={`${btnBase} ${rangeType === 'dateRange' ? activeBtn : inactiveBtn}`}>按日期范围</button>
            </div>
            {rangeType === 'weekNumber' ? (
              <div className="flex gap-3 items-center">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">起始周</label>
                  <input type="number" min={1} max={52} value={startWeek} onChange={(e) => setStartWeek(Number(e.target.value))} className={inputClass} />
                </div>
                <span className="text-slate-400 mt-5">~</span>
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">结束周</label>
                  <input type="number" min={1} max={52} value={endWeek} onChange={(e) => setEndWeek(Number(e.target.value))} className={inputClass} />
                </div>
              </div>
            ) : (
              <div className="flex gap-3 items-center">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">起始日期</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
                </div>
                <span className="text-slate-400 mt-5">~</span>
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">结束日期</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
                </div>
              </div>
            )}
          </div>

          {ruleMode === 'create' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">创建时间段</label>
              <div className="flex gap-3 items-center">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">开始时间</label>
                  <input type="time" value={createStartTime} onChange={(e) => setCreateStartTime(e.target.value)} className={inputClass} />
                </div>
                <span className="text-slate-400 mt-5">~</span>
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">结束时间</label>
                  <input type="time" value={createEndTime} onChange={(e) => setCreateEndTime(e.target.value)} className={inputClass} />
                </div>
              </div>
            </div>
          )}

          {ruleMode === 'modify' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">位置筛选（该天第几个事件）</label>
                <input type="number" min={1} value={position} onChange={(e) => setPosition(Math.max(1, Number(e.target.value)))} className={inputClass} />
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">修改字段（留空表示不修改）</p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">事件名称</label>
                    <input type="text" value={updateName} onChange={(e) => setUpdateName(e.target.value)} className={inputClass} placeholder="留空不修改" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">描述</label>
                    <input type="text" value={updateDescription} onChange={(e) => setUpdateDescription(e.target.value)} className={inputClass} placeholder="留空不修改" />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">开始时间偏移（分钟）</label>
                      <input type="number" value={startOffset} onChange={(e) => setStartOffset(Number(e.target.value))} className={inputClass} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">结束时间偏移（分钟）</label>
                      <input type="number" value={endOffset} onChange={(e) => setEndOffset(Number(e.target.value))} className={inputClass} />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button onClick={onClose} className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-medium transition-colors">
              取消
            </button>
            <button onClick={handleSave} disabled={!name.trim()} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">
              保存规则
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
