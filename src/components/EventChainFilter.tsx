import React from 'react'
import useUIStore from '../stores/uiStore'
import useEventStore from '../stores/eventStore'
import { CheckSquare } from 'lucide-react'

interface Props {
  onContextMenu?: (e: React.MouseEvent, typeId: string, typeName: string) => void
  editMode?: boolean
  selectedTypes?: Set<string>
  onToggleSelect?: (typeId: string) => void
}

export default function EventChainFilter({ onContextMenu, editMode, selectedTypes, onToggleSelect }: Props) {
  const filterTypeIds = useUIStore((s) => s.filterTypeIds)
  const addTypeFilter = useUIStore((s) => s.addTypeFilter)
  const removeTypeFilter = useUIStore((s) => s.removeTypeFilter)
  const eventTypes = useEventStore((s) => s.eventTypes)

  const allTypes = Array.from(eventTypes.values())

  const toggleFilter = (typeId: string, checked: boolean) => {
    if (checked) removeTypeFilter(typeId)
    else addTypeFilter(typeId)
  }

  const renderCheckbox = (typeId: string) => {
    if (editMode && selectedTypes && onToggleSelect) {
      const sel = selectedTypes.has(typeId)
      return (
        <div className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${sel ? 'border-accent-500 bg-accent-500' : 'border-slate-300'}">
          {sel && <CheckSquare className="w-3 h-3" style={{ color: 'white' }} />}
        </div>
      )
    }
    return <input type="checkbox" checked={!filterTypeIds.has(typeId)} onChange={e => toggleFilter(typeId, e.target.checked)} className="w-4 h-4 rounded" />
  }

  const handleClick = (typeId: string) => {
    if (editMode && onToggleSelect) {
      onToggleSelect(typeId)
    }
  }

  return (
    <div className="space-y-0.5">
      {allTypes.map(type => (
        <div key={type.id} className={`flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${editMode ? 'cursor-pointer' : ''}`}
          onClick={() => handleClick(type.id)}
          onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, type.id, type.name) }}>
          {renderCheckbox(type.id)}
          <span className="text-lg">{type.emoji}</span>
          <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{type.name}</span>
        </div>
      ))}
      {allTypes.length === 0 && <div className="text-xs text-slate-400 py-2">暂无事件类型</div>}
    </div>
  )
}
