import { calendarEntriesSchema, calendarIcs } from '../src/integrations/calendarIcs'

interface Storage {
  get<T>(key: string): Promise<T | undefined>
  put(key: string, value: unknown): Promise<void>
  delete(keys: string[]): Promise<unknown>
  transaction<T>(job: (storage: Storage) => Promise<T>): Promise<T>
}
export interface CalendarEnv {
  APP_URL: string
  CALENDAR_FEEDS?: { getByName(name: string): { fetch(request: Request): Promise<Response> } }
}
export async function calendarToken(secret: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))), b => b.toString(16).padStart(2, '0')).join('') }
const response = (data: unknown, status: number, headers: Headers) => new Response(JSON.stringify(data), { status, headers })

export async function calendarRoute(request: Request, env: CalendarEnv): Promise<Response> {
  const url = new URL(request.url), origin = new URL(env.APP_URL).origin
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' })
  if (request.headers.get('Origin') === origin) { headers.set('Access-Control-Allow-Origin', origin); headers.set('Vary', 'Origin') }
  if (url.pathname === '/calendar/status' && request.method === 'GET') return response({ enabled: !!env.CALENDAR_FEEDS }, 200, headers)
  const match = /^\/calendar\/([a-f0-9]{64})\.ics$/.exec(url.pathname)
  if (!match) return response({ error: '日历地址无效' }, 404, headers)
  if (request.method === 'OPTIONS') {
    if (request.headers.get('Origin') !== origin) return response({ error: '来源无效' }, 403, headers)
    headers.set('Access-Control-Allow-Methods', 'GET, PUT, DELETE'); headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return new Response(null, { status: 204, headers })
  }
  if (!env.CALENDAR_FEEDS) return response({ error: '网站尚未部署日历订阅存储，可先下载日历文件' }, 503, headers)
  if (!['GET', 'HEAD', 'PUT', 'DELETE'].includes(request.method)) return response({ error: '请求方法无效' }, 405, headers)
  if (request.method === 'PUT' || request.method === 'DELETE') {
    const secret = request.headers.get('Authorization')?.replace(/^Bearer /, '') || ''
    if (request.headers.get('Origin') !== origin || !/^[a-f0-9]{64}$/.test(secret) || await calendarToken(secret) !== match[1]) return response({ error: '无权修改日历' }, 403, headers)
  }
  try {
    let payload: string | undefined
    if (request.method === 'PUT') {
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw Error('请求格式无效')
      const reader = request.body?.getReader(); if (!reader) throw Error('内容为空')
      const chunks: Uint8Array[] = []; let bytes = 0
      while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 2 * 1024 * 1024) { await reader.cancel(); throw Error('日历过大，请减少日程数量') }; chunks.push(part.value) }
      const all = new Uint8Array(bytes); let offset = 0; for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length }
      payload = calendarIcs(calendarEntriesSchema.parse(JSON.parse(new TextDecoder().decode(all))))
      if (new TextEncoder().encode(payload).length > 2 * 1024 * 1024) throw Error('日历过大')
    }
    const result = await env.CALENDAR_FEEDS.getByName(match[1]).fetch(new Request('https://calendar.internal/', { method: request.method, ...(payload ? { body: payload } : {}) }))
    result.headers.forEach((value, key) => headers.set(key, value))
    return new Response(request.method === 'HEAD' ? null : result.body, { status: result.status, headers })
  } catch (error) { return response({ error: error instanceof Error ? error.message : '同步失败' }, 400, headers) }
}

/** Each feed is isolated and writes replace its complete contents atomically. */
export class CalendarFeedObject {
  constructor(private state: { storage: Storage }) {}
  async fetch(request: Request): Promise<Response> {
    const storage = this.state.storage
    if (request.method === 'PUT' || request.method === 'DELETE') {
      let content = request.method === 'PUT' ? await request.text() : ''
      const digest = await calendarToken(content)
      await storage.transaction(async tx => {
        if (await tx.get<string>('digest') === digest) return
        const sequence = (await tx.get<number>('sequence') || 0) + 1
        const modified = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
        content = content.replace(/^SEQUENCE:[^\r\n]*/gm, `SEQUENCE:${sequence}`).replace(/^(DTSTAMP|LAST-MODIFIED):[^\r\n]*/gm, `$1:${modified}`)
        const old = await tx.get<number>('count') || 0
        for (let start = 0; start < old; start += 128) {
          await tx.delete(Array.from({ length: Math.min(128, old - start) }, (_, i) => `part:${start + i}`))
        }
        // Keep individual values below 128 KiB even for multibyte text.
        const chunks = content.match(/[\s\S]{1,24000}/g) || []
        for (let i = 0; i < chunks.length; i++) await tx.put(`part:${i}`, chunks[i])
        await tx.put('count', chunks.length)
        await tx.put('digest', digest); await tx.put('sequence', sequence)
      })
      return new Response(JSON.stringify({ synced: true }), { headers: { 'Content-Type': 'application/json' } })
    }
    const content = await storage.transaction(async tx => {
      const count = await tx.get<number>('count') || 0, parts: string[] = []
      for (let i = 0; i < count; i++) parts.push(await tx.get<string>(`part:${i}`) || '')
      return parts.join('') || calendarIcs([])
    })
    return new Response(content, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="TimeScheduler.ics"', 'Cache-Control': 'no-cache, max-age=0', ETag: `"${await calendarToken(content)}"` } })
  }
}
