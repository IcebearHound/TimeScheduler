import { useEffect, useState } from 'react'
import { connectLocal, connectionStatus, disconnectLocal, isConnected } from '../integrations/localClient'

export default function MCPConnectionPanel() {
  const [connected, setConnected] = useState(isConnected()), [code, setCode] = useState('')
  const [message, setMessage] = useState(connectionStatus()), [busy, setBusy] = useState(false)
  useEffect(() => { const timer = setInterval(() => setMessage(connectionStatus()), 1000); return () => clearInterval(timer) }, [])
  return <section className="space-y-3 text-xs">
    <p>仅供电脑上的外部 MCP 客户端使用。网页 AI 无需连接此服务。</p>
    <p>在项目目录运行 <code>npm run mcp</code>，再输入终端配对码。工具 <code>get_archive</code> 读取存档，<code>apply_actions</code> 应用修改；网页须保持打开。</p>
    {!connected ? <><input aria-label="本机配对码" className="workspace-input" value={code} autoComplete="off" placeholder="8 位配对码" onChange={e => setCode(e.target.value)} /><button type="button" className="workspace-button" disabled={busy || !code} onClick={async () => { setBusy(true); try { await connectLocal(code); setConnected(true); setCode(''); setMessage(connectionStatus()) } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) } }}>连接此存档（允许 MCP 读写）</button></> : <button type="button" className="workspace-button" disabled={busy} onClick={async () => { setBusy(true); try { await disconnectLocal(); setConnected(false); setMessage(connectionStatus()) } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) } }}>断开 MCP 连接</button>}
    <p>{message}</p>
  </section>
}
