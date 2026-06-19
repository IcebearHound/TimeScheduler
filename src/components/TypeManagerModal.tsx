/**
 * 事件类型管理模态框
 */
import React, { useState, useEffect } from 'react'
import { X, Plus, Edit2, Trash2, Check, MapPin, User, BookOpen, Clock, Bell, Link, Tag, Star, FileText, Home, Car, Phone, Mail, Globe, Coffee } from 'lucide-react'
import useEventStore from '../stores/eventStore'
import { EventType, EventTypeCategory, PropertyField } from '../types/event'

interface TypeManagerModalProps {
  onClose: () => void
  editTypeId?: string | null
}

const PRESET_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#84CC16']

const ICON_OPTIONS: { name: string; component: React.ReactNode }[] = [
  { name: 'MapPin', component: <MapPin className="w-4 h-4" /> },
  { name: 'User', component: <User className="w-4 h-4" /> },
  { name: 'BookOpen', component: <BookOpen className="w-4 h-4" /> },
  { name: 'Clock', component: <Clock className="w-4 h-4" /> },
  { name: 'Bell', component: <Bell className="w-4 h-4" /> },
  { name: 'Link', component: <Link className="w-4 h-4" /> },
  { name: 'Tag', component: <Tag className="w-4 h-4" /> },
  { name: 'Star', component: <Star className="w-4 h-4" /> },
  { name: 'FileText', component: <FileText className="w-4 h-4" /> },
  { name: 'Home', component: <Home className="w-4 h-4" /> },
  { name: 'Car', component: <Car className="w-4 h-4" /> },
  { name: 'Phone', component: <Phone className="w-4 h-4" /> },
  { name: 'Mail', component: <Mail className="w-4 h-4" /> },
  { name: 'Globe', component: <Globe className="w-4 h-4" /> },
  { name: 'Coffee', component: <Coffee className="w-4 h-4" /> },
]

const EMOJI_OPTIONS = [
  '📚', '📝', '🔬', '💻', '🎯', '🏃', '🎵', '🎨', '🏷️', '⭐',
  '📖', '✏️', '🧪', '🖥️', '📊', '🗂️', '💡', '🔥', '📌', '🎓',
  '📋', '📎', '🗓️', '✅', '❌', '⏰', '🔔', '📢', '💬', '🏠',
  '🚗', '✈️', '🍽️', '☕', '💊', '🏥', '💰', '📱', '🎮', '🎬',
]

export default function TypeManagerModal({ onClose, editTypeId }: TypeManagerModalProps) {
  const eventStore = useEventStore.getState()
  const allTypes = eventStore.getAllEventTypes()
  const deleteEventType = useEventStore((s) => s.deleteEventType)
  const addEventType = useEventStore((s) => s.addEventType)
  const updateEventType = useEventStore((s) => s.updateEventType)

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>(editTypeId ? 'edit' : 'list')
  const [editingId, setEditingId] = useState<string | null>(editTypeId || null)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🏷️')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [color, setColor] = useState('#8B5CF6')
  const [propertyFields, setPropertyFields] = useState<PropertyField[]>([])
  const [newPropField, setNewPropField] = useState('')
  const [newPropIcon, setNewPropIcon] = useState<string>('Tag')

  useEffect(() => {
    if (editTypeId) {
      const t = eventStore.getEventType(editTypeId)
      if (t) {
        setEditingId(t.id)
        setName(t.name)
        setEmoji(t.emoji)
        setColor(t.color)
        setPropertyFields(t.propertyFields || [])
        setShowEmojiPicker(false)
        setShowIconPicker(false)
        setMode('edit')
      }
    }
  }, [editTypeId])

  function resetForm() {
    setName('')
    setEmoji('🏷️')
    setColor('#8B5CF6')
    setPropertyFields([])
    setNewPropField('')
    setNewPropIcon('')
    setShowEmojiPicker(false)
    setShowIconPicker(false)
  }

  function startCreate() {
    resetForm()
    setMode('create')
  }

  function startEdit(type: EventType) {
    setEditingId(type.id)
    setName(type.name)
    setEmoji(type.emoji)
    setColor(type.color)
    setPropertyFields(type.propertyFields || [])
    setShowEmojiPicker(false)
    setMode('edit')
  }

  function handleSubmit() {
    if (!name.trim()) return
    if (mode === 'edit' && editingId) {
      updateEventType(editingId, { name: name.trim(), emoji, color, propertyFields, parentId: undefined })
    } else {
      addEventType({ name: name.trim(), emoji, category: 'custom', color, propertyFields })
    }
    setMode('list')
    resetForm()
  }

  function handleAddPropField() {
    const v = newPropField.trim()
    if (v && !propertyFields.find(p => p.name === v)) {
      setPropertyFields([...propertyFields, { name: v, icon: newPropIcon || undefined }])
      setNewPropField('')
    setNewPropIcon('Tag')
    }
  }

  function handleDelete(type: EventType) {
    if (confirm(`确定删除类型「${type.name}」？`)) {
      deleteEventType(type.id)
    }
  }

  const inputClass = 'w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const btnBase = 'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {mode === 'list' ? '事件类型' : mode === 'create' ? '新建类型' : '编辑类型'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">

        {mode === 'list' && (
          <div className="p-5">
            {allTypes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">暂无类型</p>
            ) : (
              <div className="space-y-1.5 mb-4">
                {allTypes.map(t => (
                  <div key={t.id}
                    onDoubleClick={() => startEdit(t)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      const actions = [
                        { label: '编辑', action: () => startEdit(t) },
                        { label: '删除', action: () => handleDelete(t), danger: true },
                      ]
                      const menu = document.createElement('div')
                      menu.className = 'fixed bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-[100] overflow-hidden'
                      menu.style.left = e.clientX + 'px'
                      menu.style.top = e.clientY + 'px'
                      actions.forEach(({ label, action, danger }) => {
                        const btn = document.createElement('button')
                        btn.className = `flex items-center gap-2 w-full px-3 py-1.5 text-xs ${danger ? 'text-red-600' : 'text-slate-700 dark:text-slate-200'} hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap`
                        btn.textContent = label
                        btn.onclick = () => { action(); menu.remove() }
                        menu.appendChild(btn)
                      })
                      document.body.appendChild(menu)
                      const remove = () => menu.remove()
                      document.addEventListener('click', remove, { once: true })
                    }}
                    className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                    <span className="text-base flex-shrink-0">{t.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{t.name}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {(t.propertyFields || []).length > 0
                          ? t.propertyFields!.map(f => {
                              const name = typeof f === 'string' ? f : f.name
                              return (
                                <span key={name} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">{name}</span>
                              )
                            })
                          : <span className="text-[10px] text-slate-400">无绑定属性</span>
                        }
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); startEdit(t) }}
                      className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all text-slate-500">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={startCreate}
              className="w-full py-2.5 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-500 hover:text-blue-600 hover:border-blue-400 dark:hover:text-blue-400 dark:hover:border-blue-500 transition-colors flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" />
              新建类型
            </button>
          </div>
        )}

        {(mode === 'create' || mode === 'edit') && (
          <div className="p-5 space-y-4">
            <div className="flex gap-3 items-end">
              <div className="relative flex-shrink-0">
                <label className="block text-xs text-slate-500 mb-1">Emoji</label>
                <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="w-10 h-9 flex items-center justify-center border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 hover:opacity-80">
                  {emoji}
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-2 grid grid-cols-10 gap-1 z-50">
                    {EMOJI_OPTIONS.map(e => (
                      <button key={e} type="button" onClick={() => { setEmoji(e); setShowEmojiPicker(false) }}
                        className="w-7 h-7 flex items-center justify-center rounded text-base hover:bg-slate-100 dark:hover:bg-slate-700">
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">名称</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full h-9 px-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="类型名" autoFocus />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">颜色</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}>
                    {color === c && <Check className="w-3 h-3 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">绑定属性字段</label>
              <div className="flex gap-1 mb-1.5">
                <div className="relative">
                  <button type="button" onClick={() => setShowIconPicker(!showIconPicker)}
                    className="w-8 h-7 flex items-center justify-center border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
                    title="选择图标">
                    {newPropIcon ? ICON_OPTIONS.find(i => i.name === newPropIcon)?.component : <Tag className="w-3.5 h-3.5 text-slate-400 dark:text-slate-300" />}
                  </button>
                  {showIconPicker && (
                    <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 grid grid-cols-8 gap-0.5 z-50 w-64">
                      <button type="button" onClick={() => { setNewPropIcon(''); setShowIconPicker(false) }}
                        className="w-7 h-7 flex items-center justify-center rounded text-[10px] text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">无</button>
                      {ICON_OPTIONS.map(opt => (
                        <button key={opt.name} type="button" onClick={() => { setNewPropIcon(opt.name); setShowIconPicker(false) }}
                          className={`w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${newPropIcon === opt.name ? 'bg-blue-100 dark:bg-blue-900/30 ring-1 ring-blue-300' : ''}`}>
                          {opt.component}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input type="text" value={newPropField} onChange={e => setNewPropField(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPropField() } }}
                  className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="属性名，如 地点" />
                <button type="button" onClick={handleAddPropField}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              {propertyFields.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {propertyFields.map(f => (
                    <span key={f.name} className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                      {f.icon && ICON_OPTIONS.find(i => i.name === f.icon)?.component}
                      {f.name}
                      <button type="button" onClick={() => setPropertyFields(propertyFields.filter(p => p.name !== f.name))}
                        className="text-blue-400 hover:text-red-500">&times;</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setMode('list'); resetForm() }}
                className="flex-1 px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors">
                返回
              </button>
              <button onClick={handleSubmit}
                disabled={!name.trim()}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
                {mode === 'create' ? '创建' : '保存'}
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
