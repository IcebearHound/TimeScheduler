/**
 * 事件组导出模态框 - 支持单击选择、Ctrl多选、双击选中整个事件链
 */
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { X, Check, FolderOpen, Link, Eye, CheckSquare } from 'lucide-react'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import { FileManager } from '../utils/fileManager'
import { Event, EventChain } from '../types/event'

interface EventGroupExportModalProps {
  groupId: string
  onClose: () => void
}

export default function EventGroupExportModal({ groupId, onClose }: EventGroupExportModalProps) {
  const eventStore = useEventStore.getState()
  const groupStore = useEventGroupStore.getState()
  const group = groupStore.getGroup(groupId)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set(group?.eventIds || []))
  const [selectedChainIds, setSelectedChainIds] = useState<Set<string>>(new Set(group?.eventChainIds || []))
  const [previewEventId, setPreviewEventId] = useState<string | null>(null)
  const lastClickedRef = useRef<string>('')

  const allEvents = eventStore.getAllEvents()
  const allChains = eventStore.getAllEventChains()

  const allSelected = selectedChainIds.size === allChains.length && selectedEventIds.size === allEvents.length && allChains.length > 0

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedChainIds(new Set())
      setSelectedEventIds(new Set())
    } else {
      setSelectedChainIds(new Set(allChains.map(c => c.id)))
      setSelectedEventIds(new Set(allEvents.map(e => e.id)))
    }
  }, [allSelected, allChains, allEvents])

  const toggleEvent = useCallback((eventId: string) => {
    setSelectedEventIds(prev => {
      const next = new Set(prev)
      if (next.has(eventId)) next.delete(eventId)
      else next.add(eventId)
      return next
    })
  }, [])

  const toggleChain = useCallback((chainId: string) => {
    setSelectedChainIds(prev => {
      const next = new Set(prev)
      if (next.has(chainId)) next.delete(chainId)
      else next.add(chainId)
      return next
    })
    const chainEvents = eventStore.getEventsByChain(chainId)
    if (selectedChainIds.has(chainId)) {
      chainEvents.forEach(e => setSelectedEventIds(s => { const ns = new Set(s); ns.delete(e.id); return ns }))
    } else {
      chainEvents.forEach(e => setSelectedEventIds(s => new Set(s).add(e.id)))
    }
  }, [selectedChainIds, eventStore])

  const handleDoubleClickChain = useCallback((chainId: string) => {
    // 双击整个事件链加入/取消
    const chainEvents = eventStore.getEventsByChain(chainId)
    if (selectedChainIds.has(chainId)) {
      setSelectedChainIds(prev => { const n = new Set(prev); n.delete(chainId); return n })
      chainEvents.forEach(e => setSelectedEventIds(s => { const n = new Set(s); n.delete(e.id); return n }))
    } else {
      setSelectedChainIds(prev => new Set(prev).add(chainId))
      chainEvents.forEach(e => setSelectedEventIds(s => new Set(s).add(e.id)))
    }
  }, [selectedChainIds, eventStore])

  const handleExport = () => {
    const exportGroup = {
      id: groupId,
      name: group?.name || '导出事件组',
      emoji: group?.emoji || '📁',
      eventChainIds: Array.from(selectedChainIds),
      eventIds: Array.from(selectedEventIds),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const content = FileManager.exportEventGroup(exportGroup)
    FileManager.downloadAsFile(content, `${exportGroup.name}.events`)
    onClose()
  }

  if (!group) return null

  const previewEvent = previewEventId ? eventStore.getEvent(previewEventId) : undefined
  const previewChain = previewEvent ? eventStore.getEventChain(previewEvent.chainId) : undefined
  const previewType = previewEvent ? eventStore.getEventType(previewEvent.typeId) : undefined

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-modal-backdrop" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-modal dark:shadow-modal-dark max-w-2xl w-full max-h-[85vh] flex flex-col animate-modal-panel border border-slate-200/60 dark:border-slate-700/60" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">导出事件组 "{group.name}"</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              单击选择/取消 · <strong>双击事件链</strong>选中/取消整链
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* 左侧选择列表 */}
          <div className="flex-1 overflow-y-auto p-5 border-r border-slate-200 dark:border-slate-800">
            {/* 事件链 */}
            <div className="mb-5">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                <Link className="w-4 h-4" /> 事件链
                <button
                  onClick={toggleSelectAll}
                  className="ml-auto text-xs text-accent-500 hover:text-accent-700 dark:text-accent-400 flex items-center gap-1"
                >
                  <CheckSquare className="w-3 h-3" /> {allSelected ? '取消全选' : '全选'}
                </button>
              </h3>
              <div className="space-y-1">
                {allChains.map(chain => {
                  const isSelected = selectedChainIds.has(chain.id)
                  const eventsInChain = eventStore.getEventsByChain(chain.id)
                  return (
                    <div
                      key={chain.id}
                      onClick={() => toggleChain(chain.id)}
                      onDoubleClick={(e) => { e.preventDefault(); handleDoubleClickChain(chain.id) }}
                      className={`w-full text-left flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer ${
                        isSelected ? 'bg-accent-50 dark:bg-accent-900/20 ring-1 ring-accent-300' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0"
                        style={isSelected ? { borderColor: '#3B82F6', backgroundColor: '#3B82F6' } : { borderColor: '#D1D5DB' }}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: chain.color }} />
                      <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{chain.name}</span>
                      <span className="text-xs text-slate-400">{eventsInChain.length} 个</span>
                    </div>
                  )
                })}
                {allChains.length === 0 && <div className="text-xs text-slate-400 p-2">暂无事件链</div>}
              </div>
            </div>

            {/* 单独事件 */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                <FolderOpen className="w-4 h-4" /> 单独事件
                <button
                  onClick={toggleSelectAll}
                  className="ml-auto text-xs text-accent-500 hover:text-accent-700 dark:text-accent-400 flex items-center gap-1"
                >
                  <CheckSquare className="w-3 h-3" /> {allSelected ? '取消全选' : '全选'}
                </button>
              </h3>
              <div className="space-y-1">
                {allEvents.map(event => {
                  const isSelected = selectedEventIds.has(event.id)
                  const type = eventStore.getEventType(event.typeId)
                  return (
                    <div
                      key={event.id}
                      onClick={() => toggleEvent(event.id)}
                      className={`w-full text-left flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer ${
                        isSelected ? 'bg-accent-50 dark:bg-accent-900/20 ring-1 ring-accent-300' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0"
                        style={isSelected ? { borderColor: '#3B82F6', backgroundColor: '#3B82F6' } : { borderColor: '#D1D5DB' }}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm">{type?.emoji}</span>
                      <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{event.name}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(event.startTime).toLocaleDateString('zh-CN')}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setPreviewEventId(event.id) }}
                        className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                        title="预览"
                      >
                        <Eye className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                  )
                })}
                {allEvents.length === 0 && <div className="text-xs text-slate-400 p-2">暂无事件</div>}
              </div>
            </div>
          </div>

          {/* 右侧预览区 */}
          <div className="w-60 p-4 overflow-y-auto bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">预览</h3>
            {previewEvent ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">{previewEvent.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {new Date(previewEvent.startTime).toLocaleDateString('zh-CN')}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(previewEvent.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} -
                    {new Date(previewEvent.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {previewChain && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: previewChain.color }} />
                      {previewChain.name}
                    </div>
                  )}
                  {previewType && (
                    <span className="inline-flex items-center gap-1 mt-1 text-xs px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: previewType.color + '20', color: previewType.color }}>
                      {previewType.emoji} {previewType.name}
                    </span>
                  )}
                  {previewEvent.properties.location && (
                    <div className="text-xs text-slate-400 mt-1">地点: {previewEvent.properties.location}</div>
                  )}
                  {previewEvent.properties.teacher && (
                    <div className="text-xs text-slate-400">老师: {previewEvent.properties.teacher}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">点击事件旁的 👁 预览详情</div>
            )}
          </div>
        </div>

        {/* 底部信息栏 */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-600 dark:text-slate-300">
              已选择: {selectedChainIds.size} 个事件链, {selectedEventIds.size} 个事件
            </span>
            <button
              onClick={() => { setSelectedChainIds(new Set()); setSelectedEventIds(new Set()) }}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
            >
              清空选择
            </button>
            <button
              onClick={toggleSelectAll}
              className="text-xs text-accent-500 hover:text-accent-700 dark:text-accent-400 underline"
            >
              {allSelected ? '取消全选' : '全选'}
            </button>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-medium text-sm transition-colors">
              取消
            </button>
            <button onClick={handleExport}
              disabled={selectedEventIds.size === 0 && selectedChainIds.size === 0}
              className="flex-1 px-4 py-2 bg-accent-600 hover:bg-accent-700 shadow-sm shadow-accent-600/20 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              导出 .events 文件
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
