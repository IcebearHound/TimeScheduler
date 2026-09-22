import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from 'playwright'

const output = resolve('test-results/task-performance'); await mkdir(output, { recursive: true })
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname.replace(/^\/TimeScheduler\//, '') || 'index.html'
    const target = resolve('dist', path), root = resolve('dist')
    if (!target.startsWith(root + '/') && !target.startsWith(root + '\\')) throw Error('path')
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(target)] || 'application/octet-stream')
    res.end(await readFile(target))
  } catch { res.writeHead(404); res.end() }
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
try {
  await page.addInitScript(() => {
    localStorage.setItem('hasSeenWelcomeGuide', 'true'); localStorage.setItem('notificationPromptSeen', 'true')
    const stamp = new Date().toISOString(), start = new Date(); start.setHours(22, 0, 0, 0)
    const chains = Array.from({ length: 20 }, (_, i) => [`c${i}`, { id: `c${i}`, name: `性能测试课程${i}`, typeId: 'homework', color: '#6366f1', defaultReminders: [], createdAt: stamp, updatedAt: stamp }])
    const events = Array.from({ length: 800 }, (_, i) => {
      const day = new Date(start); day.setDate(day.getDate() + Math.floor(i / 20) % 30)
      return [`e${i}`, { id: `e${i}`, name: `作业${i}`, chainId: `c${i % 20}`, typeId: 'homework', startTime: day, endTime: new Date(+day + 1800000), properties: { taskKind: '作业', completed: 'false' }, reminders: [], isHighlight: false, priority: 0, createdAt: stamp, updatedAt: stamp }]
    })
    localStorage.setItem('eventStore', JSON.stringify({ events, eventChains: chains, eventTypes: [['homework', { id: 'homework', name: '作业', emoji: '📓', category: 'homework', color: '#6366f1' }]], semesterStartDate: stamp }))
  })
  await page.goto(`http://127.0.0.1:${server.address().port}/TimeScheduler/`)
  await page.locator('[data-right-sidebar]').getByRole('button', { name: '实验作业', exact: true }).click()
  await page.locator('table [data-task-lamp="e0"]').waitFor()
  const samples = []
  for (let i = 0; i < 3; i++) {
    const id = `e${i}`
    await page.evaluate(id => {
      const el = document.querySelector(`table [data-task-lamp="${id}"]`)
      window.__lampMeasure = { visual: null, writes: 0 }
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function(key, value) { if (key === 'eventStore' || key === 'eventGroupStore') window.__lampMeasure.writes++; return original.call(this, key, value) }
      window.__restoreSet = () => { Storage.prototype.setItem = original }
      el.addEventListener('click', () => {
        const start = performance.now()
        const observer = new MutationObserver(() => {
          if (el.dataset.completed === 'true') requestAnimationFrame(() => { if (window.__lampMeasure.visual === null) window.__lampMeasure.visual = performance.now() - start; observer.disconnect() })
        })
        observer.observe(el, { attributes: true, attributeFilter: ['data-completed'] })
      }, { once: true, capture: true })
    }, id)
    await page.locator(`table [data-task-lamp="${id}"]`).click()
    await page.waitForFunction(() => window.__lampMeasure.visual !== null)
    await page.waitForFunction(id => JSON.parse(localStorage.getItem('eventStore')).events.find(([key]) => key === id)[1].properties.completed === 'true', id)
    const sample = await page.evaluate(() => { window.__restoreSet(); return window.__lampMeasure })
    samples.push(sample)
  }
  console.log(JSON.stringify({ tasks: 800, samples, averageVisualMs: Math.round(samples.reduce((sum, s) => sum + s.visual, 0) / samples.length) }))
  if (!process.argv.includes('--baseline')) {
    assert.ok(samples.every(s => s.visual < 250), 'A click should paint feedback immediately, without waiting for the double-click window')
    assert.ok(samples.every(s => s.writes <= 2), 'A single task change should not repeatedly persist the entire archive')
    await page.evaluate(() => {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function(key, value) { if (key === 'eventStore') throw new Error('quota'); return original.call(this, key, value) }
      window.__restoreFailure = () => { Storage.prototype.setItem = original }
    })
    await page.locator('table [data-task-lamp="e3"]').click()
    assert.equal(await page.locator('table [data-task-lamp="e3"]').getAttribute('data-completed'), 'true', 'Feedback is immediate even before a failing save')
    await page.getByText('无法保存到浏览器存档（空间不足或存储被禁用），完成状态未修改', { exact: true }).waitFor()
    await page.waitForFunction(() => document.querySelector('table [data-task-lamp="e3"]').dataset.completed === 'false')
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('eventStore')).events.find(([id]) => id === 'e3')[1].properties.completed), 'false')
    await page.evaluate(() => window.__restoreFailure())
    await page.locator('table [data-task-lamp="e4"]').click()
    await page.locator('[data-right-sidebar]').getByRole('button', { name: 'TODO', exact: true }).click()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('eventStore')).events.find(([id]) => id === 'e4')[1].properties.completed === 'true')
    console.log('PASS: immediate feedback, bounded storage writes, save failure rollback, and close/switch flushes pending single clicks')
  }
} finally { await browser.close(); await new Promise(r => server.close(r)) }
