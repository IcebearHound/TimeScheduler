/**
 * 事件块 — 拖拽移动+调整大小，组emoji在右上角
 */
import React, { useRef, useState, useCallback, useEffect } from 'react'
import { GripVertical } from 'lucide-react'
import { Event } from '../../types/event'
import useUIStore from '../../stores/uiStore'
import useEventStore from '../../stores/eventStore'
import useEventGroupStore from '../../stores/eventGroupStore'
import EventContextMenu from '../EventContextMenu'
import PopoverEventEditor from '../PopoverEventEditor'

const MIN15_MS = 15 * 60 * 1000
const PX_PER_15MIN = 12

interface EventBlockItemProps {
  event: Event; onEdit?: (event: Event) => void
  isHighlighted?: boolean; compact?: boolean
  continuesBefore?: boolean
  continuesAfter?: boolean
}

type ResizeEdge = 'top' | 'bottom' | null

export default function EventBlockItem({ event, onEdit, isHighlighted, compact, continuesBefore, continuesAfter }: EventBlockItemProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [resizing, setResizing] = useState<ResizeEdge>(null)

  const setSelectedEvent = useUIStore((s) => s.setSelectedEvent)
  const selectedEventId = useUIStore((s) => s.selectedEventId)
  const selectedEventIds = useUIStore((s) => s.selectedEventIds)
  const toggleMultiSelect = useUIStore((s) => s.toggleMultiSelect)
  const showGroupEmoji = useUIStore((s) => s.showGroupEmoji)
  const openPopoverEventId = useUIStore((s) => s.openPopoverEventId)
  const setOpenPopoverEventId = useUIStore((s) => s.setOpenPopoverEventId)
  const popoverEditorId = useUIStore((s) => s.popoverEditorId)
  const setPopoverEditorId = useUIStore((s) => s.setPopoverEditorId)
  const flashEventId = useUIStore((s) => s.flashEventId)
  const setIsEventPanelOpen = useUIStore((s) => s.setIsEventPanelOpen)
  const setDraggedEvent = useUIStore((s) => s.setDraggedEvent)
  const eventStore = useEventStore.getState()
  const eventChain = useEventStore((s) => event.chainId ? s.eventChains.get(event.chainId) : undefined)
  const eventType = useEventStore((s) => s.eventTypes.get(event.typeId))
  const groups = useEventGroupStore((s) => s.groups)
  const eventGroup = Array.from(groups.values()).find(g => g.eventIds.includes(event.id))
  const chainGroup = event.chainId ? Array.from(groups.values()).find(g => g.eventChainIds.includes(event.chainId)) : null
  const displayGroup = eventGroup || chainGroup

  const st = new Date(event.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const et = new Date(event.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const startDay = new Date(event.startTime).toDateString()
  const endDay = new Date(event.endTime).toDateString()
  const isMultiDay = startDay !== endDay
  const dayDiff = Math.round((new Date(endDay).getTime() - new Date(startDay).getTime()) / 86400000)
  const timeDisplay = !isMultiDay ? `${st} - ${et}` : dayDiff === 1 ? `${st} - 次日 ${et}` : `${st} - ${et} (+${dayDiff}天)`
  const baseColor = event.color || eventChain?.color || '#3B82F6'
  // 重点事件：左侧金色粗边框 + 星标
  const borderStyle = event.isHighlight ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-white/30'

  // 外部触发打开编辑器（如右边栏双击同链事件）
  useEffect(() => {
    if (openPopoverEventId === event.id) {
      useUIStore.getState().setSelectedEvent(event.id)
      useUIStore.getState().setIsEventPanelOpen(true)
      setOpenPopoverEventId(null)
    }
  }, [openPopoverEventId, event.id])

  const startResize = useCallback((e: React.MouseEvent, edge: ResizeEdge) => {
    e.preventDefault(); e.stopPropagation()
    const origStart = new Date(event.startTime).getTime()
    const origEnd = new Date(event.endTime).getTime()
    const sy = e.clientY
    const origH = containerRef.current?.offsetHeight || 60
    setResizing(edge)

    const move = (me: MouseEvent) => {
      const dy = me.clientY - sy
      const el = containerRef.current
      if (!el) return
      el.style.willChange = 'transform'
      el.style.opacity = '0.85'
      if (edge === 'top') {
        // 上边缘：整块上移 + 增高
        el.style.transform = `translateY(${dy}px)`
        el.style.height = `${Math.max(22, origH - dy)}px`
      } else {
        // 下边缘：只增高，不位移
        el.style.height = `${Math.max(22, origH + dy)}px`
      }
    }
    const up = (me: MouseEvent) => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
      const el = containerRef.current
      if (el) {
        el.style.transform = ''
        el.style.height = ''
        el.style.opacity = ''
        el.style.willChange = ''
      }
      setResizing(null)

      const totalDy = me.clientY - sy
      const steps = Math.round(totalDy / PX_PER_15MIN)
      const ms = steps * MIN15_MS
      if (edge === 'top') {
        const ns = origStart + ms
        if (ns < origEnd - MIN15_MS) useEventStore.getState().updateEvent(event.id, { startTime: new Date(ns) })
      } else {
        const ne = origEnd + ms
        if (ne > origStart + MIN15_MS) useEventStore.getState().updateEvent(event.id, { endTime: new Date(ne) })
      }
    }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }, [event.id, event.startTime, event.endTime])

  const startMove = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    const el = containerRef.current; if (!el) return
    const origStart = new Date(event.startTime).getTime(); const origEnd = new Date(event.endTime).getTime()
    el.style.willChange = 'transform'; el.style.zIndex = '50'; el.style.opacity = '0.85'; el.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)'
    const sx = e.clientX; const sy = e.clientY
    // 估算列宽：窗口宽度减去边栏约 350px，除以 7 列
    const colW = Math.max(100, (window.innerWidth - 400) / 7)

    let scrollTimer: number | null = null
    const findScrollContainer = (el: HTMLElement): HTMLElement | null => {
      let p: HTMLElement | null = el.parentElement
      while (p) {
        const s = window.getComputedStyle(p)
        if (s.overflowY === 'auto' || s.overflowY === 'scroll') return p
        p = p.parentElement
      }
      return null
    }

    const move = (me: MouseEvent) => {
      el.style.transform = `translate(${me.clientX - sx}px, ${me.clientY - sy}px)`
      const sc = findScrollContainer(el)
      if (!sc) return
      const r = sc.getBoundingClientRect()
      const threshold = 50
      if (me.clientY - r.top < threshold && sc.scrollTop > 0) {
        if (!scrollTimer) scrollTimer = window.setInterval(() => { sc.scrollTop -= 8 }, 16)
      } else if (r.bottom - me.clientY < threshold && sc.scrollTop < sc.scrollHeight - sc.clientHeight) {
        if (!scrollTimer) scrollTimer = window.setInterval(() => { sc.scrollTop += 8 }, 16)
      } else {
        if (scrollTimer) { clearInterval(scrollTimer); scrollTimer = null }
      }
    }

    const up = (ue: MouseEvent) => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
      if (scrollTimer) { clearInterval(scrollTimer); scrollTimer = null }

      const stepsY = Math.round((ue.clientY - sy) / PX_PER_15MIN)
      const stepsX = Math.round((ue.clientX - sx) / colW)

      // 记录旧位置
      const oldRect = el.getBoundingClientRect()
      const oldY = oldRect.top

      // 更新 store
      if (Math.abs(stepsY) > 0 || Math.abs(stepsX) > 0) {
        const totalMs = stepsY * MIN15_MS + stepsX * 24 * 60 * 60 * 1000
        const ns = new Date(origStart + totalMs)
        const ne = new Date(origEnd + totalMs)
        if (ns.getTime() < ne.getTime()) {
          useEventStore.getState().moveEvent(event.id, ns, ne)
        }
      }

      // 清除拖拽偏移
      el.style.transform = ''
      el.style.boxShadow = ''
      el.style.zIndex = ''
      el.style.willChange = ''
      el.style.opacity = ''

      // FLIP: React 重渲染后，动画滑到新位置
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const newRect = el.getBoundingClientRect()
          const dy = oldY - newRect.top
          if (Math.abs(dy) > 1) {
            el.style.transition = 'none'
            el.style.transform = `translateY(${dy}px)`
            requestAnimationFrame(() => {
              el.style.transition = 'transform 0.2s cubic-bezier(0.22, 0.61, 0.36, 1)'
              el.style.transform = 'translateY(0)'
              setTimeout(() => { el.style.transition = '' }, 220)
            })
          }
          // 拖动后滚动到事件新位置为中心
          const sc = findScrollContainer(el)
          if (sc && (Math.abs(stepsY) > 3 || Math.abs(stepsX) > 0)) {
            const nr = el.getBoundingClientRect()
            const cr = sc.getBoundingClientRect()
            const target = sc.scrollTop + nr.top - cr.top - cr.height / 2
            sc.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
          }
        })
      })
    }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }, [event.id, event.startTime, event.endTime])

  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    useUIStore.getState().setSelectedEvent(event.id)
    useUIStore.getState().setPopoverEditorId(event.id)
  }

  // 生成 group 缩写（首字母拼音）
  const groupAbbr = displayGroup ? (displayGroup.name.slice(0, 2).toUpperCase()) : ''

  if (compact) {
    return (
      <div onClick={(e) => { if (e.ctrlKey || e.metaKey) toggleMultiSelect(event.id); else setSelectedEvent(event.id) }}
        className={`group relative rounded px-2 py-1 text-xs font-medium cursor-pointer truncate transition-shadow ${
          selectedEventId === event.id ? 'ring-2 ring-blue-500 dark:ring-blue-400 z-10' : ''
        } ${selectedEventIds.has(event.id) ? 'brightness-110 saturate-150' : ''}`}
        style={{ backgroundColor: baseColor + 'CC', color: 'white' }}>
        {eventType?.emoji} {event.name}{event.isHighlight ? ' ⭐' : ''}
      </div>
    )
  }

  return (
    <>
      <div ref={containerRef}
        draggable
        onDragStart={(e) => {
          setDraggedEvent(event.id)
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', event.id)
        }}
        onClick={(e) => { if (e.ctrlKey || e.metaKey) toggleMultiSelect(event.id); else setSelectedEvent(event.id) }}
        onDoubleClick={handleDoubleClick}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu(prev => prev ? null : { x: e.clientX, y: e.clientY }) }}
        id={`event-${event.id}`}
        className={`event-block group relative rounded-lg p-1.5 text-white text-xs font-medium select-none shadow-md hover:shadow-lg transition-shadow h-full flex flex-col overflow-visible ${
          selectedEventId === event.id ? 'ring-2 ring-blue-500 dark:ring-blue-400 z-10' : ''
        } ${selectedEventIds.has(event.id) ? 'brightness-110 saturate-150 z-10' : ''} ${
          flashEventId === event.id ? 'animate-event-flash z-20' : ''
        }`}
        style={{
          backgroundColor: baseColor,
          borderLeft: event.isHighlight ? '4px solid #fbbf24' : isHighlighted ? '5px solid rgba(255,255,255,0.8)' : '4px solid rgba(255,255,255,0.15)',
          minHeight: 22,
          borderTopLeftRadius: continuesBefore ? 0 : undefined,
          borderTopRightRadius: continuesBefore ? 0 : undefined,
          borderBottomLeftRadius: continuesAfter ? 0 : undefined,
          borderBottomRightRadius: continuesAfter ? 0 : undefined,
        }}>

        {/* 上边缘调整手柄 */}
        <div onMouseDown={e => startResize(e, 'top')} className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-white/20 rounded-t-lg z-10" />
        {/* 下边缘调整手柄 */}
        <div onMouseDown={e => startResize(e, 'bottom')} className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-white/20 rounded-b-lg z-10" />

        {/* 跨天延续指示器 */}
        {continuesBefore && <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />}
        {continuesAfter && <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-b from-transparent to-white/20 pointer-events-none" />}

        {/* 中间拖拽区域 */}
        <div onMouseDown={startMove} className="cursor-grab active:cursor-grabbing flex-1 flex flex-col justify-center overflow-visible" style={{ minHeight: 0 }}>
          <div className="line-clamp-3">
            <div className="font-bold flex items-start gap-1">
              <span className="flex-shrink-0">{eventType?.emoji}</span>
              <span className="truncate">{event.name}</span>
            </div>
            <div className="opacity-90 whitespace-nowrap">{timeDisplay}</div>
          </div>
        </div>

        {/* 右上角：事件组 emoji + 缩写，替代三点菜单 */}
        {showGroupEmoji && displayGroup && (
          <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] leading-none">{displayGroup.emoji}</span>
            <span className="text-[9px] leading-none font-bold bg-white/20 px-1 rounded-sm">{groupAbbr}</span>
          </div>
        )}

        {/* 重点星标 - 左侧 */}
        {event.isHighlight && (
          <span className="absolute left-0.5 top-0.5 text-[10px] leading-none">⭐</span>
        )}
      </div>
      {contextMenu && <EventContextMenu event={event} position={contextMenu} anchorRef={containerRef as React.RefObject<HTMLElement>} onClose={() => setContextMenu(null)} onEdit={() => {
        useUIStore.getState().setSelectedEvent(event.id)
        useUIStore.getState().setIsEventPanelOpen(true)
        setContextMenu(null)
      }} />}
      {popoverEditorId === event.id && (
        <PopoverEventEditor eventId={event.id} anchorRef={containerRef as React.RefObject<HTMLElement>} anchorRect={null} onClose={() => setPopoverEditorId(null)} />
      )}
    </>
  )
}
