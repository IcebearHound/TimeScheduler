import { useRef, useState } from 'react'
import { Check, MessageSquare, MoreHorizontal, Pencil, Search, Trash2, X } from 'lucide-react'
import { AgentThread } from '../stores/agentHistoryStore'
import useDismissiblePanel from '../utils/useDismissiblePanel'

function dateGroup(stamp: string) {
  const date = new Date(stamp), today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const week = new Date(today); week.setDate(week.getDate() - 6)
  return date >= today ? '今天' : date >= yesterday ? '昨天' : date >= week ? '最近 7 天' : '更早'
}
export default function AgentHistoryPanel({ threads, activeId, onSelect, onRename, onDelete, onClose }: {
  threads: AgentThread[]; activeId: string; onSelect: (id: string) => void; onRename: (id: string, title: string) => void; onDelete: (id: string) => void; onClose: () => void
}) {
  const [search, setSearch] = useState(''), [menuId, setMenuId] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null), [title, setTitle] = useState('')
  const root = useRef<HTMLElement>(null)
  useDismissiblePanel(root, true, () => { if (renaming) setRenaming(null); else if (menuId) setMenuId(null); else onClose() })
  const filtered = [...threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter(t => (t.title + ' ' + t.draft + ' ' + t.messages.map(m => m.text).join(' ')).toLowerCase().includes(search.trim().toLowerCase()))
  const groups = new Map<string, AgentThread[]>()
  for (const thread of filtered) { const group = dateGroup(thread.updatedAt); groups.set(group, [...(groups.get(group) || []), thread]) }
  return <section ref={root} aria-label="历史对话记录" className="agent-history-panel min-h-0 flex-1 overflow-y-auto p-3">
    <div className="agent-history-search"><Search size={15} aria-hidden="true" /><input aria-label="搜索历史对话" placeholder="搜索对话" value={search} onChange={e => setSearch(e.target.value)} />{search && <button aria-label="清空对话搜索" className="agent-icon-button" onClick={() => setSearch('')}><X size={13} /></button>}</div>
    {!filtered.length && <div className="py-12 text-center text-slate-400"><MessageSquare size={28} className="mx-auto mb-3" /><p className="text-sm">没有找到相关对话</p><p className="mt-1 text-xs">试试其他关键词</p></div>}
    {[...groups].map(([name, items]) => <div key={name} className="mt-4"><h3 className="mb-1.5 px-2 text-[11px] font-medium text-slate-400">{name}</h3><div className="space-y-1">{items.map(t => {
      const selected = t.id === activeId, editing = renaming === t.id
      const preview = t.draft.trim() || t.messages[t.messages.length - 1]?.text || '开始一段新对话'
      return <article key={t.id} data-history-id={t.id} data-history-active={selected} className={`agent-history-row ${selected ? 'is-active' : ''}`} onContextMenu={e => { e.preventDefault(); setMenuId(t.id); setRenaming(null) }}>
        {editing ? <form className="flex min-w-0 items-center gap-1 p-2" onSubmit={e => { e.preventDefault(); if (title.trim()) { onRename(t.id, title); setRenaming(null) } }}>
          <input autoFocus aria-label={'重命名对话：' + t.title} className="workspace-input min-w-0 flex-1" maxLength={80} value={title} onChange={e => setTitle(e.target.value)} />
          <button className="agent-icon-button" aria-label="保存对话名称" disabled={!title.trim()}><Check size={15} /></button><button type="button" className="agent-icon-button" aria-label="取消重命名" onClick={() => setRenaming(null)}><X size={15} /></button>
        </form> : <div className="flex min-w-0 items-center">
          <button className="flex min-w-0 flex-1 items-center gap-2.5 p-2.5 text-left" aria-label={`${selected ? '继续当前对话' : '打开对话'}：${t.title}`} aria-current={selected ? 'true' : undefined} onClick={() => onSelect(t.id)}>
            <span className="agent-history-avatar"><MessageSquare size={16} /></span>
            <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5"><span className="truncate text-sm font-medium">{t.title}</span>{selected && <span aria-label="当前对话" className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />}</span><span className="mt-0.5 block truncate text-xs text-slate-400">{t.draft.trim() && <span className="mr-1 text-indigo-500">草稿</span>}{preview}</span></span>
          </button>
          <div className="flex shrink-0 flex-col items-center pr-1"><time className="text-[10px] text-slate-400" dateTime={t.updatedAt} title={`${new Date(t.updatedAt).toLocaleString('zh-CN')} · ${t.messages.length} 条消息`}>{dateGroup(t.updatedAt) === '今天' ? new Date(t.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : new Date(t.updatedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</time><button className="agent-icon-button" aria-label={'对话操作：' + t.title} aria-expanded={menuId === t.id} onClick={() => setMenuId(menuId === t.id ? null : t.id)}><MoreHorizontal size={16} /></button></div>
        </div>}
        {menuId === t.id && !editing && <div role="menu" aria-label={'对话操作：' + t.title} className="flex gap-1 border-t border-slate-100 px-2 py-1 dark:border-slate-800"><button role="menuitem" className="agent-history-action" onClick={() => { setTitle(t.title); setRenaming(t.id); setMenuId(null) }}><Pencil size={13} />重命名</button><button role="menuitem" className="agent-history-action text-rose-600" aria-label={'删除对话：' + t.title} onClick={() => { onDelete(t.id); setMenuId(null) }}><Trash2 size={13} />删除</button></div>}
      </article>
    })}</div></div>)}
    <p className="px-2 pb-1 pt-5 text-[10px] text-slate-400">仅保存在此浏览器 · 上传附件需重新选择</p>
  </section>
}
