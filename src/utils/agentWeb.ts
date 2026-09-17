import { AgentWebPage } from '../integrations/agentArtifacts'

export function publicWebUrl(value: string): string {
  const url = new URL(value)
  const host = url.hostname.toLowerCase()
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port && !['80', '443'].includes(url.port)) throw new Error('仅支持无账号密码的公开 HTTP(S) 网页链接')
  if (!host.includes('.') || /[\[\]:]/.test(host) || /^(\d+\.){3}\d+$/.test(host) || /\.(localhost|local|internal|test|invalid)$/.test(host)) throw new Error('不支持本机、内网或 IP 地址链接')
  url.hash = ''
  if (url.href.length > 2048) throw new Error('网页链接过长')
  return url.href
}
export function messageLinks(message: string): string[] {
  return [...new Set((message.match(/https?:\/\/[^\s<>"`\u3000-\u303f\uff00-\uffef]+/g) || []).map(value => value.replace(/[),.;!?\]]+$/, '')))]
}
export async function readAgentWebPage(value: string, signal: AbortSignal, apiKey = ''): Promise<AgentWebPage> {
  let url = value
  try {
    url = publicWebUrl(value)
    const headers: Record<string, string> = { Accept: 'text/plain' }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    const response = await fetch(`https://r.jina.ai/${url}`, { headers, signal, credentials: 'omit', redirect: 'error' })
    if (!response.ok) throw new Error([401, 403, 429].includes(response.status) ? '网页读取服务需要有效密钥或额度，请在 API 配置中设置 Jina Reader Key' : `网页读取失败（HTTP ${response.status}）`)
    if (!response.body) throw new Error('网页未返回内容')
    const reader = response.body.getReader(), decoder = new TextDecoder()
    let text = '', truncated = false
    try {
      while (true) {
        const { done, value: bytes } = await reader.read()
        if (done) { text += decoder.decode(); break }
        text += decoder.decode(bytes, { stream: true })
        if (text.length > 20000) { text = text.slice(0, 20000); truncated = true; await reader.cancel(); break }
      }
    } finally { reader.releaseLock() }
    if (!text.trim()) throw new Error('网页没有可读取的正文')
    return { url, text, truncated }
  } catch (error) {
    if (signal.aborted) throw error
    return { url, text: '', error: error instanceof Error ? error.message.slice(0, 500) : '网页读取失败' }
  }
}
