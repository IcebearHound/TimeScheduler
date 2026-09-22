import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from 'playwright'

const output = resolve('test-results/todo-ui'); await mkdir(output, { recursive: true })
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
    page.setDefaultTimeout(10000)
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    await page.clock.install({ time: new Date('2026-12-31T12:00:00') })
    await page.addInitScript(() => {
      localStorage.setItem('hasSeenWelcomeGuide', 'true'); localStorage.setItem('notificationPromptSeen', 'true')
      const now = new Date(), end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18)
      const event = (id, updates = {}) => [id, { id, name: id, startTime: new Date(+end - 3600000), endTime: end, chainId: 'course', typeId: 'custom', createdAt: now, updatedAt: now, properties: { location: '实验楼 A201', notes: '保留备注' }, reminders: [], isHighlight: false, priority: 0, ...updates }]
      localStorage.setItem('eventStore', JSON.stringify({ events: [event('机器学习实验报告与结果分析——一条需要完整显示的长标题', { pinned: true, properties: { taskKind: '项目', completed: 'false', notes: '保留备注' } }), event('重点课程', { isHighlight: true }), event('已完成作业', { pinned: true, properties: { completed: 'true' } }), ...Array.from({ length: 12 }, (_, i) => event('近期课程' + i))], eventChains: [['course', { id: 'course', name: '机器学习', typeId: 'custom', color: '#6366f1', defaultReminders: [], createdAt: now, updatedAt: now }]], eventTypes: [['custom', { id: 'custom', name: '项目', emoji: '📋', category: 'custom', color: '#6366f1' }]], semesterStartDate: now }))
      const store = JSON.parse(localStorage.getItem('eventStore'))
      const day = (offset, hour = 0, minute = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute)
      store.events.push(
        event('今日零点作业', { endTime: day(0), properties: { taskKind: '作业' } }),
        event('第七天报告', { endTime: day(6, 23, 59), properties: { taskKind: '实验报告' } }),
        event('第八天作业', { endTime: day(7), properties: { taskKind: '作业' } }),
        event('昨日逾期作业', { endTime: day(-1, 23, 59), properties: { taskKind: '作业' } }),
        event('跨日验收', { startTime: day(-1), endTime: day(1), properties: { taskKind: '实验验收' } }),
        event('跳过作业', { endTime: day(1), properties: { taskKind: '作业', taskSkipOverride: 'skip' } }),
        event('已提交报告', { endTime: day(1), properties: { taskKind: '实验报告', completed: 'true' } }),
        event('远期考试', { startTime: day(8), endTime: day(9), properties: { taskKind: '考试' } }),
      )
      localStorage.setItem('eventStore', JSON.stringify(store))
    })
    await page.goto(`http://127.0.0.1:${server.address().port}/TimeScheduler/`)
    if (width < 500) await page.getByRole('button', { name: '待办', exact: true }).click()
    const todo = page.locator('[data-right-sidebar] [data-todo-view]')
    await todo.getByRole('heading', { name: '待办清单' }).waitFor()
    assert.equal(await todo.locator('[data-todo-event]').count(), 20)
    assert.deepEqual(await todo.locator('[data-todo-section]').evaluateAll(els => els.map(el => el.dataset.todoSection)), ['pinned', 'highlight', 'upcoming', 'course'])
    const eventProgress = todo.getByRole('progressbar', { name: '事件完成进度', exact: true })
    const courseProgress = todo.getByRole('progressbar', { name: '课程任务完成进度', exact: true })
    assert.equal(await eventProgress.getAttribute('aria-valuemax'), '15')
    assert.equal(await courseProgress.getAttribute('aria-valuemax'), '4', 'Count only today through day six, using deadlines and excluding skipped tasks')
    assert.equal(await courseProgress.getAttribute('aria-valuenow'), '1')
    assert.equal(await todo.locator('[data-todo-section="course"] [data-todo-event]').count(), 7, 'Statistics must not hide overdue or future tasks')
    const card = todo.locator('[data-todo-event]').first()
    assert.match(await card.innerText(), /今天 18:00 截止/)
    await card.getByRole('checkbox').click()
    assert.equal(await card.getByRole('checkbox').getAttribute('aria-checked'), 'true')
    assert.equal(await eventProgress.getAttribute('aria-valuenow'), '2')
    assert.equal(await courseProgress.getAttribute('aria-valuenow'), '1', 'Event completion must not change course statistics')
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('eventStore')).events[0][1])
    assert.equal(saved.properties.notes, '保留备注')
    await todo.getByRole('group', { name: '筛选待办状态' }).getByRole('button', { name: /^已完成/ }).click()
    assert.equal(await todo.locator('[data-todo-event]').count(), 3)
    await card.getByRole('checkbox').focus(); await page.keyboard.press('Space')
    assert.equal(await todo.locator('[data-todo-event]').count(), 2)
    await todo.getByRole('group', { name: '筛选待办状态' }).getByRole('button', { name: /^全部/ }).click()
    await todo.getByRole('button', { name: '展开其余 2 项' }).click()
    assert.equal(await todo.locator('[data-todo-event]').count(), 22)
    await todo.getByRole('button', { name: '收起更多' }).click()
    await todo.getByRole('button', { name: 'Todo 设置', exact: true }).click()
    await todo.getByLabel('待办事项时间范围（天）').fill('4')
    await page.keyboard.press('Escape')
    await todo.getByLabel('待办事项时间范围（天）').waitFor({ state: 'hidden' })
    await todo.locator('[data-todo-event="近期课程0"]').getByRole('button', { name: '置顶', exact: true }).click()
    assert.equal(await todo.locator('[data-todo-section="pinned"] [data-todo-event="近期课程0"]').count(), 1)
    await todo.locator('[data-todo-event="近期课程0"]').getByRole('button', { name: '取消置顶', exact: true }).click()
    if (width > 500) {
      await todo.locator('[data-todo-event="近期课程0"]').dragTo(todo.locator('[data-todo-section="highlight"] [data-todo-event]').first())
      assert.equal(await todo.locator('[data-todo-section="highlight"] [data-todo-event="近期课程0"]').count(), 1)
    }
    await todo.evaluate(el => el.scrollIntoView({ block: 'start' }))
    await page.locator('[data-right-sidebar] > div').last().evaluate(el => { if (el.firstElementChild) el.firstElementChild.scrollTop = 0 })
    await page.screenshot({ path: resolve(output, `light-${width}.png`) })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.screenshot({ path: resolve(output, `dark-${width}.png`) })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.equal(await todo.evaluate(el => el.scrollWidth <= el.clientWidth), true)
    await todo.locator('[data-todo-event]').first().getByRole('button', { name: /^定位：/ }).click()
    if (width > 500) {
      await page.getByRole('button', { name: 'Todo', exact: true }).click()
      const modal = page.locator('.animate-modal-panel [data-todo-view]')
      await modal.getByRole('heading', { name: '待办清单' }).waitFor()
      await page.getByRole('button', { name: '关闭待办', exact: true }).click()
      await modal.waitFor({ state: 'hidden' })
    }
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('PASS: TODO section priority, separate event/course statistics, seven-day deadline boundaries and skipped tasks, cards, completion, filters, pinning and drag, light/dark desktop/mobile layouts')
} catch (error) { if (page) await page.screenshot({ path: resolve(output, 'failure.png') }); throw error }
finally { await browser.close(); await new Promise(r => server.close(r)) }
