import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { build } from 'vite'
import { chromium } from 'playwright'
import worker from '../worker/index.ts'

const root = resolve('test-results/ai-relay/dist'); await mkdir(root, { recursive: true })
const originalFetch = globalThis.fetch
const env = { APP_URL: '', AUTH_STATE_SECRET: '' }
const upstream = [], browserRequests = [], errors = []
globalThis.fetch = async (url, init) => {
  upstream.push(url)
  assert.ok(url.startsWith('https://api.deepseek.com/v1/'))
  assert.equal(init.headers.Authorization, 'Bearer synthetic-relay-key')
  assert.equal(init.redirect, 'error')
  const { archive } = JSON.parse(JSON.parse(init.body).messages[1].content)
  const action = { op: 'create_event', event: { name: '转发 AI 任务', startTime: '2026-09-18T10:00:00+08:00', endTime: '2026-09-18T11:00:00+08:00', chainId: '', typeId: archive.eventTypes[0].id, reminders: [], properties: {}, isHighlight: false, priority: 0 } }
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ actions: [action] }) } }] }))
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, env.APP_URL)
    if (url.pathname.startsWith('/TimeScheduler/')) {
      const target = resolve(root, url.pathname.slice('/TimeScheduler/'.length) || 'index.html')
      assert.ok(target.startsWith(root + '/') || target.startsWith(root + '\\'))
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(target)] || 'application/octet-stream')
      res.end(await readFile(target))
    } else {
      const chunks = []; for await (const chunk of req) chunks.push(chunk)
      const response = await worker.fetch(new Request(url, { method: req.method, headers: req.headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) }), env)
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()))
    }
  } catch (error) { errors.push(error.message); res.writeHead(500); res.end('test error') }
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
env.APP_URL = `http://127.0.0.1:${server.address().port}/TimeScheduler/`
let browser
try {
  process.env.VITE_AI_SERVICE_URL = `http://127.0.0.1:${server.address().port}`
  await build({ logLevel: 'error', build: { outDir: root } })
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => browserRequests.push(request.url()))
  await page.addInitScript(() => { localStorage.setItem('hasSeenWelcomeGuide', 'true'); localStorage.setItem('notificationPromptSeen', 'true') })
  await page.goto(env.APP_URL)
  await page.getByRole('button', { name: '工具', exact: true }).click(); await page.getByRole('button', { name: 'AI / MCP', exact: true }).click()
  await page.getByLabel('API Key', { exact: true }).fill('synthetic-relay-key')
  await page.getByLabel('用自然语言安排日程').fill('添加转发任务')
  await page.getByRole('button', { name: '生成操作预览', exact: true }).click()
  await page.getByText('即将应用 1 项操作', { exact: true }).waitFor()
  assert.equal(upstream.length, 1)
  assert.ok(browserRequests.some(url => url.endsWith('/ai/propose')))
  assert.ok(!browserRequests.some(url => url.startsWith('https://api.deepseek.com') || url.includes(':4318')))
  await page.getByRole('button', { name: '确认应用到存档', exact: true }).click()
  await page.getByText('AI 操作已写入当前存档，可整体撤销', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('eventStore')).events[0][1].name), '转发 AI 任务')
  assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('synthetic-relay-key'))
  assert.deepEqual(errors, [])
  console.log('PASS: mobile key-only AI through deployed-style Worker, fixed upstream, no OAuth/local daemon, proposal and persisted apply')
} finally { globalThis.fetch = originalFetch; if (browser) await browser.close(); await new Promise(r => server.close(r)) }
