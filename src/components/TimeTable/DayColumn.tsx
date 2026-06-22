/**
 * 日列 — 重叠事件布局：前3个正常，4+折叠为+号方块
 * 支持跨天事件：事件在每一天的 [dayStart, dayEnd) 区间内可见
 */
import React, { useMemo, useRef, useState, useEffect } from 'react'
import { Plus, ClipboardPaste } from 'lucide-react'
import { Event } from '../../types/event'
import EventBlockItem from './EventBlockItem'
import useUIStore from '../../stores/uiStore'
import useEventStore from '../../stores/eventStore'
import useEventGroupStore from '../../stores/eventGroupStore'

interface DayColumnProps { date: Date; events: Event[] }
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MIN_SLOT_H = 60
const W3P = [50, 40, 10] // 3+: 2 events + plus
const W2 = [55, 45]
const W1 = [100]

interface DayEventInfo {
  event: Event
  startMinutes: number // 相对于当天零点的分钟数，限制在 [0, 1440]
  endMinutes: number
  continuesBefore: boolean // 事件开始于当天之前
  continuesAfter: boolean  // 事件结束于当天之后
}

function getDayEventInfo(event: Event, date: Date): DayEventInfo | null {
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart.getTime() + 86400000)

  const es = new Date(event.startTime).getTime()
  const ee = new Date(event.endTime).getTime()

  if (es >= dayEnd.getTime() || ee <= dayStart.getTime()) return null

  const clampedStart = Math.max(es, dayStart.getTime())
  const clampedEnd = Math.min(ee, dayEnd.getTime())

  const startMinutes = (clampedStart - dayStart.getTime()) / 60000
  const endMinutes = (clampedEnd - dayStart.getTime()) / 60000

  return { event, startMinutes, endMinutes, continuesBefore: es < dayStart.getTime(), continuesAfter: ee > dayEnd.getTime() }
}

export default function DayColumn({ date, events }: DayColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const blankMenuRef = useRef<HTMLDivElement>(null)
  const [slotH, setSlotH] = useState(MIN_SLOT_H)
  const [blankMenu, setBlankMenu] = useState<{ x: number; y: number; hour: number } | null>(null)
  const [expandPopup, setExpandPopup] = useState<{ eventIds: string[]; anchor: DOMRect } | null>(null)
  const selectedEventId = useUIStore((s) => s.selectedEventId)
  const clipboardEvent = useEventStore((s) => s.clipboardEvent)

  useEffect(() => { if (!blankMenu) return; const h = (e: MouseEvent) => { if (blankMenuRef.current && !blankMenuRef.current.contains(e.target as Node)) setBlankMenu(null) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [blankMenu])
  useEffect(() => { const c = () => setSlotH(Math.max(MIN_SLOT_H, Math.floor((window.innerHeight - 130) / 24))); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])

  const dayEvents = useMemo(() => {
    const result: DayEventInfo[] = []
    for (const e of events) {
      const info = getDayEventInfo(e, date)
      if (info) result.push(info)
    }
    return result
  }, [events, date])
  const highlightedChainId = useMemo(() => { if (!selectedEventId) return null; return useEventStore.getState().getEvent(selectedEventId)?.chainId || null }, [selectedEventId])
  const totalH = 24 * slotH
  const priorityRank = useMemo(() => { const s = [...dayEvents].sort((a, b) => b.event.priority - a.event.priority || new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime()); return new Map(s.map((di, i) => [di.event.id, i])) }, [dayEvents])

  const { blocks, plusBtns } = useMemo(() => {
    type Block = { event: Event; top: number; h: number; wPct: number; leftPct: number; continuesBefore: boolean; continuesAfter: boolean }
    type Plus = { top: number; h: number; wPct: number; leftPct: number; cnt: number; ids: string[] }
    const blks: Block[] = []
    const btns: Plus[] = []
    const seen = new Set<string>()

    for (const di of dayEvents) {
      if (seen.has(di.event.id)) continue
      const ms = di.startMinutes
      const me = di.endMinutes

      // BFS 扩展找到完全连通的重叠组
      const stack = [di.event.id]
      const groupSet = new Set<string>()
      while (stack.length > 0) {
        const id = stack.pop()!
        if (groupSet.has(id)) continue
        groupSet.add(id)
        const e = dayEvents.find(x => x.event.id === id)
        if (!e) continue
        for (const o of dayEvents) {
          if (groupSet.has(o.event.id)) continue
          if (o.startMinutes < e.endMinutes && o.endMinutes > e.startMinutes) stack.push(o.event.id)
        }
      }

      const group = [...groupSet].map(id => dayEvents.find(x => x.event.id === id)!).filter(Boolean)
      if (group.length === 0) { seen.add(di.event.id); continue }
      const sorted = group.sort((a, b) => (priorityRank.get(a.event.id) ?? 99) - (priorityRank.get(b.event.id) ?? 99))
      const total = sorted.length
      group.forEach(e => seen.add(e.event.id))

      let wps: number[]
      let visible: number
      if (total >= 3) { wps = W3P; visible = 2 }
      else if (total === 2) { wps = W2; visible = 2 }
      else { wps = W1; visible = 1 }

      for (let i = 0; i < visible; i++) {
        const e = sorted[i]
        const top = e.startMinutes / 1440 * totalH
        const hh = Math.max(20, (e.endMinutes - e.startMinutes) / 1440 * totalH)
        const left = wps.slice(0, i).reduce((s, v) => s + v, 0)
        blks.push({ event: e.event, top, h: hh, wPct: wps[i], leftPct: left, continuesBefore: e.continuesBefore, continuesAfter: e.continuesAfter })
      }

      if (total > 2) {
        const baseTop = sorted[0].startMinutes / 1440 * totalH
        const maxDur = Math.max(...sorted.map(e => e.endMinutes - e.startMinutes))
        const baseH = Math.max(20, maxDur / 1440 * totalH)
        btns.push({
          top: baseTop, h: baseH,
          wPct: wps[2],
          leftPct: wps.slice(0, 2).reduce((s, v) => s + v, 0),
          cnt: total - 2,
          ids: sorted.map(e => e.event.id),
        })
      }
    }

    // 兜底：未被处理的事件单独渲染
    for (const di of dayEvents) {
      if (seen.has(di.event.id)) continue
      const top = di.startMinutes / 1440 * totalH
      const hh = Math.max(20, (di.endMinutes - di.startMinutes) / 1440 * totalH)
      blks.push({ event: di.event, top, h: hh, wPct: 100, leftPct: 0, continuesBefore: di.continuesBefore, continuesAfter: di.continuesAfter })
      seen.add(di.event.id)
    }

    return { blocks: blks, plusBtns: btns }
  }, [dayEvents, totalH, priorityRank])

  function handleDoubleClickSlot(h: number) {
    const st = new Date(date); st.setHours(h, 0, 0, 0); const ed = new Date(date); ed.setHours(h + 1, 0, 0, 0)
    const e = useEventStore.getState().addEvent({ name: '新事件', description: '', startTime: st, endTime: ed, chainId: '', typeId: 'type-course', reminders: [], properties: {}, isHighlight: false, priority: 0 })
    const gid = useEventGroupStore.getState().ensureActiveGroup(); useEventGroupStore.getState().addEventToGroup(gid, e.id)
  }

  return (
    <div ref={containerRef} className="bg-white dark:bg-slate-900 relative" style={{ minHeight: totalH }}>
      {HOURS.map(hour => (
          <div key={hour} className="border-b border-slate-100 dark:border-slate-800 relative group hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
          style={{ height: slotH }}
          onClick={e => {
            if ((e.target as HTMLElement).closest('.event-block')) return
            useUIStore.getState().setSelectedEvent(undefined)
            useUIStore.getState().clearMultiSelect()
          }}
          onDoubleClick={e => { if ((e.target as HTMLElement).closest('.event-block') || (e.target as HTMLElement).closest('button')) return; handleDoubleClickSlot(hour) }}
          onContextMenu={e => { if ((e.target as HTMLElement).closest('.event-block')) return; e.preventDefault(); e.stopPropagation(); setBlankMenu({ x: e.clientX, y: e.clientY, hour }) }}>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-accent-400/5 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-medium transition-all pointer-events-none">双击创建事件</div>
        </div>
      ))}
      {blocks.map(b => (
        <div key={b.event.id} className="pointer-events-auto absolute px-0.5"
          style={{ top: b.top, left: `${b.leftPct}%`, width: `${b.wPct}%`, height: Math.max(b.h - 1, 18), zIndex: selectedEventId === b.event.id ? 10 : (highlightedChainId === b.event.chainId && b.event.id !== selectedEventId ? 5 : 1) }}>
          <EventBlockItem event={b.event} isHighlighted={highlightedChainId === b.event.chainId && b.event.id !== selectedEventId} continuesBefore={b.continuesBefore} continuesAfter={b.continuesAfter} />
        </div>
      ))}
      {plusBtns.map((btn, i) => (
        <button key={i}
          onClick={(e) => { const r = (e.target as HTMLElement).getBoundingClientRect(); setExpandPopup({ eventIds: btn.ids, anchor: r }) }}
          className="pointer-events-auto absolute flex items-center justify-center text-[10px] font-bold text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-900/20 rounded-md border border-accent-200 dark:border-accent-700 hover:bg-accent-100 dark:hover:bg-accent-900/30 transition-all z-10"
          style={{ top: btn.top, left: `${btn.leftPct}%`, width: `${btn.wPct}%`, height: Math.max(btn.h - 1, 18) }}>
           +{btn.cnt > 1 ? btn.cnt : ''}
        </button>
      ))}
      {expandPopup && (
        <div className="fixed inset-0 z-[120]" onClick={() => setExpandPopup(null)}>
          <div onClick={e => e.stopPropagation()}
            className="absolute bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-overlay border border-slate-200/60 dark:border-slate-700/60 p-4 w-72 max-h-80 overflow-y-auto"
            style={{ top: Math.min(expandPopup.anchor.top, window.innerHeight - 360), left: Math.min(expandPopup.anchor.right + 8, window.innerWidth - 300) }}>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">该时段全部事件 ({expandPopup.eventIds.length})</div>
            {expandPopup.eventIds.map(eid => {
              const evt = useEventStore.getState().getEvent(eid)
              if (!evt) return null
              const t = useEventStore.getState().getEventType(evt.typeId)
              const ch = useEventStore.getState().getEventChain(evt.chainId)
              const gs = useEventGroupStore.getState().groups
              const g = Array.from(gs.values()).find(gr => gr.eventIds.includes(evt.id) || gr.eventChainIds.includes(evt.chainId))
              return (
                <div key={eid} className="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer mb-1 border border-slate-100 dark:border-slate-800"
                  onClick={() => { useUIStore.getState().setSelectedEvent(eid); setExpandPopup(null) }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{t?.emoji}</span>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate flex-1">{evt.name}</span>
                    {evt.isHighlight && <span className="text-yellow-500 text-xs">⭐</span>}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 ml-6">
                    {new Date(evt.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - {new Date(evt.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {(ch || g) && (
                    <div className="flex items-center gap-2 mt-0.5 ml-6 text-[10px]">
                      {ch && <span className="text-slate-400">链: <span style={{ color: ch.color }}>{ch.name}</span></span>}
                      {g && <span className="text-slate-400">组: {g.emoji} {g.name}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {blankMenu && (
        <div ref={blankMenuRef} className="fixed bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-overlay z-[85] border border-slate-200/60 dark:border-slate-700/60 min-w-36"
          style={{ left: Math.min(blankMenu.x, window.innerWidth - 160), top: Math.min(blankMenu.y, window.innerHeight - 100) }}>
          <button onClick={() => { handleDoubleClickSlot(blankMenu.hour); setBlankMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-xs rounded-t-lg"><Plus className="w-3.5 h-3.5 text-blue-500" /> 在此新建事件</button>
          {clipboardEvent && (
            <button onClick={() => { const start = new Date(date); start.setHours(blankMenu.hour, 0, 0, 0); const e = useEventStore.getState().pasteEvent(start); if (e) { const gid = useEventGroupStore.getState().ensureActiveGroup(); useEventGroupStore.getState().addEventToGroup(gid, e.id) }; setBlankMenu(null) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-xs rounded-b-lg"><ClipboardPaste className="w-3.5 h-3.5 text-purple-500" /> 粘贴事件到此</button>
          )}
        </div>
      )}
    </div>
  )
}
