import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile, readdir, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import { gzipSync } from 'node:zlib'

const output = resolve('test-results/quality')
await mkdir(output, { recursive: true })
const root = resolve('dist')
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/TimeScheduler\//, '') || 'index.html'
    const target = resolve(root, pathname)
    if (!target.startsWith(root + sep)) throw Error('Invalid path')
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' })[extname(target)] || 'application/octet-stream')
    res.end(await readFile(target))
  } catch { res.writeHead(404); res.end() }
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const url = `http://127.0.0.1:${server.address().port}/TimeScheduler/`
const browser = await chromium.launch({ headless: true })
const checks = [], violations = [], errors = []
const metrics = {}
let active
let validBackup
const check = async (name, fn) => { await fn(); checks.push(name); console.log(`PASS: ${name}`) }
const pageFor = async (width = 1440, scheme = 'light') => {
  const context = await browser.newContext({ viewport: { width, height: width < 1100 ? 844 : 1000 }, colorScheme: scheme, reducedMotion: 'reduce', timezoneId: 'Asia/Hong_Kong', hasTouch: width < 1100 })
  const page = await context.newPage()
  active = page
  page.on('pageerror', error => errors.push(error.message))
  await page.clock.setFixedTime(new Date('2026-10-26T04:00:00Z'))
  return page
}
const ready = async page => { await page.goto(url); await page.getByRole('heading', { name: '日程工作台', exact: true }).waitFor(); await page.locator('[data-calendar-scroll]').waitFor() }
const audit = async (page, name) => {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  await writeFile(resolve(output, `${name}-accessibility.json`), JSON.stringify(result, null, 2))
  if (result.violations.length) violations.push({ name, violations: result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ html: n.html, reason: n.failureSummary })) })) })
}
const data = page => page.evaluate(() => JSON.parse(localStorage.getItem('eventStore')))
const settings = async page => { await page.getByRole('button', { name: '用户', exact: true }).click(); await page.getByRole('button', { name: '设置', exact: true }).click(); await page.getByRole('dialog', { name: '设置', exact: true }).waitFor() }
try {
  await check('initial assets stay within budget and advanced tools load on demand', async () => {
    const assets = await readdir(resolve(root, 'assets'))
    const entry = assets.find(name => /^index-.*\.js$/.test(name))
    assert.ok((await stat(resolve(root, 'assets', entry))).size < 500 * 1024, 'Entry script must stay under 500 KiB')
    const page = await pageFor(), requests = []
    page.on('request', request => requests.push(request.url()))
    await ready(page)
    await page.waitForLoadState('networkidle')
    const initialScripts = [...new Set(requests.filter(url => /\.js$/.test(url)))].map(url => resolve(root, new URL(url).pathname.replace('/TimeScheduler/', '')))
    const scripts = await Promise.all(initialScripts.map(path => readFile(path)))
    metrics.initialJavaScriptBytes = scripts.reduce((sum, bytes) => sum + bytes.length, 0)
    metrics.initialJavaScriptGzipBytes = scripts.reduce((sum, bytes) => sum + gzipSync(bytes).length, 0)
    assert.ok(metrics.initialJavaScriptBytes < 600 * 1024, 'All initial JS, including vendor and view chunks, must stay under 600 KiB')
    assert.ok(metrics.initialJavaScriptGzipBytes < 200 * 1024, 'Initial JS gzip budget is 200 KiB')
    assert.ok(!requests.some(url => /xlsx-|AgentWindow-|AssignmentPanel-|CourseImportModal-/.test(url)), 'Advanced features must not download on first use')
    assert.equal(await page.getByRole('dialog').count(), 0)
    await page.context().close()
  })
  await check('responsive layouts and light/dark themes have no page overflow or startup dialogs', async () => {
    for (const [width, scheme] of [[320, 'light'], [390, 'light'], [768, 'light'], [1024, 'light'], [1440, 'light'], [390, 'dark'], [1440, 'dark']]) {
      const page = await pageFor(width, scheme)
      await ready(page)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px page overflow`)
      assert.equal(await page.getByRole('dialog').count(), 0)
      assert.equal(await page.locator('html').getAttribute('data-layout'), width < 1100 ? 'mobile' : 'desktop')
      await page.screenshot({ path: resolve(output, `home-${width}-${scheme}.png`) })
      if ([390, 1440].includes(width)) await audit(page, `home-${width}-${scheme}`)
      await page.context().close()
    }
  })
  const page = await pageFor()
  await ready(page)
  await check('create, reload, keyboard search, focus restoration and native text undo work', async () => {
    await page.getByRole('button', { name: '新建', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '新建事件', exact: true })
    await dialog.waitFor()
    assert.ok(await page.getByLabel('事件名称', { exact: true }).evaluate(el => el === document.activeElement))
    await page.getByLabel('事件名称', { exact: true }).fill('产品设计评审')
    await audit(page, 'event-form')
    await page.getByRole('button', { name: '创建事件', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    assert.equal((await data(page)).events.length, 1)
    await page.reload(); await page.locator('[data-calendar-scroll]').waitFor()
    assert.equal((await data(page)).events[0][1].name, '产品设计评审')
    await page.getByRole('button', { name: '搜索日程（Ctrl+K）', exact: true }).click()
    await page.getByLabel('搜索日程', { exact: true }).fill('产品设计评审')
    await page.getByLabel('搜索日程', { exact: true }).press('ArrowDown')
    assert.ok(await page.locator('[data-search-results] button').first().evaluate(el => el === document.activeElement))
    await page.keyboard.press('Enter')
    await page.getByRole('dialog', { name: '搜索', exact: true }).waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: '新建', exact: true }).click()
    await page.getByLabel('事件名称', { exact: true }).fill('文本草稿')
    const before = JSON.stringify(await data(page))
    await page.getByLabel('事件名称', { exact: true }).press('Control+z')
    assert.equal(JSON.stringify(await data(page)), before, 'Text undo must not undo the calendar')
    await page.getByRole('button', { name: '创建事件', exact: true }).focus()
    await page.keyboard.press('Tab')
    assert.ok(await dialog.evaluate(el => el.contains(document.activeElement)), 'Tab must stay inside the dialog')
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.ok(await page.getByRole('button', { name: '新建', exact: true }).evaluate(el => el === document.activeElement), 'Focus must return to New')
  })
  await check('month grid aligns weekdays, shows adjacent-month events and navigates from month ends', async () => {
    await page.getByRole('button', { name: '月', exact: true }).click()
    await page.locator('[data-month-grid]').waitFor()
    assert.equal(await page.locator('[data-month-date]').count(), 42)
    assert.equal(await page.locator('[data-month-date]').first().getAttribute('data-month-date'), '2026-09-28')
    await page.locator('.month-day-button').first().focus(); await page.keyboard.press('ArrowRight')
    assert.ok(await page.locator('.month-day-button').nth(1).evaluate(el => el === document.activeElement))
    await audit(page, 'month-calendar')
    await page.getByRole('button', { name: '上一月', exact: true }).click()
    assert.match(await page.locator('h2').first().innerText(), /9月/)
  })
  await check('drag uses actual column width and hour height, and cancellation cannot change data', async () => {
    await page.getByRole('button', { name: '搜索日程（Ctrl+K）', exact: true }).click()
    await page.getByLabel('搜索日程', { exact: true }).fill('产品设计评审')
    await page.getByLabel('搜索日程', { exact: true }).press('Enter')
    await page.getByRole('dialog', { name: '搜索', exact: true }).waitFor({ state: 'hidden' })
    const event = (await data(page)).events[0][1]
    const block = page.locator(`[id="event-${event.id}"]`)
    await block.scrollIntoViewIfNeeded()
    const handle = block.locator('.cursor-grab'), box = await handle.boundingBox()
    const geometry = await block.evaluate(el => { const column = el.closest('[data-day-column]'); return { width: column.getBoundingClientRect().width, hour: Number(column.dataset.slotHeight) } })
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + geometry.width, box.y + box.height / 2 + geometry.hour, { steps: 8 }); await page.mouse.up()
    const moved = (await data(page)).events[0][1]
    assert.equal(Date.parse(moved.startTime) - Date.parse(event.startTime), 25 * 3600000)
    assert.equal(Date.parse(moved.endTime) - Date.parse(moved.startTime), Date.parse(event.endTime) - Date.parse(event.startTime))
    await page.getByRole('button', { name: '撤销', exact: true }).click()
    assert.equal((await data(page)).events[0][1].startTime, event.startTime)
    await block.scrollIntoViewIfNeeded()
    const next = await handle.boundingBox()
    await page.mouse.move(next.x + 20, next.y + next.height / 2); await page.mouse.down(); await page.mouse.move(next.x + 20, next.y + next.height / 2 + 30)
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })))
    await page.mouse.up()
    assert.equal((await data(page)).events[0][1].startTime, event.startTime)
    await page.screenshot({ path: resolve(output, 'calendar-populated.png') })
    await audit(page, 'populated-calendar')
    await page.locator('[data-event-details] input[type="text"]').first().fill('产品设计评审（更新）')
    await page.getByRole('button', { name: '新建', exact: true }).click()
    await page.getByRole('dialog', { name: '新建事件', exact: true }).waitFor()
    assert.equal((await data(page)).events[0][1].name, '产品设计评审（更新）', 'Changing selection must flush the prior detail draft')
    await page.keyboard.press('Escape')
  })
  await check('backup export and nested restore confirmation preserve keyboard isolation', async () => {
    await settings(page)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出全部数据', exact: true }).click()
    const backup = JSON.parse(await readFile(await (await download).path(), 'utf8'))
    validBackup = backup
    assert.equal(backup.events.length, 1)
    assert.ok(!JSON.stringify(backup).includes('apiKey'))
    await page.getByLabel('选择完整备份').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
    await page.getByRole('alertdialog', { name: '恢复备份', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: '关闭设置', exact: true }).count(), 0, 'Parent settings must be inert while confirmation is open')
    await page.keyboard.press('Escape')
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' })
    await audit(page, 'settings')
    await page.getByRole('button', { name: '关闭设置', exact: true }).click()
    assert.ok(await page.getByRole('button', { name: '用户', exact: true }).evaluate(el => el === document.activeElement), 'Settings dismissal must restore a usable header control')
  })
  await check('storage quota errors stay visible until retry succeeds', async () => {
    await page.evaluate(() => { const original = Storage.prototype.setItem; window.__restoreStorage = () => { Storage.prototype.setItem = original }; Storage.prototype.setItem = function(key, value) { if (key === 'eventStore' || key === 'eventGroupStore') throw new DOMException('Full', 'QuotaExceededError'); return original.call(this, key, value) } })
    await page.getByRole('button', { name: '新建', exact: true }).click()
    await page.getByLabel('事件名称', { exact: true }).fill('空间不足时的日程')
    await page.getByRole('button', { name: '编辑事件时间', exact: true }).click()
    await page.getByLabel('开始时间', { exact: true }).fill('2026-10-26T15:00')
    await page.getByRole('button', { name: '创建事件', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: '最新修改尚未保存' }).waitFor()
    assert.equal((await data(page)).events.length, 1)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出备份', exact: true }).click()
    const snapshot = JSON.parse(await readFile(await (await download).path(), 'utf8'))
    assert.equal(snapshot.events.length, 2, 'Emergency export must include unsaved changes')
    await page.evaluate(() => window.__restoreStorage())
    await page.getByRole('button', { name: '重试保存', exact: true }).click()
    assert.equal((await data(page)).events.length, 2)
    assert.equal(await page.getByRole('alert').count(), 0)
  })
  await page.context().close()
  await check('corrupted local archives remain intact and can be exported for recovery', async () => {
    const page = await pageFor(390)
    await page.addInitScript(() => { if (!localStorage.getItem('quality-corruption-seeded')) { localStorage.setItem('eventStore', '{unreadable-original'); localStorage.setItem('quality-corruption-seeded', 'true') } })
    await ready(page)
    await page.getByRole('alert').filter({ hasText: '原始存档已保护' }).waitFor()
    assert.equal(await page.evaluate(() => localStorage.getItem('eventStore')), '{unreadable-original')
    await page.getByRole('button', { name: '处理存档', exact: true }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出原始数据', exact: true }).click()
    const backup = JSON.parse(await readFile(await (await download).path(), 'utf8'))
    assert.equal(backup.eventStore, '{unreadable-original')
    await page.getByLabel('选择完整备份').setInputFiles({ name: 'valid-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(validBackup)) })
    await page.getByRole('button', { name: '确定', exact: true }).click()
    assert.equal(await page.getByRole('alert').count(), 0, 'Validated recovery must clear archive protection')
    assert.equal((await data(page)).events.length, 1)
    await page.getByRole('button', { name: '关闭设置', exact: true }).click()
    await page.reload()
    await page.getByRole('heading', { name: '日程工作台', exact: true }).waitFor()
    assert.equal((await data(page)).events.length, 1)
    assert.equal(await page.getByRole('alert').count(), 0)
    await page.context().close()
  })
  assert.deepEqual(errors, [], 'No browser runtime errors')
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ checks, metrics, errors, accessibility: violations }, null, 2))
  assert.deepEqual(violations, [], 'Accessibility checks failed; see test-results/quality/report.json')
  console.log(`PASS: ${checks.length} quality scenarios; zero WCAG A/AA violations in audited views`)
} catch (error) {
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ checks, metrics, errors, accessibility: violations, error: String(error) }, null, 2))
  if (active && !active.isClosed()) await active.screenshot({ path: resolve(output, 'quality-failure.png') })
  throw error
} finally { await browser.close(); await new Promise(r => server.close(r)) }
