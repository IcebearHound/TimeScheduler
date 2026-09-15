import { randomUUID } from 'node:crypto'
import { actionsSchema, Snapshot, snapshotRevision, validateSnapshot } from '../src/integrations/contracts'

export class ArchiveBridge {
  private client = ''
  private lastSeen = 0
  private snapshot?: Snapshot
  private revision = ''
  private pending?: { id: string; actions: unknown; revision: string; expires: number; resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
  async heartbeat(client: string, input: unknown) {
    if (this.client && this.client !== client && Date.now() - this.lastSeen < 10000) throw new Error('另一个网页正在连接存档，请先断开它')
    const snapshot = validateSnapshot(input)
    this.client = client; this.lastSeen = Date.now(); this.snapshot = snapshot; this.revision = await snapshotRevision(snapshot)
    const p = this.pending
    return { revision: this.revision, command: p ? { id: p.id, actions: p.actions, revision: p.revision, expires: p.expires } : null }
  }
  read() {
    if (!this.snapshot || Date.now() - this.lastSeen > 5000) throw new Error('存档网页未连接或已休眠，请打开网页并连接本机服务')
    return { snapshot: this.snapshot, revision: this.revision }
  }
  apply(actions: unknown, revision: string) {
    actionsSchema.parse(actions)
    if (this.read().revision !== revision) throw new Error('存档版本冲突，请重新读取')
    if (this.pending) throw new Error('已有操作正在执行')
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending = undefined; reject(new Error('网页未及时确认；请读取存档核验操作结果后再重试')) }, 20000)
      this.pending = { id: randomUUID(), actions, revision, expires: Date.now() + 18000, resolve, reject, timer }
    })
  }
  async acknowledge(client: string, id: string, result: { error?: string; snapshot?: unknown }) {
    const p = this.pending
    if (client !== this.client || p?.id !== id) throw new Error('操作已过期或不属于当前网页')
    if (result.error) { clearTimeout(p.timer); this.pending = undefined; p.reject(new Error(result.error)); return }
    if (!result.snapshot) throw new Error('缺少执行后的存档')
    const snapshot = validateSnapshot(result.snapshot), revision = await snapshotRevision(snapshot)
    clearTimeout(p.timer); this.pending = undefined; this.snapshot = snapshot; this.revision = revision; this.lastSeen = Date.now()
    p.resolve({ applied: true, revision, eventCount: snapshot.events.length })
  }
  disconnect() {
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(new Error('连接已断开')); this.pending = undefined }
    this.snapshot = undefined; this.client = ''; this.lastSeen = 0
  }
}
