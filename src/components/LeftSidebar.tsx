/**
 * 左侧边栏 — 可折叠分区 + 拖动调整分区大小
 */
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Download, Upload, Trash2, Edit2, Layers, Filter, Tag, Copy,
  FolderOpen, ChevronUp, ChevronDown, Link, CheckSquare, Square, PanelLeftClose, ChevronRight, MousePointer2, Eye, EyeOff
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
import { sideSelection } from '../stores/sideSelection'
import { scrollToEventBlock } from '../utils/scrollTarget'

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
  const setFlashEventId = useUIStore((s) => s.setFlashEventId)
  const selectedChainId = useUIStore((s) => s.selectedChainId)
  const setSelectedChain = useUIStore((s) => s.setSelectedChain)
  const hiddenGroupIds = useUIStore((s) => s.hiddenGroupIds)
  const toggleGroupVisibility = useUIStore((s) => s.toggleGroupVisibility)
  const setHiddenGroupIds = useUIStore((s) => s.setHiddenGroupIds)
  const clearHiddenGroups = useUIStore((s) => s.clearHiddenGroups)

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
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'group' | 'chain'; id: string; name: string } | null>(null)
  const [mergeModal, setMergeModal] = useState<{ ids: string[]; order: string[] } | null>(null)
  const [groupInfoPopup, setGroupInfoPopup] = useState<{ g: EventGroup; anchor: DOMRect } | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; type: 'group' | 'chain' | 'type'; id: string; name: string } | null>(null)
  const [emojiPos, setEmojiPos] = useState({ x: 0, y: 0 })
  const [, forceUpdate] = useState(0)
  const [selectedGroupIds, setSelectedForDelete] = useState<Set<string>>(new Set())
  const [selectedChainIds, setSelectedChains] = useState<Set<string>>(new Set())
  const [selectedTypeIds, setSelectedTypes] = useState<Set<string>>(new Set())
  const clearGroupSelect = () => setSelectedForDelete(new Set())
  const toggleSelectGroup = (id: string) => setSelectedForDelete(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleGroupSelect = toggleSelectGroup

  // 同步选中状态到全局 ref（供键盘快捷键读取）
  useEffect(() => { sideSelection.groupIds = selectedGroupIds }, [selectedGroupIds])
  useEffect(() => { sideSelection.chainIds = selectedChainIds }, [selectedChainIds])
  useEffect(() => { sideSelection.typeIds = selectedTypeIds }, [selectedTypeIds])

  // 折叠状态
  const [collapsed, setCollapsed] = useState<Set<SectionKey>>(new Set())
  const toggleCollapse = (key: SectionKey) => setCollapsed(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
  const isCollapsed = (key: SectionKey) => collapsed.has(key)

  // 分区高度 (像素，-1 表示初始未分配)
  const containerRef = useRef<HTMLDivElement>(null)
  const [heights, setHeights] = useState({ groups: -1, chains: -1 })
  const resizeRef = useRef<{ key: 'groups-chains' | 'chains-types'; sy: number; g0: number; c0: number } | null>(null)

  // 初始化：容器高度三等分
  useEffect(() => {
    if (heights.groups !== -1) return
    const el = containerRef.current
    if (!el) return
    const header = el.firstElementChild as HTMLElement
    const headerH = header ? header.clientHeight : 36
    const total = el.clientHeight - headerH - 6 // 分隔条高度
    if (total > 0) {
      setHeights({ groups: Math.floor(total * 0.28), chains: Math.floor(total * 0.44) })
    }
  }, [heights.groups])

  const startResize = (e: React.MouseEvent, key: 'groups-chains' | 'chains-types') => {
    e.preventDefault()
    if (heights.groups === -1) return
    resizeRef.current = { key, sy: e.clientY, g0: heights.groups, c0: heights.chains }
    const move = (me: MouseEvent) => {
      if (!resizeRef.current) return
      const dy = me.clientY - resizeRef.current.sy
      if (resizeRef.current.key === 'groups-chains') {
        // 拖动 AB 分隔条：groups 和 chains 交换空间，types 不动
        const ng = Math.max(40, Math.min(600, resizeRef.current.g0 + dy))
        const nc = Math.max(40, Math.min(600, resizeRef.current.c0 - dy))
        setHeights({ groups: ng, chains: nc })
      } else {
        // 拖动 BC 分隔条：仅 chains 变化，types 填充余下空间
        const nc = Math.max(40, Math.min(600, resizeRef.current.c0 + dy))
        setHeights(h => ({ ...h, chains: nc }))
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
    if (selectedGroupIds.size === 0) return
    const ok = await dialogConfirm(`确定删除选中的 ${selectedGroupIds.size} 个事件组吗？`, '批量删除', 'danger')
    if (ok) { selectedGroupIds.forEach(id => deleteGroup(id)); clearGroupSelect(); setEditMode(false); useUIStore.getState().addToast(`已批量删除 · Ctrl+Z 撤回`, '撤回', () => { useEventStore.getState().undo() }) }
    sideSelection.groupIds = new Set(selectedGroupIds)
  }
  const handleGroupClick = (g: EventGroup) => {
    if (editMode) { toggleGroupSelect(g.id) }
    else setActiveGroup(g.id)
  }
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
    if (selectedGroupIds.size < 2) { dialogAlert('请先按住 Ctrl 多选至少两个事件组'); return }
    const ids = Array.from(selectedGroupIds)
    setMergeModal({ ids, order: [...ids] })
  }

  const doMergeGroups = () => {
    if (!mergeModal || mergeModal.order.length < 2) return
    const targetId = mergeModal.order[0]
    const sources = mergeModal.order.slice(1)
    for (const sid of sources) {
      useEventGroupStore.getState().mergeGroups(targetId, sid)
    }
    useUIStore.getState().addToast(`已合并 ${mergeModal.order.length} 个事件组 · Ctrl+Z 撤回`, '撤回', () => { useEventStore.getState().undo() })
    setMergeModal(null)
    clearGroupSelect()
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
        const gs = useEventGroupStore.getState()

        gs.pushHistory()
        es.pushHistory()

        const chainIdsToDelete = new Set(g.eventChainIds)
        const eventIdsToDelete = new Set(g.eventIds)
        for (const cid of chainIdsToDelete) {
          es.getEventsByChain(cid).forEach(e => eventIdsToDelete.add(e.id))
        }
        useEventStore.setState(s => {
          const ne = new Map(s.events)
          for (const eid of eventIdsToDelete) ne.delete(eid)
          const nc = new Map(s.eventChains)
          for (const cid of chainIdsToDelete) nc.delete(cid)
          return { events: ne, eventChains: nc }
        })
        es.save()

        const ng = new Map(gs.groups)
        ng.delete(targetId)
        const no = gs.groupOrder.filter((i: string) => i !== targetId)
        if (ng.size === 0) {
          const defId = 'default-' + Date.now()
          ng.set(defId, { id: defId, name: '默认事件组', emoji: '📁', eventChainIds: [], eventIds: [], createdAt: new Date(), updatedAt: new Date() })
          no.push(defId)
          useEventGroupStore.setState({ groups: ng, groupOrder: no, activeGroupId: defId })
        } else {
          useEventGroupStore.setState({ groups: ng, groupOrder: no, activeGroupId: gs.activeGroupId === targetId ? (no[0] || '') : gs.activeGroupId })
        }
        gs.save()
      }
      forceUpdate(c => c + 1)
    } else {
      useEventStore.getState().deleteEventChain(targetId)
    }
    useUIStore.getState().addToast(`已删除「${deleteConfirm.name}」· Ctrl+Z 撤回`, '撤回', () => {
      useEventStore.getState().undo()
    })
    setDeleteConfirm(null)
  }
  const handleChainModalCreated = (id: string) => { const gid = useEventGroupStore.getState().ensureActiveGroup(); useEventGroupStore.getState().addEventChainToGroup(gid, id); setShowChainModal(false) }

  const clearChainSelect = () => setSelectedChains(new Set())
  const toggleChainSelect = (id: string) => setSelectedChains(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })
  const handleMergeSelectedChains = () => {
    if (selectedChainIds.size < 2) return
    const ids = Array.from(selectedChainIds)
    const target = ids[0]
    const sources = ids.slice(1)
    useEventStore.getState().mergeEventChains(target, sources)
    useUIStore.getState().addToast(`已合并 ${ids.length} 个事件链 · Ctrl+Z 撤回`, '撤回', () => { useEventStore.getState().undo() })
    clearChainSelect()
    setChainEditMode(false)
  }

  // Section render helper
  const renderSectionHeader = (key: SectionKey, icon: React.ReactNode, title: string, actions?: React.ReactNode) => (
    <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => toggleCollapse(key)}>
      <h2 className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${isCollapsed(key) ? '' : 'rotate-90'}`} />
        {icon} {title}
      </h2>
      <div onClick={e => e.stopPropagation()}>{actions}</div>
    </div>
  )

  return (
    <div ref={containerRef} className="w-[min(20vw,18rem)] bg-white/90 dark:bg-slate-900/90 border-r border-slate-200/60 dark:border-slate-800/60 flex flex-col overflow-hidden">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200/60 dark:border-slate-800/60 flex-shrink-0">
        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">导航</span>
        <button onClick={() => setIsLeftSidebarOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all"><PanelLeftClose className="w-3.5 h-3.5" /></button>
      </div>

      {/* ===== 事件组分区 ===== */}
      <div className="flex flex-col border-b border-slate-100 dark:border-slate-800"
        style={isCollapsed('groups') ? { flex: '0 0 auto', minHeight: 0 } : heights.groups > 0 ? { height: heights.groups, flexShrink: 0 } : { flex: 1, minHeight: 80 }}>
        {renderSectionHeader('groups', <Layers className="w-3.5 h-3.5" />, '事件组', (
          <div className="flex items-center gap-1">
            <button onClick={(e) => {
              e.stopPropagation()
              if (hiddenGroupIds.size >= groups.length) { clearHiddenGroups() }
              else { setHiddenGroupIds(new Set(groups.map(g => g.id))) }
            }}
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={hiddenGroupIds.size >= groups.length ? '显示全部事件组' : '隐藏全部事件组'}>
              {hiddenGroupIds.size >= groups.length ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); setEditMode(!editMode); clearGroupSelect() }}
              className={`p-1 rounded transition-all duration-200 ${editMode ? 'bg-accent-100 dark:bg-accent-900/20 text-accent-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400'}`}>
              {editMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowNewGroupInput(true) }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><Plus className="w-3.5 h-3.5 text-slate-500" /></button>
            <button onClick={(e) => { e.stopPropagation(); handleImportGroup() }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><Download className="w-3.5 h-3.5 text-slate-500" /></button>
          </div>
        ))}
        {!isCollapsed('groups') && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 px-3 pt-1 pb-1">
            {editMode && selectedGroupIds.size > 0 && (
              <div className="flex gap-1 mb-2">
                <button onClick={handleMergeGroups} disabled={selectedGroupIds.size < 2}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-lg transition-all duration-200 ${selectedGroupIds.size >= 2 ? 'text-accent-600 bg-accent-50 dark:bg-accent-900/20 hover:bg-accent-100 dark:hover:bg-accent-900/30' : 'text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed'}`}>
                  <FolderOpen className="w-3 h-3" /> 合并 ({selectedGroupIds.size})
                </button>
                <button onClick={() => {
                  const g = groups.find(gr => selectedGroupIds.has(gr.id))
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
                    // 拷贝独立事件（跳过已被链复制的事件）
                    const newEventIds: string[] = []
                    for (const eid of g.eventIds) {
                      const evt = es.getEvent(eid)
                      if (evt) {
                        if (evt.chainId && idMap.has(evt.chainId)) continue
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
                    clearGroupSelect(); setEditMode(false)
                  }
                }} disabled={selectedGroupIds.size !== 1}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-lg transition-all duration-200 ${selectedGroupIds.size === 1 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30' : 'text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed'}`}>
                  <Copy className="w-3 h-3" /> 复制
                </button>
                <button onClick={handleDeleteSelected} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200">
                  <Trash2 className="w-3 h-3" /> 删除 ({selectedGroupIds.size})
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
                    className="flex-1 px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500" placeholder="事件组名称" autoFocus />
                  <button onClick={handleCreateGroup} className="px-2.5 py-1.5 bg-accent-600 hover:bg-accent-700 text-white rounded-lg text-xs font-medium transition-colors">创建</button>
                </div>
              </div>
            )}
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-2">
            <div className="space-y-0.5">
              {groups.map((g, idx) => {
                const isActive = g.id === activeGroupId
                const isHidden = hiddenGroupIds.has(g.id)
                return (
                  <div key={g.id}
                    onClick={() => { if (editMode) toggleGroupSelect(g.id); else setActiveGroup(g.id) }}
                    onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, type: 'group', id: g.id, name: g.name }) }}
                    onDoubleClick={e => {
                      if (!editMode) {
                        const rect = (e.target as HTMLElement).closest('.rounded-lg')?.getBoundingClientRect()
                        if (rect) setGroupInfoPopup({ g, anchor: rect })
                      }
                    }}
                    className={`p-2 rounded-lg cursor-pointer transition-all duration-200 group border ${
                      isActive && !editMode ? 'bg-accent-50 dark:bg-accent-900/20 border-accent-200 dark:border-accent-800 shadow-sm'
                      : selectedGroupIds.has(g.id) ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-100 dark:hover:border-slate-800'
                    } ${isHidden ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-1.5">
                      {editMode ? (
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${selectedGroupIds.has(g.id) ? 'border-red-500 bg-red-500' : 'border-slate-300'}`}>
                          {selectedGroupIds.has(g.id) && <CheckSquare className="w-3 h-3 text-white" />}
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
                            {isActive && <span className="ml-1.5 text-[9px] font-medium text-accent-600 dark:text-accent-400 bg-accent-100 dark:bg-accent-900/30 px-1.5 py-0.5 rounded-md">活动</span>}
                          </p>
                        )}
                        <p className="text-xs text-slate-400">{g.eventChainIds.length} 链 · {g.eventIds.length} 事件</p>
                      </div>
                      {!editMode && (
                        <div className="flex gap-0.5 transition-opacity items-center">
                          <button onClick={e => { e.stopPropagation(); toggleGroupVisibility(g.id) }}
                            className={`p-1 rounded transition-all ${isHidden ? 'opacity-100 text-slate-400 hover:text-amber-500' : 'opacity-0 group-hover:opacity-100 text-slate-300 hover:text-slate-500'} hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors`}
                            title={isHidden ? '显示此事件组' : '隐藏此事件组'}>
                            {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={e => { e.stopPropagation(); handleExportGroup(g.id) }} className="p-1 hover:bg-slate-200 rounded"><Upload className="w-3 h-3 text-slate-500" /></button>
                            <button onClick={e => { e.stopPropagation(); handleRenameStart(g.id, g.name) }} className="p-1 hover:bg-slate-200 rounded"><Edit2 className="w-3 h-3 text-slate-500" /></button>
                            <button onClick={e => { e.stopPropagation(); handleDeleteGroup(g.id) }} className="p-1 hover:bg-red-100 rounded"><Trash2 className="w-3 h-3 text-red-400" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          </div>
        )}
      </div>

      {/* 浮动 emoji 面板 */}
      {showEmojiPicker && createPortal(
        <div className="fixed inset-0 z-[140]" onClick={() => { setShowEmojiPicker(false); setEditingEmojiGroupId(null) }}>
          <div className="absolute p-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 rounded-xl shadow-overlay"
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
        </div>,
        document.body
      )}

      {/* 拖动分隔条 */}
      <div onMouseDown={e => startResize(e, 'groups-chains')} className="h-[3px] cursor-row-resize hover:bg-accent-300/50 dark:hover:bg-accent-600/30 flex-shrink-0 transition-colors" />

      {/* ===== 事件链分区 ===== */}
      <div className="flex flex-col border-b border-slate-100 dark:border-slate-800"
        style={isCollapsed('chains') ? { flex: '0 0 auto', minHeight: 0 } : heights.chains > 0 ? { height: heights.chains, flexShrink: 0 } : { flex: 1, minHeight: 60 }}>
        {renderSectionHeader('chains', <Link className="w-3.5 h-3.5" />, '事件链', (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setChainEditMode(!chainEditMode); clearChainSelect() }}
              className={`p-1 rounded transition-all duration-200 ${chainEditMode ? 'bg-accent-100 dark:bg-accent-900/20 text-accent-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400'}`}>
              {chainEditMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleCreateChain() }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><Plus className="w-3.5 h-3.5 text-slate-500" /></button>
          </div>
        ))}
        {!isCollapsed('chains') && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 px-3 pt-1 pb-1">
            {chainEditMode && selectedChainIds.size > 0 && (
              <div className="flex gap-1 mb-2">
                {selectedChainIds.size === 1 && (
                  <button onClick={() => {
                    const cid = Array.from(selectedChainIds)[0]
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
                      clearChainSelect(); setChainEditMode(false)
                    }
                  }} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-lg">
                    <Copy className="w-3 h-3" /> 复制
                  </button>
                )}
                {selectedChainIds.size >= 2 && (
                  <button onClick={handleMergeSelectedChains} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs text-accent-600 bg-accent-50 dark:bg-accent-900/20 hover:bg-accent-100 dark:hover:bg-accent-900/30 rounded-lg">
                    <FolderOpen className="w-3 h-3" /> 合并 ({selectedChainIds.size})
                  </button>
                )}
                <button onClick={() => {
                  selectedChainIds.forEach(cid => eventStore.deleteEventChain(cid))
                  useUIStore.getState().addToast(`已批量删除 · Ctrl+Z 撤回`, '撤回', () => { useEventStore.getState().undo() })
                  clearChainSelect(); setChainEditMode(false)
                }} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-lg transition-all duration-200">
                  <Trash2 className="w-3 h-3" /> 删除 ({selectedChainIds.size})
                </button>
              </div>
            )}
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-2">
            {allChains.map(chain => {
              const c = eventStore.getEventsByChain(chain.id).length
              const cg = groups.find(g => g.eventChainIds.includes(chain.id))
              const sel = selectedChainIds.has(chain.id)
              return (
                <div key={chain.id} className={`flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 group ${chainDblClick === chain.id ? 'ring-2 ring-accent-400 bg-accent-50 dark:bg-accent-900/20' : ''} ${selectedChainId === chain.id ? 'bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-700' : ''}`}
                  onClick={() => { if (chainEditMode) toggleChainSelect(chain.id) }}
                  onDoubleClick={() => {
                    if (!chainEditMode) {
                      setChainDblClick(chain.id)
                      setTimeout(() => setChainDblClick(null), 1500)
                      const events = eventStore.getEventsByChain(chain.id)
                      if (events.length > 0) {
                        const first = events[0]
                        scrollToEventBlock(first.id)
                        setFlashEventId(first.id)
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
          </div>
        )}
      </div>

      {/* 拖动分隔条 */}
      <div onMouseDown={e => startResize(e, 'chains-types')} className="h-[3px] cursor-row-resize hover:bg-accent-300/50 dark:hover:bg-accent-600/30 flex-shrink-0 transition-colors" />

      {/* ===== 事件类型分区 ===== */}
      <div className="flex flex-col flex-1" style={{ minHeight: isCollapsed('types') ? 0 : 60 }}>
        {renderSectionHeader('types', <Tag className="w-3.5 h-3.5" />, '事件类型', (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setTypesEditMode(!typesEditMode); setSelectedTypes(new Set()); sideSelection.typeIds = new Set() }}
              className={`p-1 rounded transition-colors ${typesEditMode ? 'bg-accent-100 dark:bg-accent-900/20 text-accent-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400'}`}>
              {typesEditMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); setIsTypeManagerOpen(true) }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><Plus className="w-3.5 h-3.5 text-slate-500" /></button>
          </div>
        ))}
        {!isCollapsed('types') && (
          <div className="flex-1 overflow-y-auto px-3 pb-2">
            {typesEditMode && selectedTypeIds.size > 0 && (
              <div className="flex gap-1 mb-2">
                {selectedTypeIds.size === 1 && (
                  <button onClick={() => {
                    const tid = Array.from(selectedTypeIds)[0]
                    const t = eventStore.getEventType(tid)
                    if (t) eventStore.addEventType({ name: t.name + ' (副本)', emoji: t.emoji, category: t.category, parentId: t.parentId, color: t.color })
                    setSelectedTypes(new Set()); setTypesEditMode(false)
                  }} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-lg">
                    <Copy className="w-3 h-3" /> 复制
                  </button>
                )}
                <button onClick={() => {
                  selectedTypeIds.forEach(tid => eventStore.deleteEventType(tid))
                  useUIStore.getState().addToast(`已批量删除 · Ctrl+Z 撤回`, '撤回', () => { useEventStore.getState().undo() })
                  setSelectedTypes(new Set()); setTypesEditMode(false)
                }} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-lg transition-all duration-200">
                  <Trash2 className="w-3 h-3" /> 删除 ({selectedTypeIds.size})
                </button>
              </div>
            )}
            <EventChainFilter
              onContextMenu={(e, id, name) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, type: 'type', id, name }) }}
              editMode={typesEditMode}
              selectedTypes={selectedTypeIds}
              onToggleSelect={(typeId) => setSelectedTypes(prev => { const n = new Set(prev); if (n.has(typeId)) n.delete(typeId); else n.add(typeId); return n })}
            />
          </div>
        )}
      </div>



      {/* 弹窗 — 通过 Portal 渲染到 body 避免 backdrop-blur 堆叠上下文影响 */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-900 rounded-2xl shadow-modal dark:shadow-modal-dark border border-slate-200/60 dark:border-slate-700/60 p-5 max-w-sm mx-4">
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-1">确定删除{deleteConfirm.type === 'group' ? '事件组' : '事件链'}？</p>
            <p className="text-xs font-medium text-slate-900 dark:text-white mb-4">「{deleteConfirm.name}」</p>
            {deleteConfirm.type === 'group' && <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">所有关联事件和事件链将同时删除</p>}
            {deleteConfirm.type === 'chain' && <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">所有链内事件将同时删除</p>}
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg">取消</button>
              <button onClick={doConfirmDelete} className="flex-1 px-3 py-2 text-sm bg-red-600 hover:bg-red-700 shadow-sm shadow-red-600/20 text-white rounded-lg">确定删除</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {showExportModal && createPortal(<EventGroupExportModal groupId={showExportModal} onClose={() => setShowExportModal(null)} />, document.body)}
      {showConflictModal && createPortal(
        <GroupLoadConflictModal newGroup={showConflictModal} onClose={() => setShowConflictModal(null)}
          onResolve={(r) => { setShowConflictModal(null); if (r === 'manual') { const cf = eventStore.detectConflicts(); if (cf.length > 0) { useUIStore.getState().setConflictConflicts(cf); useUIStore.getState().setIsConflictDialogOpen(true) } } }} />,
        document.body
      )}
      {showChainModal && createPortal(<EventChainModal mode={editingChainId ? 'edit' : 'create'} chainId={editingChainId || undefined} onClose={() => setShowChainModal(false)} onCreated={handleChainModalCreated} />, document.body)}

      {/* 合并事件组弹窗 */}
      {mergeModal && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center" onClick={() => setMergeModal(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-800 rounded-2xl shadow-modal dark:shadow-modal-dark border border-slate-200/60 dark:border-slate-700/60 p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">合并事件组</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">拖动调整优先级，第一项为目标组（保留），其余合并入其中</p>
            <div className="space-y-2 mb-5">
              {mergeModal.order.map((id, idx) => {
                const g = groups.find(gr => gr.id === id)
                return (
                  <div key={id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveMergeItem(idx, -1)} disabled={idx === 0}
                        className="text-slate-300 hover:text-slate-500 disabled:opacity-20"><ChevronUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => moveMergeItem(idx, 1)} disabled={idx === mergeModal.order.length - 1}
                        className="text-slate-300 hover:text-slate-500 disabled:opacity-20"><ChevronDown className="w-3.5 h-3.5" /></button>
                    </div>
                    <span className="text-base">{g?.emoji}</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">{g?.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${idx === 0 ? 'bg-accent-100 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300' : 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400'}`}>
                      {idx === 0 ? '目标组' : `源组 ${idx}`}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setMergeModal(null)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm">取消</button>
              <button onClick={doMergeGroups} className="flex-1 px-4 py-2 bg-accent-600 hover:bg-accent-700 shadow-sm shadow-accent-600/20 text-white rounded-lg text-sm font-medium">确认合并</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* 事件组信息弹窗 */}
      {groupInfoPopup && createPortal(
        <div className="fixed inset-0 z-[120]" onClick={() => setGroupInfoPopup(null)}>
          <div onClick={e => e.stopPropagation()}
            className="absolute bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-overlay border border-slate-200/60 dark:border-slate-700/60 p-4 w-56"
            style={{ top: Math.min(groupInfoPopup.anchor.bottom + 4, window.innerHeight - 200), left: Math.min(groupInfoPopup.anchor.left, window.innerWidth - 240) }}>
            <div className="text-2xl mb-2">{groupInfoPopup.g.emoji}</div>
            <div className="text-sm font-bold text-slate-800 dark:text-white">{groupInfoPopup.g.name}</div>
            <div className="text-xs text-slate-500 mt-1">{groupInfoPopup.g.eventChainIds.length} 个事件链 · {groupInfoPopup.g.eventIds.length} 个事件</div>
            <div className="text-xs text-slate-400 mt-1">创建于: {new Date(groupInfoPopup.g.createdAt).toLocaleDateString('zh-CN')}</div>
            <button onClick={() => setGroupInfoPopup(null)}
              className="mt-3 w-full py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">关闭</button>
          </div>
        </div>,
        document.body
      )}
      {/* 右键菜单 */}
      {ctxMenu && createPortal(
        <div className="fixed inset-0 z-[130]" onClick={() => setCtxMenu(null)}>
          <div className="absolute bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-overlay border border-slate-200/60 dark:border-slate-700/60 min-w-36"
            style={{ left: Math.min(ctxMenu.x, window.innerWidth - 160), top: Math.min(ctxMenu.y, window.innerHeight - 160) }}>
            {ctxMenu.type === 'group' && (<>
              <button onClick={() => { setActiveGroup(ctxMenu.id); setCtxMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-t-lg"><MousePointer2 className="w-3 h-3" /> 设为活动组</button>
              <button onClick={() => { handleRenameStart(ctxMenu.id, ctxMenu.name); setCtxMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"><Edit2 className="w-3 h-3" /> 重命名</button>
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
              }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"><Copy className="w-3 h-3" /> 复制</button>
              <button onClick={() => { handleExportGroup(ctxMenu.id); setCtxMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"><Upload className="w-3 h-3" /> 导出</button>
              <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
              <button onClick={() => { handleDeleteGroup(ctxMenu.id); setCtxMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-lg"><Trash2 className="w-3 h-3" /> 删除</button>
            </>)}
            {ctxMenu.type === 'chain' && (<>
              <button onClick={() => { handleEditChain(ctxMenu.id); setCtxMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-t-lg"><Edit2 className="w-3 h-3" /> 编辑</button>
              <button onClick={() => {
                const es = useEventStore.getState(); const c = es.getEventChain(ctxMenu.id)
                if (c) { const nc = es.addEventChain({ name: c.name + ' (副本)', description: c.description, typeId: c.typeId, color: c.color, defaultReminders: [] }); es.getEventsByChain(ctxMenu.id).forEach(evt => { es.addEvent({ name: evt.name, description: evt.description, startTime: new Date(evt.startTime), endTime: new Date(evt.endTime), chainId: nc.id, typeId: evt.typeId, reminders: [...evt.reminders], properties: { ...evt.properties }, isHighlight: evt.isHighlight, priority: evt.priority }) }); const gid = useEventGroupStore.getState().ensureActiveGroup(); useEventGroupStore.getState().addEventChainToGroup(gid, nc.id) }
                setCtxMenu(null)
              }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"><Copy className="w-3 h-3" /> 复制</button>
              <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
              <button onClick={() => { handleDeleteChain(ctxMenu.id); setCtxMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-lg"><Trash2 className="w-3 h-3" /> 删除</button>
            </>)}
            {ctxMenu.type === 'type' && (<>
              <button onClick={() => { setTypeToEditId(ctxMenu.id); setIsTypeManagerOpen(true); setCtxMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-t-lg"><Edit2 className="w-3 h-3" /> 编辑</button>
              <button onClick={() => {
                const es = useEventStore.getState(); const t = es.getEventType(ctxMenu.id)
                if (t) es.addEventType({ name: t.name + ' (副本)', emoji: t.emoji, category: t.category, parentId: t.parentId, color: t.color })
                setCtxMenu(null)
              }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"><Copy className="w-3 h-3" /> 复制</button>
              <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
              <button onClick={() => { useEventStore.getState().deleteEventType(ctxMenu.id); setCtxMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-lg"><Trash2 className="w-3 h-3" /> 删除</button>
            </>)}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
