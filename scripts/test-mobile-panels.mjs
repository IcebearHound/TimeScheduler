import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from 'playwright'

const output = resolve('test-results/mobile-panels'); await mkdir(output, { recursive: true })
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
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
const errors = []; page.on('pageerror', error => errors.push(error.message))
const url = `http://127.0.0.1:${server.address().port}/TimeScheduler/`
const visible = async (locator) => { await locator.waitFor({ state: 'visible' }); assert.ok(await locator.isVisible()) }
const settings = async () => { await page.getByRole('button', { name: '用户', exact: true }).click(); await page.getByRole('button', { name: '设置', exact: true }).click(); await visible(page.getByRole('dialog', { name: '设置', exact: true })) }
const cdp = await page.context().newCDPSession(page)
const swipe = async (locator, dy, dx = 0, cancel = false) => {
  const box = await locator.boundingBox(), x = box.x + 40, y = box.y + 12
  const point = (x, y) => [{ x, y, radiusX: 2, radiusY: 2, force: 1, id: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(x, y) })
  for (let i = 1; i <= 8; i++) { await new Promise(r => setTimeout(r, 25)); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x + dx * i / 8, y + dy * i / 8) }) }
  await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] })
  await new Promise(r => setTimeout(r, 350)) // Separate gestures; Chromium suppresses immediate taps after a fling.
}
const check = async sheet => {
  await visible(sheet)
  // visualViewport resize and React's layout update arrive after setViewportSize resolves.
  await page.waitForFunction(el => { const box = el.getBoundingClientRect(); return box.height <= innerHeight * .79 && box.x >= 15 && box.right <= innerWidth - 15 }, await sheet.elementHandle(), { timeout: 3000 })
  const box = await sheet.boundingBox(), view = page.viewportSize()
  assert.ok(box.height <= view.height * .79 && box.x >= 15 && box.x + box.width <= view.width - 15, 'Panel should leave visible margins')
  const button = sheet.locator('.mobile-sheet-close'), close = await button.boundingBox()
  assert.ok(close.height >= 44 && close.y >= 0 && close.y + close.height < view.height)
  assert.equal(await button.evaluate(el => { const b = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)) }), true, 'Close button must receive taps')
}
const outside = async sheet => { const box = await sheet.boundingBox(); await page.touchscreen.tap(5, box.y + 25); await sheet.waitFor({ state: 'hidden' }) }
const closeTap = async sheet => { await sheet.locator('.mobile-sheet-close').tap(); await sheet.waitFor({ state: 'hidden' }) }
// Opening is test setup; dismissal itself always uses touch, including after content scrolling.
const openNew = async () => { await page.getByRole('button', { name: '新建事件', exact: true }).click(); const sheet = page.locator('[data-mobile-sheet="新建事件"]'); await check(sheet); return sheet }
try {
  await page.addInitScript(() => { window.__touchLog = []; for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'click']) document.addEventListener(type, e => { window.__touchLog.push([type, e.pointerId, e.clientX, e.clientY, e.target.closest?.('button')?.getAttribute('aria-label') || e.target.tagName]); window.__touchLog = window.__touchLog.slice(-30) }, true); localStorage.setItem('hasSeenWelcomeGuide', 'true'); localStorage.setItem('notificationPromptSeen', 'true') })
  await page.goto(url)
  await page.evaluate(() => {
    const start = new Date(); start.setHours(10, 0, 0, 0)
    const end = new Date(start); end.setHours(11)
    const event = { id: 'close-test', name: '面板关闭测试', startTime: start.toISOString(), endTime: end.toISOString(), chainId: '', typeId: 'course', reminders: [], properties: { notes: '测试备注' }, priority: 0, isHighlight: false }
    localStorage.setItem('eventStore', JSON.stringify({ events: [[event.id, event]], eventChains: [], eventTypes: [['course', { id: 'course', name: '课程', emoji: '📚', category: 'course', color: '#2563eb' }]], semesterStartDate: start.toISOString() }))
  })
  await page.reload()
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 740 })
    let sheet = await openNew()
    await sheet.getByPlaceholder('事件名称 *').fill('未保存草稿')
    await sheet.locator('.mobile-sheet-body').evaluate(el => { el.scrollTop = el.scrollHeight })
    await check(sheet)
    await page.screenshot({ path: resolve(output, `new-event-${width}.png`) })
    await closeTap(sheet)
    sheet = await openNew(); await outside(sheet)
    sheet = await openNew()
    await swipe(sheet.locator('[data-sheet-drag]'), 25); await check(sheet)
    await swipe(sheet.locator('[data-sheet-drag]'), 20, 90); await check(sheet)
    await swipe(sheet.locator('[data-sheet-drag]'), 100, 0, true); await check(sheet)
    await swipe(sheet.locator('[data-sheet-drag]'), 100); await sheet.waitFor({ state: 'hidden' })
    sheet = await openNew()
    // A content scroll must never act as a dismissal gesture.
    await swipe(sheet.locator('.mobile-sheet-body'), -100); await check(sheet)
    await page.setViewportSize({ width, height: 390 }); await check(sheet)
    await closeTap(sheet); await page.setViewportSize({ width, height: 740 })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  const event = page.locator('#event-close-test'); await event.scrollIntoViewIfNeeded(); await event.tap()
  let details = page.locator('[data-mobile-sheet="事件详情与待办"]'); await check(details)
  await details.locator('input[type="text"]').first().fill('关闭前的修改已保存')
  await closeTap(details)
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('eventStore')).events[0][1].name), '关闭前的修改已保存')
  await event.tap(); details = page.locator('[data-mobile-sheet="事件详情与待办"]'); await outside(details)
  await event.tap(); details = page.locator('[data-mobile-sheet="事件详情与待办"]'); await check(details)
  await page.screenshot({ path: resolve(output, 'details.png') })
  await swipe(details.locator('[data-sheet-drag]'), 105); await details.waitFor({ state: 'hidden' })
  // Closing an inner chain editor leaves its parent form and entered text intact.
  const editor = await openNew(); await editor.getByPlaceholder('事件名称 *').fill('保留父面板草稿')
  await editor.getByTitle('新建事件链', { exact: true }).tap()
  const chain = page.locator('[data-mobile-sheet="创建事件链"]'); await check(chain)
  await swipe(chain.locator('[data-sheet-drag]'), 100); await chain.waitFor({ state: 'hidden' })
  assert.equal(await editor.getByPlaceholder('事件名称 *').inputValue(), '保留父面板草稿')
  await closeTap(editor)
  for (const target of ['课程作业 / 实验', '待办', '工具']) {
    await page.getByRole('button', { name: target, exact: true }).tap()
    const sheet = page.locator('[data-mobile-sheet]').last(); await check(sheet); await outside(sheet)
  }
  await page.getByRole('button', { name: '工具', exact: true }).tap()
  await page.getByRole('button', { name: '导入课表', exact: true }).tap()
  let sheet = page.locator('[data-mobile-sheet="导入课程表"]'); await check(sheet); await closeTap(sheet)
  await settings(); sheet = page.locator('[data-mobile-sheet="设置"]'); await check(sheet)
  await sheet.getByRole('button', { name: '事件类型管理' }).tap()
  sheet = page.locator('[data-mobile-sheet="事件类型"]'); await check(sheet); await outside(sheet)
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('eventStore')).events.length), 1, 'Closing drafts must not create events')
  await settings(); await page.getByRole('button', { name: '桌面版', exact: true }).click()
  await page.getByRole('button', { name: '关闭设置', exact: true }).click()
  assert.equal(await page.locator('[data-mobile-sheet]').count(), 0)
  assert.deepEqual(errors, [])
  console.log('PASS: touch close buttons and margins, downward drag, short/horizontal/cancelled gestures stay open, content scrolling and small viewport, details save on close, nested chain closes without losing parent draft, courses/todo/tools/import/types/settings, desktop compatibility')
} catch (error) {
  console.error(await page.evaluate(() => window.__touchLog)); await page.screenshot({ path: resolve(output, 'failure.png') }); console.error((await page.locator('body').innerText()).slice(-2500)); throw error
} finally { await browser.close(); await new Promise(r => server.close(r)) }
