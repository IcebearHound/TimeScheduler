/**
 * 搜索对话框 - 支持按名称、属性、时间查找
 */
import React, { useState, useMemo } from 'react'
import { X, Search as SearchIcon, Star } from 'lucide-react'
import useEventStore from '../stores/eventStore'
import useUIStore from '../stores/uiStore'
import { Event } from '../types/event'

interface SearchResult {
  event: Event
  source: string
}

interface SearchDialogProps {
  onClose: () => void
}

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

const EN_TO_CN: Record<string, string> = {
  location: '地点', teacher: '授课老师', courseCode: '课序号',
  examForm: '考试形式', supervisor: '监考老师',
  labTeacher: '实验指导老师', labContent: '实验内容',
}

function parseTimeQuery(q: string): { text: string; dateFilter?: (d: Date) => boolean } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // 今天/明天/后天
  if (q.includes('今天')) {
    return { text: q.replace('今天', ''), dateFilter: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === today.getTime() }
  }
  if (q.includes('明天')) {
    const t = new Date(today); t.setDate(t.getDate() + 1)
    return { text: q.replace('明天', ''), dateFilter: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === t.getTime() }
  }
  if (q.includes('后天')) {
    const t = new Date(today); t.setDate(t.getDate() + 2)
    return { text: q.replace('后天', ''), dateFilter: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === t.getTime() }
  }

  // 本周/下周
  if (q.includes('本周')) {
    const start = new Date(today); start.setDate(today.getDate() - today.getDay())
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return { text: q.replace('本周', ''), dateFilter: (d) => d >= start && d <= new Date(end.getTime() + 86400000) }
  }
  if (q.includes('下周')) {
    const start = new Date(today); start.setDate(today.getDate() - today.getDay() + 7)
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return { text: q.replace('下周', ''), dateFilter: (d) => d >= start && d <= new Date(end.getTime() + 86400000) }
  }

  // 周几
  for (let i = 0; i < 7; i++) {
    const label = `周${DAY_NAMES[i]}`
    if (q.includes(label)) {
      return { text: q.replace(label, ''), dateFilter: (d) => d.getDay() === i }
    }
  }

  // 时间格式 HH:MM 或 H:MM
  const timeMatch = q.match(/(\d{1,2}):(\d{2})/)
  if (timeMatch) {
    const h = parseInt(timeMatch[1]), m = parseInt(timeMatch[2])
    return { text: q.replace(timeMatch[0], ''), dateFilter: (d) => d.getHours() === h && d.getMinutes() === m }
  }

  // 日期格式 YYYY-MM-DD 或 YYYY/MM/DD 或 M/D
  const dateMatch = q.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/) || q.match(/(\d{1,2})[-\/](\d{1,2})/)
  if (dateMatch) {
    if (dateMatch.length === 4) {
      const [_, y, mo, d] = dateMatch
      const target = new Date(parseInt(y), parseInt(mo) - 1, parseInt(d))
      return { text: q.replace(dateMatch[0], ''), dateFilter: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === target.getTime() }
    } else if (dateMatch.length === 3) {
      const [_, mo, d] = dateMatch
      const target = new Date(today.getFullYear(), parseInt(mo) - 1, parseInt(d))
      return { text: q.replace(dateMatch[0], ''), dateFilter: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === target.getTime() }
    }
  }

  return { text: q }
}

export default function SearchDialog({ onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('')
  const eventStore = useEventStore.getState()
  const setSelectedEvent = useUIStore((state) => state.setSelectedEvent)
  const setCurrentDate = useUIStore((state) => state.setCurrentDate)
  const setViewMode = useUIStore((state) => state.setViewMode)

  const results = useMemo(() => {
    if (!query.trim()) return { byChain: new Map<string, SearchResult[]>(), events: [] as SearchResult[] }
    const { text, dateFilter } = parseTimeQuery(query.trim())
    const q = text.trim().toLowerCase()
    const events = Array.from(eventStore.events.values())
    const filtered: SearchResult[] = []
    for (const e of events) {
      if (dateFilter && !dateFilter(new Date(e.startTime))) continue
      if (!q) { filtered.push({ event: e, source: '' }); continue }
      const chain = eventStore.getEventChain(e.chainId)
      const type = eventStore.getEventType(e.typeId)
      let source = ''
      if (e.name.toLowerCase().includes(q)) source = e.name
      else if (e.description && e.description.toLowerCase().includes(q)) source = e.description
      else if (chain && chain.name.toLowerCase().includes(q)) source = chain.name
      else if (type && type.name.toLowerCase().includes(q)) source = type.name
      else {
        for (const [k, v] of Object.entries(e.properties || {})) {
          if (v && String(v).toLowerCase().includes(q)) { source = `${EN_TO_CN[k] || k}: ${v}`; break }
        }
      }
      if (source) filtered.push({ event: e, source })
    }
    const byChain = new Map<string, SearchResult[]>()
    filtered.forEach(item => {
      const cid = item.event.chainId || '__none__'
      if (!byChain.has(cid)) byChain.set(cid, [])
      byChain.get(cid)!.push(item)
    })
    return { byChain, events: filtered }
  }, [query, eventStore.events])

  const handleSelect = (eventId: string) => {
    const event = eventStore.getEvent(eventId)
    if (event) {
      setSelectedEvent(eventId)
      setCurrentDate(new Date(event.startTime))
      setViewMode('week')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-start justify-center pt-[20vh] z-50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
          <SearchIcon className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索事件（链）、日期、属性等..."
            className="flex-1 bg-transparent text-slate-900 dark:text-white focus:outline-none text-lg"
            autoFocus
          />
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {query.trim() && (
          <div className="max-h-80 overflow-y-auto p-2">
            {results.events.length === 0 ? (
              <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                没有找到相关事件
              </div>
            ) : (
              <>
                {Array.from(results.byChain).map(([cid, evts]) => {
                  const chain = cid !== '__none__' ? eventStore.getEventChain(cid) : null
                  return (
                    <div key={cid} className="mb-2">
                      {chain && (
                        <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-slate-400">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: chain.color }} />
                          {chain.name} ({evts.length})
                        </div>
                      )}
                      {evts.slice(0, chain ? 5 : 20).map(({ event, source }) => {
                        const type = eventStore.getEventType(event.typeId)
                        return (
                          <button key={event.id} onClick={() => handleSelect(event.id)}
                            className="w-full text-left p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{type?.emoji}</span>
                              <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{event.name}</span>
                              {event.isHighlight && <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 ml-7">
                              {new Date(event.startTime).toLocaleDateString('zh-CN')}{' '}
                              {new Date(event.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                              {event.properties.location && ` · ${event.properties.location}`}
                            </div>
                            {source && (
                              <div className="text-[10px] text-amber-500 dark:text-amber-400 mt-0.5 ml-7 truncate">
                                {source}
                              </div>
                            )}
                          </button>
                        )
                      })}
                      {chain && evts.length > 5 && (
                        <p className="text-[10px] text-slate-400 text-center py-1">还有 {evts.length - 5} 项</p>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        <div className="border-t border-slate-200 dark:border-slate-700 p-3">
          <div className="text-xs text-slate-400 dark:text-slate-500 text-center">
            按名称、属性、事件链、日期（今天/后天/周几/2026-05-27）、时间等搜索
          </div>
        </div>
      </div>
    </div>
  )
}
