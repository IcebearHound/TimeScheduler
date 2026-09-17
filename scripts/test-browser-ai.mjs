import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from 'playwright'

const output = resolve('test-results/browser-ai'); await mkdir(output, { recursive: true })
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname.replace(/^\/TimeScheduler\//, '') || 'index.html'
    const target = resolve('dist', path), root = resolve('dist')
    if (!target.startsWith(root + '/') && !target.startsWith(root + '\\')) throw new Error('Invalid path')
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(target)] || 'application/octet-stream')
    res.end(await readFile(target))
  } catch { res.writeHead(404); res.end() }
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const browser = await chromium.launch({ headless: true })


let page
let responseMode = 'ok', calls = 0
try {
  for (const width of [390, 320, 1440]) {
    page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 500 })
    const errors = [], localRequests = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', req => { if (req.url().includes(':4318')) localRequests.push(req.url()) })
    await page.addInitScript(() => { localStorage.setItem('hasSeenWelcomeGuide', 'true'); localStorage.setItem('notificationPromptSeen', 'true') })
    await page.route(/^https:\/\/(api\.deepseek\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com)\//, async route => {
      const req = route.request(); calls++
      assert.ok(!req.url().includes('synthetic-api-key'))
      const provider = req.url().includes('anthropic') ? 'anthropic' : req.url().includes('googleapis') ? 'gemini' : 'openai'
      const header = provider === 'anthropic' ? 'x-api-key' : provider === 'gemini' ? 'x-goog-api-key' : 'authorization'
      assert.ok(req.headers()[header].includes('synthetic-api-key'))
      if (provider === 'anthropic') assert.equal(req.headers()['anthropic-dangerous-direct-browser-access'], 'true')
      const input = req.postDataJSON()
      const content = provider === 'gemini' ? input.contents[0].parts[0].text : input.messages[provider === 'openai' ? 1 : 0].content
      const { archive } = JSON.parse(content)
      if (responseMode === '401') return route.fulfill({ status: 401, body: '{}' })
      if (responseMode === 'network') return route.abort('failed')
      if (responseMode === 'slow') { await new Promise(r => setTimeout(r, 1500)) }
      const actions = responseMode === 'invalid' ? [{ op: 'delete_event', id: 'does-not-exist' }] : [{ op: 'create_event', event: { name: '手机 AI 作业', startTime: '2026-09-18T10:00:00+08:00', endTime: '2026-09-18T11:00:00+08:00', chainId: '', typeId: archive.eventTypes[0].id, reminders: [], properties: { taskKind: '作业' }, isHighlight: false, priority: 0 } }]
      const raw = JSON.stringify({ actions })
      const payload = provider === 'anthropic' ? { content: [{ type: 'text', text: raw }] } : provider === 'gemini' ? { candidates: [{ content: { parts: [{ text: raw }] } }] } : { choices: [{ message: { content: raw } }] }
      await route.fulfill({ json: payload })
    })
    const openAI = async () => {
      if (width < 500) { await page.getByRole('button', { name: '工具', exact: true }).click(); await page.getByRole('button', { name: 'AI / MCP', exact: true }).click() }
      else await page.getByRole('button', { name: 'AI / MCP', exact: true }).click()
      await page.getByLabel('API Key', { exact: true }).waitFor()
    }
    const count = () => page.evaluate(() => JSON.parse(localStorage.getItem('eventStore'))?.events.length || 0)
    await page.goto(`http://127.0.0.1:${server.address().port}/TimeScheduler/`)
    await openAI()
    assert.ok(!(await page.locator('body').innerText()).includes('npm'))
    for (const preset of ['deepseek', 'anthropic', 'gemini']) {
      await page.getByLabel('AI 服务商').selectOption(preset)
      await page.getByLabel('API Key', { exact: true }).fill('synthetic-api-key')
      await page.getByLabel('用自然语言安排日程').fill('添加手机 AI 作业')
      const before = await count()
      await page.getByRole('button', { name: '生成操作预览', exact: true }).click()
      await page.getByText('即将应用 1 项操作', { exact: true }).waitFor()
      assert.equal(await count(), before, 'Generation must not mutate archive')
      await page.getByRole('button', { name: '确认应用到存档', exact: true }).click()
      await page.getByText('AI 操作已写入当前存档，可整体撤销', { exact: true }).waitFor()
      assert.equal(await count(), before + 1)
    }
    assert.equal(await page.getByLabel('API Key', { exact: true }).inputValue(), '')
    const vault = await page.evaluate(() => new Promise((resolve, reject) => { const r = indexedDB.open('time-scheduler-private'); r.onsuccess = () => { const db = r.result; const tx = db.transaction('vault'); const a = tx.objectStore('vault').get('ai-api-config'), b = tx.objectStore('vault').get('device-key'); tx.oncomplete = () => { resolve({ encrypted: a.result.data instanceof ArrayBuffer, extractable: b.result.extractable, raw: JSON.stringify(a.result) }); db.close() }; tx.onerror = reject }; r.onerror = reject }))
    assert.equal(vault.encrypted, true); assert.equal(vault.extractable, false); assert.ok(!vault.raw.includes('synthetic-api-key'))
    assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('synthetic-api-key'))
    await page.reload(); await openAI()
    await page.getByText('此设备已保存密钥，可直接生成预览。', { exact: true }).waitFor()
    await page.getByLabel('用自然语言安排日程').fill('再添加一项任务')
    for (const mode of ['401', 'network', 'invalid']) {
      responseMode = mode
      const before = await count()
      await page.getByRole('button', { name: '生成操作预览', exact: true }).click()
      await page.getByRole('button', { name: '生成操作预览', exact: true }).waitFor({ state: 'visible' })
      await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some(el => !el.textContent.includes('正在')))
      assert.equal(await page.getByRole('button', { name: '确认应用到存档', exact: true }).count(), 0)
      assert.equal(await count(), before)
    }
    responseMode = 'slow'
    await page.getByRole('button', { name: '生成操作预览', exact: true }).click()
    await page.getByRole('button', { name: '取消请求', exact: true }).click()
    await page.getByText('请求已取消或超时，请重试', { exact: true }).waitFor()
    responseMode = 'ok'
    await page.getByRole('button', { name: '生成操作预览', exact: true }).click()
    await page.getByText('即将应用 1 项操作', { exact: true }).waitFor()
    await page.getByRole('button', { name: '取消预览', exact: true }).click()
    await page.getByRole('button', { name: '清除已保存密钥', exact: true }).click()
    await page.getByText('已清除此设备的 AI 密钥', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: '生成操作预览', exact: true }).isDisabled(), true)
    await page.screenshot({ path: resolve(output, `ai-${width}.png`) })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.deepEqual(localRequests, []); assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('PASS: key-only mobile/desktop AI presets, three protocols, no local service, encrypted key persistence, preview-before-apply, reload, clear, cancellation, bad keys/network/invalid actions')
} catch (error) { if (page && !page.isClosed()) { console.error((await page.locator('body').innerText()).slice(-2500)); await page.screenshot({ path: resolve(output, 'failure.png') }) }; throw error }
finally { await browser.close(); await new Promise(r => server.close(r)) }
