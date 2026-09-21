import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from 'playwright'
import { calendarRoute, CalendarFeedObject } from '../worker/calendar.ts'
const output = resolve('test-results/calendar-sync'); await mkdir(output, { recursive: true })
let origin, updates = 0
const feeds = new Map()
const env = () => ({ APP_URL: origin + '/TimeScheduler/', CALENDAR_FEEDS: { getByName: name => { if (!feeds.has(name)) { const data = new Map(); const storage = { get: async k => data.get(k), put: async (k,v) => data.set(k,v), delete: async keys => keys.forEach(k => data.delete(k)), transaction: async fn => fn(storage) }; feeds.set(name, new CalendarFeedObject({ storage })) }; return feeds.get(name) } } })
const server = createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/calendar/')) {
      const parts = []; for await (const part of req) parts.push(part)
      const reply = await calendarRoute(new Request(origin + req.url, { method: req.method, headers: req.headers, ...(['PUT','POST'].includes(req.method) ? { body: Buffer.concat(parts) } : {}) }), env())
      if (req.method === 'PUT' && reply.ok) updates++
      res.writeHead(reply.status, Object.fromEntries(reply.headers)); res.end(Buffer.from(await reply.arrayBuffer())); return
    }
    const path = new URL(req.url, 'http://localhost').pathname.replace(/^\/TimeScheduler\//, '') || 'index.html'
    const target = resolve('dist', path), root = resolve('dist')
    if (!target.startsWith(root + '/') && !target.startsWith(root + '\\')) throw new Error('Invalid path')
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(target)] || 'application/octet-stream')
    res.end(await readFile(target))
  } catch { res.writeHead(404); res.end() }
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
origin = 'http://127.0.0.1:' + server.address().port
const browser = await chromium.launch({ headless: true })
let page
try {
  for (const width of [1440, 390, 320]) {
    page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 500 })
    page.setDefaultTimeout(10000)
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    await page.addInitScript(() => {
      localStorage.setItem('hasSeenWelcomeGuide', 'true'); localStorage.setItem('notificationPromptSeen', 'true')
      if (localStorage.getItem('eventStore')) return
      const stamp = new Date().toISOString(), start = new Date(); start.setHours(20,0,0,0)
      const event = { id: 'caltest', name: '订阅测试作业', startTime: start.toISOString(), endTime: new Date(+start + 3600000).toISOString(), createdAt: stamp, updatedAt: stamp, typeId: 'course', chainId: '', reminders: [], properties: { taskKind: '作业', notes: 'not-for-calendar' }, isHighlight: false, priority: 1 }
      localStorage.setItem('eventStore', JSON.stringify({ events: [[event.id,event]], eventChains: [], eventTypes: [['course', { id: 'course', name: '课程', emoji: '📚', category: 'course', color: '#333333' }]], semesterStartDate: stamp }))
    })
    await page.goto(origin + '/TimeScheduler/')
    const settings = async () => { await page.getByRole('button', { name: '用户', exact: true }).click(); await page.getByRole('button', { name: '设置', exact: true }).click() }
    const closeSettings = async () => { await page.getByRole('button', { name: '关闭设置', exact: true }).click() }
    await settings()
    await page.getByLabel('日历服务地址', { exact: true }).fill(origin)
    await page.getByRole('button', { name: '开启自动同步并生成订阅', exact: true }).click()
    await page.getByText('订阅已生成。首次请在系统日历中添加订阅并开启提醒', { exact: true }).waitFor()
    const url = await page.getByLabel('日历订阅链接').inputValue()
    assert.match(url, /\/calendar\/[a-f0-9]{64}\.ics$/)
    assert.equal(await page.getByRole('link', { name: '添加到系统日历', exact: true }).getAttribute('href'), url.replace('http:', 'webcal:'))
    let feed = await (await fetch(url)).text()
    assert.equal(feed.match(/BEGIN:VEVENT/g).length, 1)
    assert.ok(feed.includes('BEGIN:VALARM')); assert.ok(!feed.includes('not-for-calendar'))
    await page.screenshot({ path: resolve(output, `settings-${width}.png`) })
    const previous = updates
    await page.reload()
    await page.waitForTimeout(500)
    for (let n = 0; n < 40 && updates <= previous; n++) await page.waitForTimeout(100)
    assert.ok(updates > previous, 'Opening the app republishes the existing calendar')
    await settings(); assert.equal(await page.getByLabel('日历订阅链接').inputValue(), url)
    const prevFocus = updates
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    for (let n = 0; n < 40 && updates <= prevFocus; n++) await page.waitForTimeout(100)
    assert.ok(updates > prevFocus, 'Returning to foreground updates the subscription')
    await page.getByLabel('日历默认提醒').selectOption('10')
    await page.getByRole('button', { name: '保存提醒设置并同步', exact: true }).click()
    await page.getByText('订阅已生成。首次请在系统日历中添加订阅并开启提醒', { exact: true }).waitFor()
    feed = await (await fetch(url)).text(); assert.equal(feed.match(/BEGIN:VEVENT/g).length, 1)
    assert.ok(feed.includes('UID:caltest@timescheduler'))
    await closeSettings()
    if (width < 500) await page.getByRole('button', { name: '待办', exact: true }).click()
    else await page.locator('[data-right-sidebar]').getByRole('button', { name: 'TODO', exact: true }).click()
    const beforeEdit = updates
    await page.locator('[data-todo-event="caltest"]').getByRole('checkbox').click()
    for (let n = 0; n < 50 && updates <= beforeEdit; n++) await page.waitForTimeout(100)
    assert.ok(updates > beforeEdit)
    assert.ok(!(await (await fetch(url)).text()).includes('BEGIN:VALARM'))
    if (width < 500) await page.getByRole('button', { name: '收起详情面板', exact: true }).click()
    await settings()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '下载日历文件', exact: true }).click()
    assert.equal((await downloadPromise).suggestedFilename(), '时间规划器.ics')
    await page.getByRole('button', { name: '停用并清空订阅', exact: true }).click()
    await page.getByRole('button', { name: '开启自动同步并生成订阅', exact: true }).waitFor()
    assert.ok(!(await (await fetch(url)).text()).includes('BEGIN:VEVENT'))
    const stopped = updates
    await page.reload(); await page.waitForTimeout(1700)
    assert.equal(updates, stopped, 'Disabled subscriptions stay disabled on reopen')
    assert.deepEqual(errors, [])
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.close()
    console.log(`PASS ${width}px: subscribe, reopen/focus sync, stable UID, reminder edits, completion, export and revocation`)
  }
} catch (error) { if (page && !page.isClosed()) { await page.screenshot({ path: resolve(output, 'failure.png') }); console.error((await page.locator('body').innerText()).slice(-2000)) }; throw error }
finally { await browser.close(); await new Promise(r => server.close(r)) }
