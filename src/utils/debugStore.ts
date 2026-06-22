/**
 * 调试日志 - 追踪撤销/重做操作
 */
export interface DebugEntry {
  ts: number
  type: 'pushHistory' | 'undo' | 'redo' | 'move'
  action: string
  affected?: Array<{ type: string; id: string; name: string }>
  undoStackLen: number
  redoStackLen: number
}

let log: DebugEntry[] = []
let listeners: Array<() => void> = []

export function debugLog(entry: Omit<DebugEntry, 'ts'>) {
  log = [...log.slice(-199), { ...entry, ts: Date.now() }]
  listeners.forEach(fn => fn())
}

export function getDebugLog(): DebugEntry[] {
  return log
}

export function subscribeDebug(fn: () => void) {
  listeners.push(fn)
  return () => { listeners = listeners.filter(l => l !== fn) }
}

export function clearDebugLog() {
  log = []
  listeners.forEach(fn => fn())
}
