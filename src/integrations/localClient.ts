import { applyActions, captureArchive } from './archive'

const endpoint = 'http://127.0.0.1:4318'
let token = ''
let bridgeTimer: ReturnType<typeof setTimeout> | undefined
let generation = 0
let bridgeMessage = '未连接'
export const connectionStatus = () => bridgeMessage
export const isConnected = () => !!token
export async function localRequest<T = any>(path: string, input: unknown = {}): Promise<T> {
  let response: Response
  try { response = await fetch(endpoint + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(input), signal: AbortSignal.timeout(path === '/ai/propose' ? 100000 : 60000) }) } catch { throw new Error('无法连接本机服务。请运行 npm run local（MCP 用户运行 npm run mcp），并检查浏览器本地网络权限') }
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || `请求失败 ${response.status}`)
  return data
}
export async function connectLocal(code: string) {
  const result = await localRequest<{ session: string }>('/pair', { code })
  token = result.session
  const client = crypto.randomUUID(), currentGeneration = ++generation
  const completed = new Map<string, unknown>()
  clearTimeout(bridgeTimer)
  const tick = async () => {
    try {
      const response = await localRequest('/bridge/heartbeat', { client, snapshot: captureArchive() })
      if (currentGeneration !== generation) return
      bridgeMessage = '此存档已连接 · MCP 可读写'
      const command = response.command
      if (command) {
        let result = completed.get(command.id)
        if (!result) {
          try {
            if (command.expires < Date.now()) throw new Error('操作已过期')
            result = await applyActions(command.actions, command.revision)
          } catch (e) { result = { error: e instanceof Error ? e.message : '操作失败' } }
          completed.set(command.id, result)
          if (completed.size > 100) completed.delete(completed.keys().next().value!)
        }
        await localRequest('/bridge/ack', { client, id: command.id, ...result as object })
      }
    } catch (e) { bridgeMessage = e instanceof Error ? e.message : '连接失败' }
    if (currentGeneration === generation) bridgeTimer = setTimeout(tick, 1000)
  }
  void tick()
}
export async function disconnectLocal() {
  await localRequest('/disconnect')
  ++generation; clearTimeout(bridgeTimer); token = ''; bridgeMessage = '未连接'
}
