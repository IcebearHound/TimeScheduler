import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from 'playwright'
const output = resolve('test-results/calendar-scroll'); await mkdir(output, { recursive: true })
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
  for (const width of [1440, 390]) {
    page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 500 })
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    await page.addInitScript(() => {
      localStorage.setItem('hasSeenWelcomeGuide', 'true'); localStorage.setItem('notificationPromptSeen', 'true')
      const now = new Date(), events = []
      for (let day = 0; day < 7; day++) for (const hour of [0, 12, 23]) {
        const start = new Date(now); start.setDate(start.getDate() + day); start.setHours(hour, 0, 0, 0)
        const id = `${day}-${hour}`
        events.push([id, { id, name: `事件 ${id}`, startTime: start, endTime: new Date(+start + 1800000), chainId: '', typeId: 'course', createdAt: now, updatedAt: now, properties: {}, reminders: [], isHighlight: false, priority: 0 }])
      }
      localStorage.setItem('eventStore', JSON.stringify({ events, eventChains: [], eventTypes: [['course', { id: 'course', name: '课程', emoji: '📚', category: 'course', color: '#2563eb' }]], semesterStartDate: now }))
    })
    await page.goto(`http://127.0.0.1:${server.address().port}/TimeScheduler/`)
    const verify = async () => {
      await page.locator('[aria-label="上方未完整显示的事件"]').first().waitFor()
      await page.locator('[aria-label="下方未完整显示的事件"]').first().waitFor()
      const result = await page.evaluate(() => {
        const scroller = document.querySelector('[data-calendar-scroll]')
        const layer = scroller.querySelector('[data-calendar-edge-layer]')
        const top = layer.querySelector('[aria-label="上方未完整显示的事件"]')
        const bottom = layer.querySelector('[aria-label="下方未完整显示的事件"]')
        const initial = top.getBoundingClientRect(), errors = []
        scroller.style.scrollBehavior = 'auto'
        // Intentionally measure in the same task: there is no scroll listener, React render or RAF between these writes and reads.
        for (const y of [480, 620, 320, 710, 360]) {
          scroller.scrollTop = y
          const viewport = scroller.getBoundingClientRect(), header = scroller.querySelector('[data-calendar-header]')?.getBoundingClientRect().height || 0
          errors.push(Math.abs(top.getBoundingClientRect().top - viewport.top - header))
          errors.push(Math.abs(bottom.getBoundingClientRect().bottom - viewport.bottom))
        }
        scroller.scrollLeft = 230
        const dx = scroller.scrollLeft
        errors.push(Math.abs(top.getBoundingClientRect().left - initial.left + dx))
        scroller.scrollLeft = 0
        return { errors, position: getComputedStyle(layer).position }
      })
      assert.equal(result.position, 'sticky')
      assert.ok(result.errors.every(v => v < 2), JSON.stringify(result))
      await page.mouse.wheel(0, 200)
      await page.screenshot({ path: resolve(output, `${width}-${await page.locator('[data-calendar-header]').count()}.png`) })
    }
    if (width < 500) {
      await verify()
      await page.getByRole('button', { name: '多日', exact: true }).click()
      await page.getByLabel('显示天数', { exact: true }).selectOption('7')
    }
    await verify()
    if (width > 500) { await page.getByRole('button', { name: '日', exact: true }).click(); await verify() }
    if (width < 500) {
      const box = await page.locator('[data-calendar-scroll]').boundingBox(), cdp = await page.context().newCDPSession(page)
      const x = box.x + 100, y = box.y + 300
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      for (let i = 1; i <= 8; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 18 }] })
        const delta = await page.evaluate(() => {
          const scroll = document.querySelector('[data-calendar-scroll]'), top = scroll.querySelector('[aria-label="上方未完整显示的事件"]')
          return Math.abs(top.getBoundingClientRect().top - scroll.getBoundingClientRect().top - scroll.querySelector('[data-calendar-header]').getBoundingClientRect().height)
        })
        assert.ok(delta < 2)
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach()
    }
    assert.deepEqual(errors, [])
    console.log(`PASS ${width}px: day/week summaries align in the same scroll task, both edges and horizontal/touch scrolling`)
    await page.close()
  }
} finally { await browser.close(); await new Promise(r => server.close(r)) }
