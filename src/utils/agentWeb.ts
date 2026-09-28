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
/** A URL is task data by default. Only explicit requests to read its content opt into fetching. */
export function requestedWebLinks(message: string): string[] {
  const urls: string[] = []
  const text = message.replace(/```[\s\S]*?```/g, '').replace(/^\s*>.*$/gm, '').replace(/`[^`]*`|“[^”]*”|「[^」]*」/g, '')
    .replace(/https?:\/\/[^\s<>"`\u3000-\u303f\uff00-\uffef]+/g, value => {
      const url = messageLinks(value)[0]
      urls.push(url)
      return `⟪URL${urls.length - 1}⟫`
    })
  const verb = '(?:读取|阅读|浏览|访问|打开|总结|概括|抓取|分析|查看|读|看)'
  const target = '(?:网页|页面|网站|链接(?:的?(?:内容|正文))?|网址|⟪URL\\d+⟫)'
  // Negated reading is never implicit authorization, even if a positive keyword also appears.
  if (new RegExp(`(?:不要|不用|无需|不必|不需要|请勿|别|禁止)\\s*(?:再|自动|去)?\\s*${verb}`).test(text) || /\b(?:do not|don't|never|without)\s+(?:read(?:ing)?|brows(?:e|ing)|fetch(?:ing)?|open(?:ing)?|visit(?:ing)?)/i.test(text)) return []
  const explicit = new RegExp(`${verb}(?:一下|下)?\\s*(?:这些|这个|这份|这|以下|下面|该|此|一下|下列)?(?:的)?\\s*${target}|${target}(?:的)?(?:内容|正文)?[，,\\s]*(?:请|帮我|麻烦)?\\s*(?:读取|阅读|总结|概括|分析)(?:一下|下)?\\s*$`)
  const english = /\b(?:read|browse|fetch|open|visit|summari[sz]e|analy[sz]e)\s+(?:(?:the|this|these|following)\s+)?(?:web\s*pages?|pages?|websites?|links?|urls?|⟪URL\d+⟫)/i
  const result = new Set<string>()
  let readingList = false
  for (const segment of text.split(/[。！？!?；;\n]+/)) {
    if (!segment.trim()) continue
    const references = [...segment.matchAll(/⟪URL(\d+)⟫/g)].map(match => urls[Number(match[1])])
    const bareLinks = references.length > 0 && !segment.replace(/⟪URL\d+⟫|\[[^\]]*\]|[\s\d.、,，:：()（）\-*]+/g, '').trim()
    if (explicit.test(segment) || english.test(segment)) readingList = true
    else if (!bareLinks) readingList = false
    if (readingList) references.forEach(url => result.add(url))
  }
  return [...result]
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
