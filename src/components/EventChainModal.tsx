/**
 * 事件链管理模态框
 */
import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, Edit2, Eye, Play, ChevronDown, ChevronRight } from 'lucide-react'
import useEventStore from '../stores/eventStore'
import useUIStore from '../stores/uiStore'
import { EventChain, BatchRule } from '../types/event'
import { dialogAlert } from '../utils/dialog'
import BatchRuleModal from './BatchRuleModal'
import BatchRulePreviewModal from './BatchRulePreviewModal'

interface EventChainModalProps {
  mode: 'create' | 'edit'
  chainId?: string
  onClose: () => void
  onCreated?: (chainId: string) => void
}

export default function EventChainModal({ mode, chainId, onClose, onCreated }: EventChainModalProps) {
  const eventStore = useEventStore.getState()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])
  const eventTypes = eventStore.getAllEventTypes()
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [typeId, setTypeId] = useState(eventTypes[0]?.id || 'type-course')
  const [color, setColor] = useState('#3B82F6')
  const [batchRules, setBatchRules] = useState<BatchRule[]>([])
  const [showRules, setShowRules] = useState(false)
  const [ruleModal, setRuleModal] = useState<{ mode: 'create' | 'edit'; rule?: BatchRule } | null>(null)
  const [previewRule, setPreviewRule] = useState<BatchRule | null>(null)
  const [chainIdForPreview, setChainIdForPreview] = useState<string>('')
  const [editingChainId, setEditingChainId] = useState<string | undefined>(chainId)

  useEffect(() => {
    if (mode === 'edit' && chainId) {
      const store = useEventStore.getState()
      const chain = store.getEventChain(chainId)
      if (chain) {
        setName(chain.name)
        setDescription(chain.description || '')
        setTypeId(chain.typeId)
        setColor(chain.color)
        setBatchRules(chain.batchRules || [])
        setEditingChainId(chainId)
      }
    }
  }, [mode, chainId])

  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#F97316', '#84CC16', '#6366F1',
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      dialogAlert('请输入事件链名称', '提示')
      return
    }

    if (mode === 'create') {
      const chain = eventStore.addEventChain({
        name: name.trim(),
        description: description.trim(),
        typeId,
        color,
        defaultReminders: [],
        batchRules,
      })
      if (batchRules.length > 0 && chain) {
        eventStore.applyAllBatchRules(chain.id)
      }
      onCreated?.(chain.id)
    } else if (mode === 'edit' && chainId) {
      eventStore.updateEventChain(chainId, {
        name: name.trim(),
        description: description.trim(),
        typeId,
        color,
        batchRules,
      })
    }

    onClose()
  }

  function handleSaveRule(rule: BatchRule) {
    if (ruleModal?.mode === 'create') {
      setBatchRules((prev) => [...prev, rule])
    } else {
      setBatchRules((prev) => prev.map((r) => (r.id === rule.id ? rule : r)))
    }
    setRuleModal(null)
  }

  function handleDeleteRule(ruleId: string) {
    setBatchRules((prev) => prev.filter((r) => r.id !== ruleId))
  }

  function handlePreviewRule(rule: BatchRule) {
    const cid = editingChainId || ''
    setChainIdForPreview(cid)
    setPreviewRule(rule)
  }

  function handleExecuteRule(rule: BatchRule) {
    const cid = editingChainId
    if (!cid) {
      const chain = eventStore.addEventChain({
        name: name.trim() || '未命名链',
        description: description.trim(),
        typeId,
        color,
        defaultReminders: [],
        batchRules,
      })
      eventStore.executeBatchRule(chain.id, rule.id)
      setEditingChainId(chain.id)
      onCreated?.(chain.id)
    } else {
      // 先同步本地 batchRules 到 store，确保执行的是最新规则
      eventStore.updateEventChain(cid, { batchRules })
      eventStore.executeBatchRule(cid, rule.id)
    }
    setPreviewRule(null)
  }

  function getRuleSummary(rule: BatchRule): string {
    const weekLabel = { every: '每周', odd: '奇数周', even: '偶数周' }[rule.weekPattern]
    const days = rule.daysOfWeek.map((d) => ['日', '一', '二', '三', '四', '五', '六'][d]).join('、')
    if (rule.mode === 'create' && rule.createTime) {
      return `${weekLabel}周${days} ${rule.createTime.startTime}~${rule.createTime.endTime}`
    }
    if (rule.mode === 'modify' && rule.modifyFilter) {
      return `${weekLabel}周${days} 第${rule.modifyFilter.position}个事件`
    }
    return ''
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-modal-backdrop" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-modal dark:shadow-modal-dark border border-slate-200/60 dark:border-slate-700/60 max-w-md w-full animate-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-200/60 dark:border-slate-700/60">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {mode === 'create' ? '创建事件链' : '编辑事件链'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              事件链名称 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500/40"
              placeholder="例如：计组、操作系统"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500/40 resize-none"
              rows={2}
              placeholder="事件链描述（可选）"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              默认事件类型
            </label>
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500/40"
            >
              {eventTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.emoji} {type.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              事件链颜色
            </label>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c
                      ? 'border-slate-900 dark:border-white scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200/60 dark:border-slate-700/60 pt-4">
            <button
              type="button"
              onClick={() => setShowRules(!showRules)}
              className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors w-full"
            >
              {showRules ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              批量规则 ({batchRules.length})
            </button>

            {showRules && (
              <div className="mt-3 space-y-2">
                {batchRules.length === 0 && (
                  <p className="text-sm text-slate-500 py-2">暂无规则，点击下方按钮添加</p>
                )}
                {batchRules.map((rule) => (
                  <div key={rule.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm">
                    <span className={`w-2 h-2 rounded-full ${rule.mode === 'create' ? 'bg-green-500' : 'bg-orange-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 dark:text-white truncate font-medium">{rule.name}</p>
                      <p className="text-xs text-slate-500 truncate">{getRuleSummary(rule)}</p>
                    </div>
                    <button type="button" onClick={() => handlePreviewRule(rule)} className="p-1 text-slate-400 hover:text-blue-500 transition-colors" title="预览">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => handleExecuteRule(rule)} className="p-1 text-slate-400 hover:text-green-500 transition-colors" title="执行">
                      <Play className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setRuleModal({ mode: 'edit', rule })} className="p-1 text-slate-400 hover:text-blue-500 transition-colors" title="编辑">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => handleDeleteRule(rule.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="删除">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setRuleModal({ mode: 'create' })}
                  className="w-full px-3 py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-500 hover:text-accent-600 hover:border-accent-400 dark:hover:text-accent-400 dark:hover:border-accent-500 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  添加规则
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-lg font-medium transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-accent-600 hover:bg-accent-700 shadow-sm shadow-accent-600/20 text-white rounded-lg font-medium transition-colors"
            >
              {mode === 'create' ? '创建' : '保存'}
            </button>
          </div>
        </form>
      </div>

      {ruleModal && (
        <BatchRuleModal
          mode={ruleModal.mode}
          rule={ruleModal.rule || null}
          onSave={handleSaveRule}
          onClose={() => setRuleModal(null)}
        />
      )}

      {previewRule && (
        <BatchRulePreviewModal
          chainId={chainIdForPreview}
          rule={previewRule}
          onExecute={() => handleExecuteRule(previewRule)}
          onClose={() => setPreviewRule(null)}
        />
      )}
    </div>
  )
}
