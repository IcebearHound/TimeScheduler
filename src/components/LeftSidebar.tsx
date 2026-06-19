/**
 * 左侧边栏 — 可折叠分区 + 拖动调整分区大小
 */
import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Plus, Download, Upload, Trash2, Edit2, Layers, Filter, Tag, Copy,
  FolderOpen, ChevronUp, ChevronDown, Link, CheckSquare, Square, PanelLeftClose, ChevronRight, MousePointer2
} from 'lucide-react'
import useUIStore from '../stores/uiStore'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import { EventGroup } from '../types/event'
import EventChainFilter from './EventChainFilter'
import EventGroupExportModal from './EventGroupExportModal'
import GroupLoadConflictModal from './GroupLoadConflictModal'
import EventChainModal from './EventChainModal'
import { FileManager } from '../utils/fileManager'
import { dialogAlert, dialogConfirm } from '../utils/dialog'

const EMOJIS = ['📁', '📚', '📝', '🔬', '💻', '🎯', '🏃', '🎨', '🎵', '💼', '🏠', '❤️', '⭐', '🔥', '💡', '🎓', '📅', '⏰', '🔔', '⚡', '🌟', '🎪', '🏆', '📋', '🔧', '🎯', '✏️', '📖', '🗂️', '📍', '🔖', '💎']

type SectionKey = 'groups' | 'chains' | 'types'

export default function LeftSidebar() {
  const eventStore = useEventStore.getState()
  const groups = useEventGroupStore((s) => s.groupOrder.map(id => s.groups.get(id)).filter(Boolean) as EventGroup[])
  const activeGroupId = useEventGroupStore((s) => s.activeGroupId)
  const setActiveGroup = useEventGroupStore((s) => s.setActiveGroup)


  const addGroup = useEventGroupStore((s) => s.addGroup)
  const deleteGroup = useEventGroupStore((s) => s.deleteGroup)
  const updateGroup = useEventGroupStore((s) => s.updateGroup)
  const moveGroupUp = useEventGroupStore((s) => s.moveGroupUp)
  const moveGroupDown = useEventGroupStore((s) => s.moveGroupDown)
  const mergeGroups = useEventGroupStore((s) => s.mergeGroups)
  const setIsTypeManagerOpen = useUIStore((s) => s.setIsTypeManagerOpen)
  const setTypeToEditId = useUIStore((s) => s.setTypeToEditId)
  const setIsLeftSidebarOpen = useUIStore((s) => s.setIsLeftSidebarOpen)
  const setCurrentDate = useUIStore((s) => s.setCurrentDate)
  const setSelectedEvent = useUIStore((s) => s.setSelectedEvent)

  const allChains = useEventStore((s) => Array.from(s.eventChains.values()))

  const [showNewGroupInput, setShowNewGroupInput] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupEmoji, setNewGroupEmoji] = useState('📁')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingEmojiGroupId, setEditingEmojiGroupId] = useState<string | null>(null)
  const [showExportModal, setShowExportModal] = useState<string | null>(null)
  const [showConflictModal, setShowConflictModal] = useState<any | null>(null)
  const [showChainModal, setShowChainModal] = useState(false)
  const [editingChainId, setEditingChainId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [chainEditMode, setChainEditMode] = useState(false)
  const [chainDblClick, setChainDblClick] = useState<string | null>(null)
  const [typesEditMode, setTypesEditMode] = useState(false)
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set())
  const [selectedChains, setSelectedChains] = useState<Set<string>>(new Set())
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'group' | 'chain'; id: string; name: string } | null>(null)
  const [mergeModal, setMergeModal] = useState<{ ids: string[]; order: string[] } | null>(null)
  const [groupInfoPopup, setGroupInfoPopup] = useState<{ g: EventGroup; anchor: DOMRect } | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; type: 'group' | 'chain' | 'type'; id: string; name: string } | null>(null)
  const [emojiPos, setEmojiPos] = useState({ x: 0, y: 0 })
  const [, forceUpdate] = useState(0)

  // 折叠状态
  const [collapsed, setCollapsed] = useState<Set<SectionKey>>(new Set())
  const toggleCollapse = (key: SectionKey) => setCollapsed(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
  const isCollapsed = (key: SectionKey) => collapsed.has(key)

  // 分区高度 (flex比例)
  const [heights, setHeights] = useState({ groups: 1, chains: 1, types: 1 })
  const resizeRef = useRef<{ key: 'groups-chains' | 'chains-types'; sy: number; groups: number; chains: number; types: number } | null>(null)

  const startResize = (e: React.MouseEvent, key: 'groups-chains' | 'chains-types') => {
    e.preventDefault()
    resizeRef.current = { key, sy: e.clientY, groups: heights.groups, chains: heights.chains, types: heights.types }
    const move = (me: MouseEvent) => {
      if (!resizeRef.current) return
      const dy = me.clientY - resizeRef.current.sy
      const delta = Math.round(dy / 30)
      if (resizeRef.current.key === 'groups-chains') {
        setHeights(h => ({ ...h, groups: Math.max(0.3, Math.min(3, resizeRef.current!.groups + delta * 0.1)), chains: Math.max(0.3, Math.min(3, resizeRef.current!.chains - delta * 0.1)) }))
      } else {
        setHeights(h => ({ ...h, chains: Math.max(0.3, Math.min(3, resizeRef.current!.chains + delta * 0.1)), types: Math.max(0.3, Math.min(3, resizeRef.current!.types - delta * 0.1)) }))
      }
    }
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); resizeRef.current = null }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }

  // --- 事件组操作 ---
  const handleCreateGroup = () => {
    let name = newGroupName.trim() || '新事件组'
    const en = groups.map(g => g.name)
    if (en.includes(name)) { let i = 2; while (en.includes(`${name} ${i}`)) i++; name = `${name} ${i}` }
    addGroup({ name, emoji: newGroupEmoji, eventChainIds: [], eventIds: [] })
    setNewGroupName(''); setNewGroupEmoji('📁'); setShowEmojiPicker(false); setShowNewGroupInput(false)
  }
  const handleDeleteGroup = (id: string) => { const g = useEventGroupStore.getState().groups.get(id); if (g) setDeleteConfirm({ type: 'group', id, name: g.name }) }
  const handleDeleteSelected = async () => {
    if (selectedForDelete.size === 0) return
    const ok = await dialogConfirm(`确定删除选中的 ${selectedForDelete.size} 个事件组吗？`, '批量删除', 'danger')
    if (ok) { selectedForDelete.forEach(id => deleteGroup(id)); setSelectedForDelete(new Set()); setEditMode(false); useUIStore.getState().addToast(`已批量删除 · Ctrl+Z 撤回`, '撤回', () => useEventStore.getState().undo()) }
  }
  const toggleSelectGroup = (id: string) => setSelectedForDelete(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const handleRenameStart = (id: string, n: string) => { setEditingGroupId(id); setEditingName(n) }
  const handleRenameSave = (id: string) => { if (editingName.trim()) updateGroup(id, { name: editingName.trim() }); setEditingGroupId(null) }
  const handleExportGroup = (id: string) => setShowExportModal(id)
  const handleImportGroup = async () => {
    try {
      const c = await FileManager.uploadFile('.events,.json')
      const r = FileManager.importEventGroup(c)
      if (r.success && r.groupId) { const ng = useEventGroupStore.getState().getGroup(r.groupId); if (ng) { const cf = eventStore.detectConflicts(); if (cf.length > 0) setShowConflictModal(ng) } }
      else dialogAlert(r.error || '导入失败', '导入错误')
    } catch (e: any) { dialogAlert('导入失败: ' + (e.message || ''), '导入错误') }
  }
  const handleMergeGroups = () => {
    // Ctrl+多选后点击合并按钮
    if (selectedForDelete.size < 2) { dialogAlert('请先按住 Ctrl 多选至少两个事件组'); return }
    const ids = Array.from(selectedForDelete)
    setMergeModal({ ids, order: [...ids] })
  }

  const doMergeGroups = () => {
    if (!mergeModal || mergeModal.order.length < 2) return
    const targetId = mergeModal.order[0]
    const sources = mergeModal.order.slice(1)
    for (const sid of sources) {
      useEventGroupStore.getState().mergeGroups(targetId, sid)
    }
    useUIStore.getState().addToast(`已合并 ${mergeModal.order.length} 个事件组 · Ctrl+Z 撤回`, '撤回', () => useEventStore.getState().undo())
    setMergeModal(null)
    setSelectedForDelete(new Set())
    setEditMode(false)
  }

  const moveMergeItem = (idx: number, dir: -1 | 1) => {
    if (!mergeModal) return
    const no = [...mergeModal.order]
    const ni = idx + dir
    if (ni < 0 || ni >= no.length) return
    [no[idx], no[ni]] = [no[ni], no[idx]]
    setMergeModal({ ...mergeModal, order: no })
  }

  // --- 事件链操作 ---
  const handleCreateChain = () => { setEditingChainId(null); setShowChainModal(true) }
  const handleEditChain = (id: string) => { setEditingChainId(id); setShowChainModal(true) }
  const handleDeleteChain = (id: string) => { const c = eventStore.getEventChain(id); if (c) setDeleteConfirm({ type: 'chain', id, name: c.name }) }
  const doConfirmDelete = () => {
    if (!deleteConfirm) return
    const targetId = deleteConfirm.id
    if (deleteConfirm.type === 'group') {
      const g = useEventGroupStore.getState().groups.get(targetId)
      if (g) {
        const es = useEventStore.getState()
        g.eventIds.forEach(eid => es.deleteEvent(eid))
        g.eventChainIds.forEach(cid => es.deleteEventChain(cid))
      }
      // 直接 setState：删组+自动创建默认组
      const s = useEventGroupStore.getState()
      const ng = new Map(s.groups)
      ng.delete(targetId)
      const no = s.groupOrder.filter((i: string) => i !== targetId)
      if (ng.size === 0) {
        const defId = 'default-' + Date.now()
        ng.set(defId, { id: defId, name: '默认事件组', emoji: '📁', eventChainIds: [], eventIds: [], createdAt: new Date(), updatedAt: new Date() })
        no.push(defId)
        useEventGroupStore.setState({ groups: ng, groupOrder: no, activeGroupId: defId })
      } else {
        useEventGroupStore.setState({ groups: ng, groupOrder: no, activeGroupId: s.activeGroupId === targetId ? (no[0] || '') : s.activeGroupId })
      }
      useEventGroupStore.getState().save()
      // 强制刷新
      forceUpdate(c => c + 1)
    } else {
      useEventStore.getState().deleteEventChain(targetId)
    }
    useUIStore.getState().addToast(`已删除「${deleteConfirm.name}」· Ctrl+Z 撤回`, '撤回', () => useEventStore.getState().undo())
    setDeleteConfirm(null)
  }
  const handleChainModalCreated = (id: string) => { const gid = useEventGroupStore.getState().ensureActiveGroup(); useEventGroupStore.getState().addEventChainToGroup(gid, id); setShowChainModal(false) }

  const handleMergeSelectedChains = () => {
    if (selectedChains.size < 2) return
    const ids = Array.from(selectedChains)
    const target = ids[0]
    const sources = ids.slice(1)
    useEventStore.getState().mergeEventChains(target, sources)
    useUIStore.getState().addToast(`已合并 ${ids.length} 个事件链 · Ctrl+Z 撤回`, '撤回', () => useEventStore.getState().undo())
    setSelectedChains(new Set())
    setChainEditMode(false)
  }

  // Section render helper
  const renderSectionHeader = (key: SectionKey, icon: React.ReactNode, title: string, actions?: React.ReactNode) => (
    <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30" onClick={() => toggleCollapse(key)}>
      <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        <ChevronRight className={`w-3 h-3 transition-transform ${isCollapsed(key) ? '' : 'rotate-90'}`} />
        {icon} {title}
      </h2>
      <div onClick={e => e.stopPropagation()}>{actions}</div>
    </div>
  )

  return (
    <div className="w-[min(20vw,18rem)] bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">导航</span>
        <button onClick={() => setIsLeftSidebarOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400"><PanelLeftClose className="w-3.5 h-3.5" /></button>
      </div>

      {/* ===== 事件组分区 ===== */}
      <div className="flex flex-col border-b border-slate-200 dark:border-slate-700" style={{ flex: isCollapsed('groups') ? '0 0 auto' : heights.groups, minHeight: isCollapsed('groups') ? 0 : 80 }}>
        {renderSectionHeader('groups', <Layers className="w-3.5 h-3.5" />, '事件组', (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setEditMode(!editMode); setSelectedForDelete(new Set()) }}
              className={`p-1 rounded transition-colors ${editMode ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400'}`}>
              {editMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowNewGroupInput(true) }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><Plus className="w-3.5 h-3.5 text-slate-500" /></button>
            <button onClick={(e) => { e.stopPropagation(); handleImportGroup() }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><Download className="w-3.5 h-3.5 text-slate-500" /></button>
          </div>
        ))}
        {!isCollapsed('groups') && (
          <div className="flex-1 overflow-y-auto px-3 pb-2">
            {editMode && selectedForDelete.size > 0 && (
              <div className="flex gap-1 mb-2">
                <button onClick={handleMergeGroups} disabled={selectedForDelete.size < 2}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs rounded-lg ${selectedForDelete.size >= 2 ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100' : 'text-slate-300 bg-slate-50 dark:bg-slate-800 cursor-not-allowed'}`}>
                  <FolderOpen className="w-3 h-3" /> 合并 ({selectedForDelete.size})
                </button>
                <button onClick={() => {
                  const g = groups.find(gr => selectedForDelete.has(gr.id))
                  if (g) {
                    const es = useEventStore.getState()
                    const idMap = new Map<string, string>()
                    // 深拷贝所有链
                    const newChainIds: string[] = []
                    for (const cid of g.eventChainIds) {
                      const c = es.getEventChain(cid)
                      if (c) {
                        const nc = es.addEventChain({ name: c.name, description: c.description, typeId: c.typeId, color: c.color, defaultReminders: [] })
                        idMap.set(cid, nc.id)
                        newChainIds.push(nc.id)
                        // 拷贝链内事件
                        const ce = es.getEventsByChain(cid)
                        ce.forEach(evt => {
                          const ne = es.addEvent({
                            name: evt.name, description: evt.description,
                            startTime: new Date(evt.startTime), endTime: new Date(evt.endTime),
                            chainId: nc.id, typeId: evt.typeId, reminders: [...evt.reminders],
                            properties: { ...evt.properties }, isHighlight: evt.isHighlight, priority: evt.priority,
                          })
                        })
                      }
                    }
                    // 拷贝独立事件
                    const newEventIds: string[] = []
                    for (const eid of g.eventIds) {
                      const evt = es.getEvent(eid)
                      if (evt) {
                        const ne = es.addEvent({
                          name: evt.name, description: evt.description,
                          startTime: new Date(evt.startTime), endTime: new Date(evt.endTime),
                          chainId: idMap.get(evt.chainId) || evt.chainId, typeId: evt.typeId, reminders: [...evt.reminders],
                          properties: { ...evt.properties }, isHighlight: evt.isHighlight, priority: evt.priority,
                        })
                        newEventIds.push(ne.id)
                      }
                    }
                    let name = g.name + ' (副本)'
                    let i = 2
                    while (groups.some(gr => gr.name === name)) name = `${g.name} (副本) ${i++}`
                    addGroup({ name, emoji: g.emoji, eventChainIds: newChainIds, eventIds: newEventIds })
                    setSelectedForDelete(new Set()); setEditMode(false)
                  }
                }} disabled={selectedForDelete.size !== 1}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs rounded-lg ${selectedForDelete.size === 1 ? 'text-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100' : 'text-slate-300 bg-slate-50 dark:bg-slate-800 cursor-not-allowed'}`}>
                  <Copy className="w-3 h-3" /> 复制
                </button>
                <button onClick={handleDeleteSelected} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-lg">
                  <Trash2 className="w-3 h-3" /> 删除 ({selectedForDelete.size})
                </button>
              </div>
            )}
            {showNewGroupInput && (
              <div className="mb-2">
                <div className="flex gap-1">
                  <div className="relative">
                    <button onClick={(e) => { setShowEmojiPicker(!showEmojiPicker); setEditingEmojiGroupId(null); setEmojiPos({ x: e.clientX, y: e.clientY }) }} className="w-10 h-8 text-lg border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 hover:bg-slate-50 flex items-center justify-center">{newGroupEmoji}</button>
                  </div>
                  <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') setShowNewGroupInput(false) }}
                    className="flex-1 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="事件组名称" autoFocus />
                  <button onClick={handleCreateGroup} className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">创建</button>
                </div>
              </div>
            )}
            <div className="space-y-0.5">
              {groups.map((g, idx) => {
                const isActive = g.id === activeGroupId
                return (
                  <div key={g.id}
                    onClick={() => { if (editMode) toggleSelectGroup(g.id); else setActiveGroup(g.id) }}
                    onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, type: 'group', id: g.id, name: g.name }) }}
                    onDoubleClick={e => {
                      if (!editMode) {
                        const rect = (e.target as HTMLElement).closest('.rounded-lg')?.getBoundingClientRect()
                        if (rect) setGroupInfoPopup({ g, anchor: rect })
                      }
                    }}
                    className={`p-2 rounded-lg cursor-pointer transition-all group border ${isActive && !editMode ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : selectedForDelete.has(g.id) ? 'bg-red-50 dark:bg-red-900/20 border-red-200' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-slate-200'}`}>
                    <div className="flex items-center gap-1.5">
                      {editMode ? (
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${selectedForDelete.has(g.id) ? 'border-red-500 bg-red-500' : 'border-slate-300'}`}>
                          {selectedForDelete.has(g.id) && <CheckSquare className="w-3 h-3 text-white" />}
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <button onClick={e => { e.stopPropagation(); moveGroupUp(g.id) }} className="text-slate-300 hover:text-slate-500 disabled:opacity-20" disabled={idx === 0}><ChevronUp className="w-3 h-3" /></button>
                          <button onClick={e => { e.stopPropagation(); moveGroupDown(g.id) }} className="text-slate-300 hover:text-slate-500 disabled:opacity-20" disabled={idx === groups.length - 1}><ChevronDown className="w-3 h-3" /></button>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {editingGroupId === g.id ? (
                          <input type="text" value={editingName} onChange={e => setEditingName(e.target.value)} onBlur={() => handleRenameSave(g.id)} onKeyDown={e => { if (e.key === 'Enter') handleRenameSave(g.id) }} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-blue-300 rounded bg-white dark:bg-slate-800 focus:outline-none" autoFocus />
                        ) : (
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                            <button onClick={e => { e.stopPropagation(); setEditingEmojiGroupId(g.id); setShowEmojiPicker(true); setEmojiPos({ x: e.clientX, y: e.clientY }) }}
                              className="inline hover:scale-110 transition-transform mr-1.5">{g.emoji}</button>{g.name}
                            {isActive && <span className="ml-1.5 text-[9px] font-bold text-blue-500 bg-blue-100 dark:bg-blue-900/30 px-1 rounded">当前</span>}
                          </p>
                        )}
                        <p className="text-xs text-slate-400">{g.eventChainIds.length} 链 · {g.eventIds.length} 事件</p>
                      </div>
                      {!editMode && (
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={e => { e.stopPropagation(); handleExportGroup(g.id) }} className="p-1 hover:bg-slate-200 rounded"><Upload className="w-3 h-3 text-slate-500" /></button>
                          <button onClick={e => { e.stopPropagation(); handleRenameStart(g.id, g.name) }} className="p-1 hover:bg-slate-200 rounded"><Edit2 className="w-3 h-3 text-slate-500" /></button>
                          <button onClick={e => { e.stopPropagation(); handleDeleteGroup(g.id) }} className="p-1 hover:bg-red-100 rounded"><Trash2 className="w-3 h-3 text-red-400" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 浮动 emoji 面板 */}
      {showEmojiPicker && (
        <div className="fixed inset-0 z-[140]" onClick={() => { setShowEmojiPicker(false); setEditingEmojiGroupId(null) }}>
          <div className="absolute p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl"
            style={{ left: Math.min(emojiPos.x, window.innerWidth - 340), top: Math.min(emojiPos.y, window.innerHeight - 260) }}>
            <div className="grid grid-cols-8 gap-1 w-80">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => {
                  if (editingEmojiGroupId) {
                    updateGroup(editingEmojiGroupId, { emoji: e })
                    setEditingEmojiGroupId(null)
                  } else {
                    setNewGroupEmoji(e)
                  }
                  setShowEmojiPicker(false)
                }} className="w-9 h-9 text-lg hover:bg-slate-100 dark:hover:bg-slate-700 rounded flex items-center justify-center">{e}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 拖动分隔条 */}
      <div onMouseDown={e => startResize(e, 'groups-chains')} className="h-1.5 cursor-row-resize hover:bg-blue-200/50 flex-shrink-0 transition-colors" />

      {/* ===== 事件链分区 ===== */}
      <div className="flex flex-col border-b border-slate-200 dark:border-slate-700" style={{ flex: isCollapsed('chains') ? '0 0 auto' : heights.chains, minHeight: isCollapsed('chains') ? 0 : 60 }}>
        {renderSectionHeader('chains', <Link className="w-3.5 h-3.5" />, '事件链', (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setChainEditMode(!chainEditMode); setSelectedChains(new Set()) }}
              className={`p-1 rounded transition-colors ${chainEditMode ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400'}`}>
              {chainEditMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleCreateChain() }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><Plus className="w-3.5 h-3.5 text-slate-500" /></button>
          </div>
        ))}
        {!isCollapsed('chains') && (
          <div className="flex-1 overflow-y-auto px-3 pb-2">
            {chainEditMode && selectedChains.size > 0 && (
              <div className="flex gap-1 mb-2">
                {selectedChains.size === 1 && (
                  <button onClick={() => {
                    const cid = Array.from(selectedChains)[0]
                    const es = useEventStore.getState()
                    const c = es.getEventChain(cid)
                    if (c) {
                      const newChain = es.addEventChain({ name: c.name + ' (副本)', description: c.description, typeId: c.typeId, color: c.color, defaultReminders: [] })
                      // 深拷贝链内所有事件
                      es.getEventsByChain(cid).forEach(evt => {
                        es.addEvent({
                          name: evt.name, description: evt.description,
                          startTime: new Date(evt.startTime), endTime: new Date(evt.endTime),
                          chainId: newChain.id, typeId: evt.typeId, reminders: [...evt.reminders],
                          properties: { ...evt.properties }, isHighlight: evt.isHighlight, priority: evt.priority,
                        })
                      })
                      const gid = useEventGroupStore.getState().ensureActiveGroup()
                      useEventGroupStore.getState().addEventChainToGroup(gid, newChain.id)
                      setSelectedChains(new Set()); setChainEditMode(false)
                    }
                  }} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 rounded-lg">
                    <Copy className="w-3 h-3" /> 复制
                  </button>
                )}
                {selectedChains.size >= 2 && (
                  <button onClick={handleMergeSelectedChains} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 rounded-lg">
                    <FolderOpen className="w-3 h-3" /> 合并 ({selectedChains.size})
                  </button>
                )}
                <button onClick={() => {
                  selectedChains.forEach(cid => eventStore.deleteEventChain(cid))
                  useUIStore.getState().addToast(`已批量删除 · Ctrl+Z 撤回`, '撤回', () => useEventStore.getState().undo())
                  setSelectedChains(new Set()); setChainEditMode(false)
                }} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-lg">
                  <Trash2 className="w-3 h-3" /> 删除 ({selectedChains.size})
                </button>
              </div>
            )}
            {allChains.map(chain => {
              const c = eventStore.getEventsByChain(chain.id).length
              const cg = groups.find(g => g.eventChainIds.includes(chain.id))
              const sel = selectedChains.has(chain.id)
              return (
                <div key={chain.id} className={`flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 group ${chainDblClick === chain.id ? 'ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  onClick={() => { if (chainEditMode) setSelectedChains(prev => { const n = new Set(prev); if (n.has(chain.id)) n.delete(chain.id); else n.add(chain.id); return n }) }}
                  onDoubleClick={() => {
                    if (!chainEditMode) {
                      setChainDblClick(chain.id)
                      setTimeout(() => setChainDblClick(null), 1500)
                      const events = eventStore.getEventsByChain(chain.id)
                      if (events.length > 0) {
                        const first = events[0]
                        setCurrentDate(new Date(first.startTime))
                        setSelectedEvent(first.id)
                      }
                    }
                  }}
                  onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, type: 'chain', id: chain.id, name: chain.name }) }}>
                  {chainEditMode ? (
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${sel ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                      {sel && <CheckSquare className="w-3 h-3 text-white" />}
                    </div>
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: chain.color }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-slate-700 dark:text-slate-300 truncate block">{chain.name}</span>
                    {cg && <span className="text-[10px] text-slate-400">{cg.emoji} {cg.name}</span>}
                  </div>
                  <span className="text-[10px] text-slate-400">{c}</span>
                  {!chainEditMode && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                      <button onClick={() => handleEditChain(chain.id)} className="p-0.5 hover:bg-slate-200 rounded"><Edit2 className="w-3 h-3 text-slate-400" /></button>
                      <button onClick={() => handleDeleteChain(chain.id)} className="p-0.5 hover:bg-red-100 rounded"><Trash2 className="w-3 h-3 text-red-400" /></button>
                    </div>
                  )}
                </div>
              )
            })}
            {allChains.length === 0 && <div className="text-xs text-slate-400 py-2 text-center">暂无</div>}
          </div>
        )}
      </div>

      {/* 拖动分隔条 */}
      <div onMouseDown={e => startResize(e, 'chains-types')} className="h-1.5 cursor-row-resize hover:bg-blue-200/50 flex-shrink-0 transition-colors" />

      {/* ===== 事件类型分区 ===== */}
      <div className="flex flex-col flex-1" style={{ minHeight: isCollapsed('types') ? 0 : 60 }}>
        {renderSectionHeader('types', <Tag className="w-3.5 h-3.5" />, '事件类型', (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setTypesEditMode(!typesEditMode); setSelectedTypes(new Set()) }}
              className={`p-1 rounded transition-colors ${typesEditMode ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400'}`}>
              {typesEditMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); setIsTypeManagerOpen(true) }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><Plus className="w-3.5 h-3.5 text-slate-500" /></button>
          </div>
        ))}
        {!isCollapsed('types') && (
          <div className="flex-1 overflow-y-auto px-3 pb-2">
            {typesEditMode && selectedTypes.size > 0 && (
              <div className="flex gap-1 mb-2">
                {selectedTypes.size === 1 && (
                  <button onClick={() => {
                    const tid = Array.from(selectedTypes)[0]
                    const t = eventStore.getEventType(tid)
                    if (t) eventStore.addEventType({ name: t.name + ' (副本)', emoji: t.emoji, category: t.category, parentId: t.parentId, color: t.color })
                    setSelectedTypes(new Set()); setTypesEditMode(false)
                  }} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 rounded-lg">
                    <Copy className="w-3 h-3" /> 复制
                  </button>
                )}
                <button onClick={() => {
                  selectedTypes.forEach(tid => eventStore.deleteEventType(tid))
                  useUIStore.getState().addToast(`已批量删除 · Ctrl+Z 撤回`, '撤回', () => useEventStore.getState().undo())
                  setSelectedTypes(new Set()); setTypesEditMode(false)
                }} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-lg">
                  <Trash2 className="w-3 h-3" /> 删除 ({selectedTypes.size})
                </button>
              </div>
            )}
            <EventChainFilter
              onContextMenu={(e, id, name) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, type: 'type', id, name }) }}
              editMode={typesEditMode}
              selectedTypes={selectedTypes}
              onToggleSelect={(typeId) => setSelectedTypes(prev => { const n = new Set(prev); if (n.has(typeId)) n.delete(typeId); else n.add(typeId); return n })}
            />
          </div>
        )}
      </div>



      {/* 弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 max-w-sm mx-4">
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-1">确定删除{deleteConfirm.type === 'group' ? '事件组' : '事件链'}？</p>
            <p className="text-xs font-medium text-slate-900 dark:text-white mb-4">「{deleteConfirm.name}」</p>
            {deleteConfirm.type === 'group' && <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">所有关联事件和事件链将同时删除</p>}
            {deleteConfirm.type === 'chain' && <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">所有链内事件将同时删除</p>}
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg">取消</button>
              <button onClick={doConfirmDelete} className="flex-1 px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg">确定删除</button>
            </div>
          </div>
        </div>
      )}
      {showExportModal && <EventGroupExportModal groupId={showExportModal} onClose={() => setShowExportModal(null)} />}
      {showConflictModal && (
        <GroupLoadConflictModal newGroup={showConflictModal} onClose={() => setShowConflictModal(null)}
          onResolve={(r) => { setShowConflictModal(null); if (r === 'manual') { const cf = eventStore.detectConflicts(); if (cf.length > 0) { useUIStore.getState().setConflictConflicts(cf); useUIStore.getState().setIsConflictDialogOpen(true) } } }} />
      )}
      {showChainModal && <EventChainModal mode={editingChainId ? 'edit' : 'create'} chainId={editingChainId || undefined} onClose={() => setShowChainModal(false)} onCreated={handleChainModalCreated} />}

      {/* 合并事件组弹窗 — 拖动排序 */}
      {mergeModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center" onClick={() => setMergeModal(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">合并事件组</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">拖动调整优先级，第一项为目标组（保留），其余合并入其中</p>
            <div className="space-y-2 mb-5">
              {mergeModal.order.map((id, idx) => {
                const g = groups.find(gr => gr.id === id)
                return (
                  <div key={id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveMergeItem(idx, -1)} disabled={idx === 0}
                        className="text-slate-300 hover:text-slate-500 disabled:opacity-20"><ChevronUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => moveMergeItem(idx, 1)} disabled={idx === mergeModal.order.length - 1}
                        className="text-slate-300 hover:text-slate-500 disabled:opacity-20"><ChevronDown className="w-3.5 h-3.5" /></button>
                    </div>
                    <span className="text-base">{g?.emoji}</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">{g?.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${idx === 0 ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400'}`}>
                      {idx === 0 ? '目标组' : `源组 ${idx}`}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setMergeModal(null)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm">取消</button>
              <button onClick={doMergeGroups} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">确认合并</button>
            </div>
          </div>
        </div>
      )}
      {/* 事件组信息弹窗 */}
      {groupInfoPopup && (
        <div className="fixed inset-0 z-[120]" onClick={() => setGroupInfoPopup(null)}>
          <div onClick={e => e.stopPropagation()}
            className="absolute bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 w-56"
            style={{ top: Math.min(groupInfoPopup.anchor.bottom + 4, window.innerHeight - 200), left: Math.min(groupInfoPopup.anchor.left, window.innerWidth - 240) }}>
            <div className="text-2xl mb-2">{groupInfoPopup.g.emoji}</div>
            <div className="text-sm font-bold text-slate-800 dark:text-white">{groupInfoPopup.g.name}</div>
            <div className="text-xs text-slate-500 mt-1">{groupInfoPopup.g.eventChainIds.length} 个事件链 · {groupInfoPopup.g.eventIds.length} 个事件</div>
            <div className="text-xs text-slate-400 mt-1">创建于: {new Date(groupInfoPopup.g.createdAt).toLocaleDateString('zh-CN')}</div>
            <button onClick={() => setGroupInfoPopup(null)}
              className="mt-3 w-full py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">关闭</button>
          </div>
        </div>
      )}
      {/* 右键菜单 */}
      {ctxMenu && (
        <div className="fixed inset-0 z-[130]" onClick={() => setCtxMenu(null)}>
          <div className="absolute bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 min-w-36"
            style={{ left: Math.min(ctxMenu.x, window.innerWidth - 160), top: Math.min(ctxMenu.y, window.innerHeight - 160) }}>
            {ctxMenu.type === 'group' && (<>
              <button onClick={() => { setActiveGroup(ctxMenu.id); setCtxMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-t-lg"><MousePointer2 className="w-3 h-3" /> 设为活动组</button>
              <button onClick={() => { handleRenameStart(ctxMenu.id, ctxMenu.name); setCtxMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"><Edit2 className="w-3 h-3" /> 重命名</button>
              <button onClick={() => {
                const g = groups.find(gr => gr.id === ctxMenu.id)
                if (g) {
                  const es = useEventStore.getState(); const idMap = new Map<string, string>()
                  const nc: string[] = []
                  for (const cid of g.eventChainIds) { const c = es.getEventChain(cid); if (c) { const newChain = es.addEventChain({ name: c.name, description: c.description, typeId: c.typeId, color: c.color, defaultReminders: [] }); idMap.set(cid, newChain.id); nc.push(newChain.id); es.getEventsByChain(cid).forEach(evt => { es.addEvent({ name: evt.name, description: evt.description, startTime: new Date(evt.startTime), endTime: new Date(evt.endTime), chainId: newChain.id, typeId: evt.typeId, reminders: [...evt.reminders], properties: { ...evt.properties }, isHighlight: evt.isHighlight, priority: evt.priority }) }) } }
                  const ne: string[] = []
                  for (const eid of g.eventIds) { const evt = es.getEvent(eid); if (evt) { const nev = es.addEvent({ name: evt.name, description: evt.description, startTime: new Date(evt.startTime), endTime: new Date(evt.endTime), chainId: idMap.get(evt.chainId) || evt.chainId, typeId: evt.typeId, reminders: [...evt.reminders], properties: { ...evt.properties }, isHighlight: evt.isHighlight, priority: evt.priority }); ne.push(nev.id) } }
                  let name = g.name + ' (副本)'; let i = 2; while (groups.some(gr => gr.name === name)) name = `${g.name} (副本) ${i++}`
                  addGroup({ name, emoji: g.emoji, eventChainIds: nc, eventIds: ne })
                }
                setCtxMenu(null)
              }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"><Copy className="w-3 h-3" /> 复制</button>
              <button onClick={() => { handleExportGroup(ctxMenu.id); setCtxMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"><Upload className="w-3 h-3" /> 导出</button>
              <div className="border-t my-0.5" />
              <button onClick={() => { handleDeleteGroup(ctxMenu.id); setCtxMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-lg"><Trash2 className="w-3 h-3" /> 删除</button>
            </>)}
            {ctxMenu.type === 'chain' && (<>
              <button onClick={() => { handleEditChain(ctxMenu.id); setCtxMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-t-lg"><Edit2 className="w-3 h-3" /> 编辑</button>
              <button onClick={() => {
                const es = useEventStore.getState(); const c = es.getEventChain(ctxMenu.id)
                if (c) { const nc = es.addEventChain({ name: c.name + ' (副本)', description: c.description, typeId: c.typeId, color: c.color, defaultReminders: [] }); es.getEventsByChain(ctxMenu.id).forEach(evt => { es.addEvent({ name: evt.name, description: evt.description, startTime: new Date(evt.startTime), endTime: new Date(evt.endTime), chainId: nc.id, typeId: evt.typeId, reminders: [...evt.reminders], properties: { ...evt.properties }, isHighlight: evt.isHighlight, priority: evt.priority }) }); const gid = useEventGroupStore.getState().ensureActiveGroup(); useEventGroupStore.getState().addEventChainToGroup(gid, nc.id) }
                setCtxMenu(null)
              }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"><Copy className="w-3 h-3" /> 复制</button>
              <div className="border-t my-0.5" />
              <button onClick={() => { handleDeleteChain(ctxMenu.id); setCtxMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-lg"><Trash2 className="w-3 h-3" /> 删除</button>
            </>)}
            {ctxMenu.type === 'type' && (<>
              <button onClick={() => { setTypeToEditId(ctxMenu.id); setIsTypeManagerOpen(true); setCtxMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-t-lg"><Edit2 className="w-3 h-3" /> 编辑</button>
              <button onClick={() => {
                const es = useEventStore.getState(); const t = es.getEventType(ctxMenu.id)
                if (t) es.addEventType({ name: t.name + ' (副本)', emoji: t.emoji, category: t.category, parentId: t.parentId, color: t.color })
                setCtxMenu(null)
              }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"><Copy className="w-3 h-3" /> 复制</button>
              <div className="border-t my-0.5" />
              <button onClick={() => { useEventStore.getState().deleteEventType(ctxMenu.id); setCtxMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-lg"><Trash2 className="w-3 h-3" /> 删除</button>
            </>)}
          </div>
        </div>
      )}
    </div>
  )
}
