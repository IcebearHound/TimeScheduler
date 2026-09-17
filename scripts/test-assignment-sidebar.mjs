import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from 'playwright'

const output = resolve('test-results/assignment-sidebar'); await mkdir(output, { recursive: true })
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
try {
  for (const width of [1440, 390, 320]) {
    page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 500 })
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.clock.install({ time: new Date('2026-12-31T12:00:00') })
    await page.addInitScript(() => {
      localStorage.setItem('hasSeenWelcomeGuide', 'true'); localStorage.setItem('notificationPromptSeen', 'true')
      if (localStorage.getItem('eventStore')) return
      const now = new Date(), chain = id => ({ id, name: id === 'math' ? '高等数学' : '计算机实验', typeId: 'course', color: '#2563eb', defaultReminders: [], createdAt: now, updatedAt: now })
      const task = (id, day, hour, completed = false, chainId = 'math') => {
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hour, 0)
        return [id, { id, name: id, startTime: new Date(+end - 1800000), endTime: end, chainId, typeId: 'course', createdAt: now, updatedAt: now, properties: { taskKind: '实验', completed: String(completed) }, reminders: [], isHighlight: false, priority: 0 }]
      }
      localStorage.setItem('eventStore', JSON.stringify({ events: [task('今日任务', 0, 23), task('今日逾期', 0, 10), task('已完成任务', 0, 9, true, 'lab'), task('明日任务', 1, 13), task('历史逾期', -1, 12), task('远期任务', 35, 12)], eventChains: [['math', chain('math')], ['lab', chain('lab')]], eventTypes: [['course', { id: 'course', name: '课程', emoji: '📚', category: 'course', color: '#2563eb' }]], semesterStartDate: now }))
    })
    await page.goto(`http://127.0.0.1:${server.address().port}/TimeScheduler/`)
    if (width < 500) await page.getByRole('button', { name: '待办', exact: true }).click()
    const sidebar = page.locator('[data-right-sidebar]')
    await sidebar.getByRole('button', { name: '全屏放大', exact: true }).waitFor()
    assert.equal(await sidebar.getByRole('button', { name: 'TODO', exact: true }).count(), 1)
    assert.equal(await page.locator('[data-assignment-date]').first().getAttribute('data-assignment-date'), '2026-12-31')
    assert.equal(await page.locator('[data-assignment-date]').nth(1).getAttribute('data-assignment-date'), '2027-01-01')
    for (const [id, status] of [['今日任务', '今日截止'], ['今日逾期', '已逾期'], ['已完成任务', '已完成'], ['明日任务', '待验收'], ['历史逾期', '已逾期']]) assert.equal(await page.locator(`[data-task-lamp="${id}"]`).getAttribute('data-status'), status)
    assert.equal(await page.locator('thead [data-assignment-date]').count(), 7)
    assert.equal(await page.locator('tbody [data-assignment-course]').count(), 2)
    await page.getByLabel('灯珠显示天数').selectOption('14')
    assert.equal(await page.locator('[data-assignment-date]').count(), 14)
    await page.getByLabel('灯珠显示天数').selectOption('7')
    if (width < 500) {
      const scroller = page.getByRole('region', { name: '每日灯珠表格，可横向滚动' })
      await scroller.scrollIntoViewIfNeeded()
      const box = await scroller.boundingBox(), cdp = await page.context().newCDPSession(page)
      const x = box.x + box.width - 15, y = Math.min(box.y + 45, 780)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      for (let i = 1; i <= 6; i++) { await new Promise(r => setTimeout(r, 25)); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - i * 25, y }] }) }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForFunction(() => document.querySelector('[aria-label="每日灯珠表格，可横向滚动"]').scrollLeft > 0)
      await scroller.evaluate(el => { el.scrollLeft = 0 })
      await cdp.detach()
    }
    assert.ok(await page.locator('[data-assignment-course="lab"] [data-task-date]').first().getByText('已完成任务').isVisible())
    await sidebar.getByRole('button', { name: '全屏放大', exact: true }).click()
    const box = await (width > 500 ? page.locator('.app-right-panel') : page.locator('[data-mobile-sheet]')).boundingBox()
    assert.ok(box.width > width * .88 && box.height > 800, 'Fullscreen should use the visible screen')
    await page.locator('[data-task-lamp="今日任务"]').click()
    await page.getByLabel('名称', { exact: true }).fill('全屏保留的草稿')
    await page.getByRole('button', { name: '保存任务', exact: true }).click()
    await page.getByText('已保存到事件链，可撤销', { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('eventStore')).events.find(([id]) => id === '今日任务')[1].name), '全屏保留的草稿')
    await page.locator('[data-task-lamp="今日任务"]').click()
    await page.getByRole('button', { name: '切换完成状态', exact: true }).click()
    await page.getByText('已更新完成状态', { exact: true }).waitFor()
    assert.equal(await page.locator('[data-task-lamp="今日任务"]').getAttribute('data-status'), '已完成')
    await page.getByRole('button', { name: '取消编辑', exact: true }).click()
    await page.locator('.assignment-scroll').evaluate(el => { el.scrollTop = 0 })
    await page.screenshot({ path: resolve(output, `fullscreen-${width}.png`) })
    await page.keyboard.press('Escape')
    await sidebar.getByRole('button', { name: '全屏放大', exact: true }).waitFor()
    await page.screenshot({ path: resolve(output, `sidebar-${width}.png`) })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.clock.fastForward(13 * 60 * 60 * 1000)
    assert.equal(await page.locator('[data-assignment-date]').first().getAttribute('data-assignment-date'), '2027-01-01', 'Calendar should advance at local midnight')
    assert.equal(await page.locator('[data-task-lamp="明日任务"]').getAttribute('data-status'), '今日截止')
    if (width < 500) await page.getByRole('button', { name: '收起详情面板', exact: true }).tap()
    else await page.getByRole('button', { name: '收起详情面板', exact: true }).click()
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('PASS: merged TODO and task panel, daily task lights, empty cells and overdue tasks, 7/14-day ranges, year/midnight rollover, fullscreen draft retention, edit/save/completion, 320px/390px/desktop layouts and dismissal')
} catch (error) {
  if (page && !page.isClosed()) console.error(await page.locator('[role="status"]').allTextContents(), await page.locator('form input:invalid').evaluateAll(inputs => inputs.map(input => [input.outerHTML, input.validationMessage])))
  if (page && !page.isClosed()) await page.screenshot({ path: resolve(output, 'failure.png') })
  throw error
} finally { await browser.close(); await new Promise(r => server.close(r)) }
