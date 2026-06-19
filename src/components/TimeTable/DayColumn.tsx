/**
 * 日列 — 重叠事件布局：前3个正常，4+折叠为+号方块
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

  const dayEvents = useMemo(() => events.filter(e => { const d = new Date(e.startTime); return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate() }), [events, date])
  const highlightedChainId = useMemo(() => { if (!selectedEventId) return null; return useEventStore.getState().getEvent(selectedEventId)?.chainId || null }, [selectedEventId])
  const totalH = 24 * slotH
  const priorityRank = useMemo(() => { const s = [...dayEvents].sort((a, b) => b.priority - a.priority || new Date(a.startTime).getTime() - new Date(b.startTime).getTime()); return new Map(s.map((e, i) => [e.id, i])) }, [dayEvents])

  const { blocks, plusBtns } = useMemo(() => {
    type Block = { event: Event; top: number; h: number; wPct: number; leftPct: number }
    type Plus = { top: number; h: number; wPct: number; leftPct: number; cnt: number; ids: string[] }
    const blks: Block[] = []
    const btns: Plus[] = []
    const seen = new Set<string>() // processed event ids

    for (const evt of dayEvents) {
      if (seen.has(evt.id)) continue
      // 找到包含此事件的最大重叠组
      const st = new Date(evt.startTime)
      const ed = new Date(evt.endTime)
      const ms = st.getHours() * 60 + st.getMinutes()
      const me = ed.getHours() * 60 + ed.getMinutes()

      // BFS 扩展找到完全连通的重叠组
      const stack = [evt.id]
      const groupSet = new Set<string>()
      while (stack.length > 0) {
        const id = stack.pop()!
        if (groupSet.has(id)) continue
        groupSet.add(id)
        const e = dayEvents.find(x => x.id === id)
        if (!e) continue
        const es = new Date(e.startTime).getHours() * 60 + new Date(e.startTime).getMinutes()
        const ee = new Date(e.endTime).getHours() * 60 + new Date(e.endTime).getMinutes()
        for (const o of dayEvents) {
          if (groupSet.has(o.id)) continue
          const os = new Date(o.startTime).getHours() * 60 + new Date(o.startTime).getMinutes()
          const oe = new Date(o.endTime).getHours() * 60 + new Date(o.endTime).getMinutes()
          if (os < ee && oe > es) stack.push(o.id)
        }
      }

      const group = [...groupSet].map(id => dayEvents.find(e => e.id === id)!).filter(Boolean)
      if (group.length === 0) { seen.add(evt.id); continue }
      const sorted = group.sort((a, b) => (priorityRank.get(a.id) ?? 99) - (priorityRank.get(b.id) ?? 99))
      const total = sorted.length
      group.forEach(e => seen.add(e.id))

      // 确定宽度：3+ 展示2个事件 + 小加号
      let wps: number[]
      let visible: number
      if (total >= 3) { wps = W3P; visible = 2 }
      else if (total === 2) { wps = W2; visible = 2 }
      else { wps = W1; visible = 1 }

      // 放置可见事件块
      for (let i = 0; i < visible; i++) {
        const e = sorted[i]
        const t = new Date(e.startTime)
        const ed2 = new Date(e.endTime)
        const top = (t.getHours() * 60 + t.getMinutes()) / 1440 * totalH
        const hh = Math.max(20, ((ed2.getHours() * 60 + ed2.getMinutes()) - (t.getHours() * 60 + t.getMinutes())) / 1440 * totalH)
        const left = wps.slice(0, i).reduce((s, v) => s + v, 0)
        blks.push({ event: e, top, h: hh, wPct: wps[i], leftPct: left })
      }

      // +号按钮：高度取组内最长事件，显示全部事件
      if (total > 2) {
        const baseTop = (new Date(sorted[0].startTime).getHours() * 60 + new Date(sorted[0].startTime).getMinutes()) / 1440 * totalH
        // 取组内最长事件的持续时间
        const maxDur = Math.max(...sorted.map(e => {
          const es = new Date(e.startTime).getHours() * 60 + new Date(e.startTime).getMinutes()
          const ee = new Date(e.endTime).getHours() * 60 + new Date(e.endTime).getMinutes()
          return ee - es
        }))
        const baseH = Math.max(20, maxDur / 1440 * totalH)
        btns.push({
          top: baseTop, h: baseH,
          wPct: wps[2],
          leftPct: wps.slice(0, 2).reduce((s, v) => s + v, 0),
          cnt: total - 2,
          ids: sorted.map(e => e.id),
        })
      }
    }

    // 兜底：未被处理的事件单独渲染
    for (const evt of dayEvents) {
      if (seen.has(evt.id)) continue
      const t = new Date(evt.startTime)
      const ed2 = new Date(evt.endTime)
      const top = (t.getHours() * 60 + t.getMinutes()) / 1440 * totalH
      const hh = Math.max(20, ((ed2.getHours() * 60 + ed2.getMinutes()) - (t.getHours() * 60 + t.getMinutes())) / 1440 * totalH)
      blks.push({ event: evt, top, h: hh, wPct: 100, leftPct: 0 })
      seen.add(evt.id)
    }

    return { blocks: blks, plusBtns: btns }
  }, [dayEvents, totalH, priorityRank])

  function handleDoubleClickSlot(h: number) {
    const st = new Date(date); st.setHours(h, 0, 0, 0); const ed = new Date(date); ed.setHours(h + 1, 0, 0, 0)
    const e = useEventStore.getState().addEvent({ name: '新事件', description: '', startTime: st, endTime: ed, chainId: '', typeId: 'type-course', reminders: [], properties: {}, isHighlight: false, priority: 0 })
    const gid = useEventGroupStore.getState().ensureActiveGroup(); useEventGroupStore.getState().addEventToGroup(gid, e.id)
  }

  return (
    <div ref={containerRef} className="bg-white dark:bg-slate-800 relative" style={{ minHeight: totalH }}>
      {HOURS.map(hour => (
        <div key={hour} className="border-b border-slate-200 dark:border-slate-700 relative group hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
          style={{ height: slotH }}
          onClick={e => {
            if ((e.target as HTMLElement).closest('.event-block')) return
            useUIStore.getState().setSelectedEvent(undefined)
            useUIStore.getState().clearMultiSelect()
          }}
          onDoubleClick={e => { if ((e.target as HTMLElement).closest('.event-block') || (e.target as HTMLElement).closest('button')) return; handleDoubleClickSlot(hour) }}
          onContextMenu={e => { if ((e.target as HTMLElement).closest('.event-block')) return; e.preventDefault(); e.stopPropagation(); setBlankMenu({ x: e.clientX, y: e.clientY, hour }) }}>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-blue-400/5 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-medium transition-all pointer-events-none">双击创建事件</div>
        </div>
      ))}
      {blocks.map(b => (
        <div key={b.event.id} className="pointer-events-auto absolute px-0.5"
          style={{ top: b.top, left: `${b.leftPct}%`, width: `${b.wPct}%`, height: Math.max(b.h - 1, 18), zIndex: selectedEventId === b.event.id ? 10 : (highlightedChainId === b.event.chainId && b.event.id !== selectedEventId ? 5 : 1) }}>
          <EventBlockItem event={b.event} isHighlighted={highlightedChainId === b.event.chainId && b.event.id !== selectedEventId} />
        </div>
      ))}
      {plusBtns.map((btn, i) => (
        <button key={i}
          onClick={(e) => { const r = (e.target as HTMLElement).getBoundingClientRect(); setExpandPopup({ eventIds: btn.ids, anchor: r }) }}
          className="pointer-events-auto absolute flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all z-10"
          style={{ top: btn.top, left: `${btn.leftPct}%`, width: `${btn.wPct}%`, height: Math.max(btn.h - 1, 18) }}>
           +{btn.cnt > 1 ? btn.cnt : ''}
        </button>
      ))}
      {expandPopup && (
        <div className="fixed inset-0 z-[120]" onClick={() => setExpandPopup(null)}>
          <div onClick={e => e.stopPropagation()}
            className="absolute bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 w-72 max-h-80 overflow-y-auto"
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
                <div key={eid} className="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer mb-1 border border-slate-100 dark:border-slate-700"
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
        <div ref={blankMenuRef} className="fixed bg-white dark:bg-slate-800 rounded-lg shadow-2xl z-[85] border border-slate-200 dark:border-slate-700 min-w-36"
          style={{ left: Math.min(blankMenu.x, window.innerWidth - 160), top: Math.min(blankMenu.y, window.innerHeight - 100) }}>
          <button onClick={() => { handleDoubleClickSlot(blankMenu.hour); setBlankMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs rounded-t-lg"><Plus className="w-3.5 h-3.5 text-blue-500" /> 在此新建事件</button>
          {clipboardEvent && (
            <button onClick={() => { const start = new Date(date); start.setHours(blankMenu.hour, 0, 0, 0); const e = useEventStore.getState().pasteEvent(start); if (e) { const gid = useEventGroupStore.getState().ensureActiveGroup(); useEventGroupStore.getState().addEventToGroup(gid, e.id) }; setBlankMenu(null) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs rounded-b-lg"><ClipboardPaste className="w-3.5 h-3.5 text-purple-500" /> 粘贴事件到此</button>
          )}
        </div>
      )}
    </div>
  )
}
