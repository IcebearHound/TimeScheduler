import { create } from 'zustand'
import { z } from 'zod'
import { generatedFileSchema } from '../integrations/agentArtifacts'

const messageSchema = z.object({ role: z.enum(['user', 'assistant']), text: z.string(), ids: z.array(z.string()).optional(), files: z.array(z.string()).optional(), generatedFiles: z.array(generatedFileSchema).optional() })
const threadSchema = z.object({ id: z.string(), title: z.string(), createdAt: z.string(), updatedAt: z.string(), messages: z.array(messageSchema), draft: z.string(), profileId: z.string().optional(), model: z.string().optional() })
const historySchema = z.object({ version: z.literal(1), activeId: z.string(), threads: z.array(threadSchema) })
export type AgentMessage = z.infer<typeof messageSchema>
export type AgentThread = z.infer<typeof threadSchema>
export const agentHistoryKey = 'time-scheduler-agent-history-v1'
const freshThread = (): AgentThread => { const stamp = new Date().toISOString(); return { id: crypto.randomUUID(), title: '新对话', createdAt: stamp, updatedAt: stamp, messages: [], draft: '' } }
type HistoryState = {
  threads: AgentThread[]; activeId: string; storageError: string
  createThread: () => string; selectThread: (id: string) => void; deleteThread: (id: string) => void
  renameThread: (id: string, title: string) => void
  updateThread: (id: string, changes: Partial<Pick<AgentThread, 'draft' | 'profileId' | 'model'>>) => void
  append: (id: string, message: AgentMessage) => void
}
export function createAgentHistoryStore(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined) {
  let threads: AgentThread[] = [], activeId = '', storageError = ''
  try {
    const raw = storage?.getItem(agentHistoryKey)
    if (raw) { const saved = historySchema.parse(JSON.parse(raw)); threads = saved.threads; activeId = saved.activeId }
  } catch { storageError = '历史记录无法读取；原始记录尚未覆盖。新消息只保留在本次页面中，请先备份浏览器数据。' }
  const unreadable = !!storageError
  if (!threads.length) threads = [freshThread()]
  if (!threads.some(t => t.id === activeId)) activeId = threads[0].id
  return create<HistoryState>((set, get) => {
    const commit = (changes: Partial<HistoryState>) => {
      set(changes)
      if (unreadable) return
      try {
        if (!storage) throw Error('storage unavailable')
        // Only conversation content and selection are persisted, never credentials,
        // raw uploads, fetched web pages or executable pending action proposals.
        const state = get()
        storage.setItem(agentHistoryKey, JSON.stringify(historySchema.parse({ version: 1, activeId: state.activeId, threads: state.threads })))
        set({ storageError: '' })
      } catch { set({ storageError: '历史记录保存失败，可能存储空间已满。当前内容仍在页面中，请删除不需要的对话后重试。' }) }
    }
    return { threads, activeId, storageError,
      createThread: () => { const thread = freshThread(); commit({ threads: [thread, ...get().threads], activeId: thread.id }); return thread.id },
      selectThread: id => { if (get().threads.some(t => t.id === id)) commit({ activeId: id }) },
      deleteThread: id => { let remaining = get().threads.filter(t => t.id !== id); if (!remaining.length) remaining = [freshThread()]; commit({ threads: remaining, activeId: get().activeId === id ? remaining[0].id : get().activeId }) },
      renameThread: (id, title) => { if (title.trim()) commit({ threads: get().threads.map(t => t.id === id ? { ...t, title: title.trim().slice(0, 80) } : t) }) },
      updateThread: (id, changes) => commit({ threads: get().threads.map(t => t.id === id ? { ...t, ...changes } : t) }),
      append: (id, message) => commit({ threads: get().threads.map(t => t.id === id ? { ...t, title: !t.messages.length && t.title === '新对话' && message.role === 'user' ? message.text.slice(0, 32) : t.title, updatedAt: new Date().toISOString(), messages: [...t.messages, message] } : t) }),
    }
  })
}
let storage: Storage | undefined
try { storage = globalThis.localStorage } catch {}
export default createAgentHistoryStore(storage)
