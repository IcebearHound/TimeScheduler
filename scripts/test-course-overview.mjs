import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from 'playwright'
const output = resolve('test-results/course-overview'); await mkdir(output, { recursive: true })
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
let page
try {
  for (const width of [1440, 390, 320]) {
    page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 500, timezoneId: 'Asia/Shanghai' })
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.clock.install({ time: new Date('2026-09-28T08:00:00+08:00') })
    await page.addInitScript(() => {
      localStorage.setItem('hasSeenWelcomeGuide', 'true'); localStorage.setItem('notificationPromptSeen', 'true')
      if (localStorage.getItem('eventStore')) return
      const stamp = new Date().toISOString(), chain = id => [id, { id, name: id === 'c' ? '电路原理' : '高等数学', typeId: 'course', color: '#6366f1', defaultReminders: [], createdAt: stamp, updatedAt: stamp }]
      localStorage.setItem('eventStore', JSON.stringify({ events: [], eventChains: [chain('other'), chain('c')], eventTypes: [['course', { id: 'course', name: '课程', emoji: '📚', category: 'course', color: '#6366f1' }]], semesterStartDate: stamp }))
    })
    const open = async () => {
      await page.goto(`http://127.0.0.1:${server.address().port}/TimeScheduler/`)
      if (width < 500) await page.getByRole('button', { name: '待办', exact: true }).click()
    }
    await open()
    const sidebar = page.locator('[data-right-sidebar]'), tab = name => sidebar.getByRole('button', { name, exact: true }).click()
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('eventStore')))
    const add = async () => {
      await tab('实验作业')
      await page.getByRole('button', { name: '＋ 添加作业 / 实验', exact: true }).click()
      await page.getByRole('menuitem', { name: '快捷添加', exact: true }).click()
      await page.getByLabel('课程', { exact: true }).selectOption('c')
      await page.getByLabel('类别', { exact: true }).selectOption('实验课')
      await page.getByLabel('名称', { exact: true }).fill('电路实验')
      await page.getByLabel('上课开始时间', { exact: true }).fill('2026-09-21T14:00')
      await page.getByLabel('上课结束时间', { exact: true }).fill('2026-09-21T16:00')
    }
    const save = async () => { await page.getByRole('button', { name: '保存任务', exact: true }).click(); await page.getByText('已保存到事件链，可撤销', { exact: true }).waitFor() }
    await add()
    await page.getByLabel('本次编号', { exact: true }).fill('1')
    await page.getByRole('checkbox', { name: '同时添加实验报告截止时间', exact: true }).check()
    await page.getByLabel('实验结束后天数', { exact: true }).fill('2')
    await page.getByLabel('截止时刻', { exact: true }).fill('23:00')
    await page.getByRole('checkbox', { name: '每周重复', exact: true }).check()
    await page.getByLabel('重复次数', { exact: true }).fill('2')
    await page.screenshot({ path: resolve(output, `report-rule-${width}.png`) })
    await save()
    let data = await stored(), reports = data.events.map(([, e]) => e).filter(e => e.properties.taskKind === '实验报告')
    assert.deepEqual(reports.map(e => e.endTime), ['2026-09-23T15:00:00.000Z', '2026-09-30T15:00:00.000Z'])
    assert.ok(reports.every(e => e.chainId === 'c' && new Map(data.eventTypes).get(e.typeId).category === 'lab_report'))
    const firstReport = page.locator(`[data-task-lamp="${reports[0].id}"]`)
    if (!await firstReport.isVisible()) await page.locator('summary').filter({ hasText: '此前逾期未完成' }).click()
    await firstReport.click()
    await page.clock.runFor(650)
    await tab('课程概览')
    const card = page.locator('[data-course-overview="c"]'), other = page.locator('[data-course-overview="other"]')
    assert.equal(await page.locator('[data-course-overview]').first().getAttribute('data-course-overview'), 'c', 'Nearest pending deadline takes priority over courses with no pending work')
    assert.equal(await card.locator('[data-next-deadline="report"]').isVisible(), false, 'Course details default to collapsed')
    assert.equal(await card.locator('[data-progress="report"]').isVisible(), true, 'Completion summary stays visible')
    await card.getByRole('button', { name: '电路原理 · 展开截止信息', exact: true }).click()
    assert.equal(await card.locator('[data-next-deadline="report"]').isVisible(), true)
    assert.equal(await other.locator('[data-next-deadline="report"]').isVisible(), false, 'Each course expands independently')
    assert.match(await card.locator('[data-progress="report"]').textContent(), /实验一/)
    assert.match(await card.locator('[data-next-deadline="report"]').textContent(), /9\/30|9月30/)
    assert.match(await other.textContent(), /暂无待办/)
    await page.getByRole('button', { name: '电路原理 · 调整完成进度', exact: true }).click()
    await page.getByLabel('验收统计方式', { exact: true }).selectOption('manual')
    await page.getByLabel('验收完成编号', { exact: true }).fill('2')
    await page.getByLabel('作业统计方式', { exact: true }).selectOption('manual')
    await page.getByLabel('作业完成编号', { exact: true }).fill('0')
    await page.getByRole('button', { name: '保存完成进度', exact: true }).click()
    await page.getByRole('dialog', { name: '电路原理 · 完成进度', exact: true }).waitFor({ state: 'hidden' })
    assert.match(await card.locator('[data-progress="acceptance"]').textContent(), /实验二/)
    assert.match(await card.locator('[data-progress="homework"]').textContent(), /作业零/)
    const progress = (await stored()).eventChains.find(([id]) => id === 'c')[1].taskRules.completedProgress
    assert.deepEqual(progress, { acceptance: 2, homework: 0 })
    await page.screenshot({ path: resolve(output, `overview-${width}.png`) })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.reload()
    if (width < 500) await page.getByRole('button', { name: '待办', exact: true }).click()
    await tab('课程概览')
    assert.match(await card.locator('[data-progress="acceptance"]').textContent(), /实验二/)
    await page.getByRole('button', { name: '电路原理 · 调整完成进度', exact: true }).click()
    await page.getByRole('button', { name: '全部恢复自动', exact: true }).click()
    await page.getByRole('button', { name: '保存完成进度', exact: true }).click()
    await page.getByRole('dialog', { name: '电路原理 · 完成进度', exact: true }).waitFor({ state: 'hidden' })
    assert.match(await card.locator('[data-progress="acceptance"]').textContent(), /暂无完成/)
    assert.match(await card.locator('[data-progress="report"]').textContent(), /实验一/)
    assert.equal(await card.locator('[data-next-deadline="report"]').isVisible(), false, 'Reload restores collapsed default')
    await card.getByRole('button', { name: '电路原理 · 展开截止信息', exact: true }).click()
    await card.getByRole('button', { name: '电路原理 · 收起截止信息', exact: true }).click()
    assert.equal(await card.locator('[data-next-deadline="report"]').isVisible(), false)
    await card.getByRole('button', { name: '电路原理 · 展开截止信息', exact: true }).click()
    await card.getByRole('button', { name: '查看实验报告：电路实验', exact: true }).click()
    await sidebar.getByRole('button', { name: '详情', exact: true }).waitFor()
    await add()
    assert.equal(await page.getByRole('checkbox', { name: '同时添加实验报告截止时间', exact: true }).isChecked(), false)
    await save()
    assert.equal((await stored()).events.length, 5, 'No report without explicit opt in')
    await add()
    await page.getByRole('checkbox', { name: '同时添加实验报告截止时间', exact: true }).check()
    await page.getByLabel('报告截止规则', { exact: true }).selectOption('weekday')
    await page.getByLabel('截止星期', { exact: true }).selectOption('0')
    await page.getByLabel('截止时刻', { exact: true }).fill('23:59')
    await save()
    data = await stored()
    assert.equal(data.events.at(-1)[1].endTime, '2026-09-27T15:59:00.000Z')
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('PASS: report rules, explicit opt-in, weekly report types, course overview, zero/manual progress, restore auto, reload, details navigation and desktop/mobile layouts')
} catch (error) {
  if (page && !page.isClosed()) { console.error(await page.locator('[role="alert"], [role="status"]').allTextContents()); await page.screenshot({ path: resolve(output, 'failure.png') }) }
  throw error
} finally { await browser.close(); await new Promise(r => server.close(r)) }
