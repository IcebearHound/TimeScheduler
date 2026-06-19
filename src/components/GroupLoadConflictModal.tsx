/**
 * 事件组加载冲突解决模态框
 */
import React, { useState, useMemo } from 'react'
import { X, ChevronUp, ChevronDown } from 'lucide-react'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import { EventGroup, Event } from '../types/event'

interface GroupLoadConflictModalProps {
  newGroup: EventGroup
  existingGroupId?: string
  onClose: () => void
  onResolve: (resolution: 'top' | 'bottom' | 'priority' | 'manual') => void
}

export default function GroupLoadConflictModal({
  newGroup,
  existingGroupId,
  onClose,
  onResolve,
}: GroupLoadConflictModalProps) {
  const eventStore = useEventStore.getState()
  const groupStore = useEventGroupStore.getState()
  const groups = groupStore.getAllGroups()

  const handleResolve = (resolution: 'top' | 'bottom' | 'priority') => {
    if (resolution === 'top') {
      groupStore.updateGroup(newGroup.id, { name: newGroup.name })
      groupStore.setActiveGroup(newGroup.id)
    } else if (resolution === 'bottom') {
      groupStore.setActiveGroup(newGroup.id)
    }
    onResolve(resolution)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">加载事件组</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            加载 <strong>{newGroup.name}</strong> 时检测到可能与现有事件存在时间冲突。请选择处理方式：
          </p>

          <button
            onClick={() => handleResolve('top')}
            className="w-full text-left p-4 rounded-lg border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <div className="font-medium text-blue-700 dark:text-blue-300">置顶事件组</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              导入的事件组优先级最高，冲突时优先显示
            </div>
          </button>

          <button
            onClick={() => handleResolve('bottom')}
            className="w-full text-left p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <div className="font-medium text-slate-700 dark:text-slate-300">置底事件组</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              导入的事件组优先级最低，现有事件优先显示
            </div>
          </button>

          <button
            onClick={() => handleResolve('priority')}
            className="w-full text-left p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <div className="font-medium text-slate-700 dark:text-slate-300">根据优先级顺序</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              按照左侧事件组列表的排列顺序，越靠上的优先显示
            </div>
          </button>

          <button
            onClick={() => onResolve('manual')}
            className="w-full text-left p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <div className="font-medium text-slate-700 dark:text-slate-300">手动设置</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              逐个事件手动调整优先级排序
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
