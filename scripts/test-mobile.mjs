import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from 'playwright'

const output = resolve('test-results/mobile'); await mkdir(output, { recursive: true })
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
try {
  await page.addInitScript(() => { localStorage.setItem('hasSeenWelcomeGuide', 'true'); localStorage.setItem('notificationPromptSeen', 'true') })
  await page.goto(url)
  await page.evaluate(() => {
    const date = new Date().toISOString(), groups = [], chains = []
    for (let i = 0; i < 25; i++) {
      const group = { id: `group-${i}`, name: `分组 ${i + 1}：计算机科学与技术专业课程及实验作业长期学习计划`, emoji: '📚', eventChainIds: [`chain-${i}`], eventIds: [], createdAt: date, updatedAt: date }
      groups.push([group.id, group]); chains.push([`chain-${i}`, { id: `chain-${i}`, name: `课程 ${i + 1}：计算机组成原理与体系结构`, typeId: 'course', color: '#2563eb', defaultReminders: [], createdAt: date, updatedAt: date }])
    }
    localStorage.setItem('eventGroupStore', JSON.stringify({ groups, groupOrder: groups.map(([id]) => id), activeGroupId: 'group-0' }))
    localStorage.setItem('eventStore', JSON.stringify({ events: [], eventChains: chains, eventTypes: [['course', { id: 'course', name: '课程', emoji: '📚', category: 'course', color: '#2563eb' }]], semesterStartDate: date }))
  })
  await page.reload()
  assert.equal(await page.locator('html').getAttribute('data-layout'), 'mobile')
  assert.equal(await page.getByRole('button', { name: '搜索', exact: true }).count(), 1)
  assert.equal(await page.getByRole('button', { name: '分组', exact: true }).count(), 1)
  assert.equal(await page.getByRole('button', { name: '课程作业 / 实验', exact: true }).count(), 1)
  await page.screenshot({ path: resolve(output, 'home.png') })
  await page.getByRole('button', { name: '分组', exact: true }).click()
  const groups = page.locator('[data-sidebar-section="groups"]')
  await visible(groups)
  const more = groups.getByRole('button', { name: /^更多操作 分组 25：/ }); await more.scrollIntoViewIfNeeded(); await more.click()
  const last = groups.getByRole('button', { name: /^重命名 分组 25：/ })
  await last.scrollIntoViewIfNeeded(); await last.click()
  await groups.locator('input[type=text]').fill('最后一个分组已重命名')
  await groups.locator('input[type=text]').press('Enter')
  await visible(groups.getByRole('button', { name: '重命名 最后一个分组已重命名', exact: true }))
  await groups.getByRole('button', { name: '上移 最后一个分组已重命名', exact: true }).click()
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('eventGroupStore')).groupOrder[23]), 'group-24')
  await groups.getByRole('button', { name: '下移 最后一个分组已重命名', exact: true }).click()
  assert.equal(await groups.evaluate(el => el.scrollWidth <= el.clientWidth), true)
  await page.screenshot({ path: resolve(output, 'groups-scrolled.png') })
  await page.getByRole('tab', { name: '事件链', exact: true }).click()
  assert.equal(await groups.isVisible(), false)
  const chain = page.getByRole('button', { name: /^编辑事件链 课程 25：/ }); await chain.scrollIntoViewIfNeeded(); await visible(chain)
  await page.getByRole('tab', { name: '事件类型', exact: true }).click()
  await page.getByRole('checkbox', { name: '显示 课程', exact: true }).uncheck()
  assert.equal(await page.getByRole('checkbox', { name: '显示 课程', exact: true }).isChecked(), false)
  await page.getByRole('checkbox', { name: '显示 课程', exact: true }).check()
  await page.getByRole('button', { name: '收起分组面板' }).click()
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await visible(page.getByPlaceholder(/搜索/).first()); await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '工具', exact: true }).click()
  await visible(page.getByRole('button', { name: '导入课表', exact: true }))
  await visible(page.getByRole('button', { name: 'AI / MCP', exact: true }))
  await visible(page.getByRole('button', { name: '撤销', exact: true }))
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await page.getByRole('button', { name: '重做', exact: true }).click()
  await page.getByRole('button', { name: '关闭工具' }).click()
  await settings()
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '导出全部数据' }).click()
  const file = await download, backup = JSON.parse(await readFile(await file.path(), 'utf8'))
  assert.equal(backup.groups.length, 25); assert.equal(backup.eventChains.length, 25)
  const beforeRestore = await page.evaluate(() => localStorage.getItem('eventGroupStore'))
  await page.getByLabel('选择完整备份').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}') })
  await page.getByRole('button', { name: '知道了', exact: true }).click()
  assert.equal(await page.evaluate(() => localStorage.getItem('eventGroupStore')), beforeRestore)
  backup.groups[0].name = '从备份恢复的分组'
  await page.getByLabel('选择完整备份').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  await page.getByRole('button', { name: '确定', exact: true }).click()
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('eventGroupStore')).groups[0][1].name), '从备份恢复的分组')
  await page.screenshot({ path: resolve(output, 'settings.png') })
  await page.getByRole('button', { name: '桌面版', exact: true }).click()
  assert.equal(await page.locator('html').getAttribute('data-layout'), 'desktop')
  await page.getByRole('button', { name: '关闭设置', exact: true }).click()
  assert.equal(await page.getByRole('navigation', { name: '主导航', exact: true }).count(), 0)
  await page.reload()
  assert.equal(await page.locator('html').getAttribute('data-layout'), 'desktop')
  await settings(); await page.getByRole('button', { name: '手机版', exact: true }).click()
  await page.getByRole('button', { name: '关闭设置', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 900 })
  assert.equal(await page.locator('html').getAttribute('data-layout'), 'mobile')
  await settings(); await page.getByRole('button', { name: '自动适配', exact: true }).click()
  assert.equal(await page.locator('html').getAttribute('data-layout'), 'desktop')
  await page.getByRole('button', { name: '关闭设置', exact: true }).click()
  await page.screenshot({ path: resolve(output, 'desktop.png') })
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 667 })
    await page.waitForFunction(expected => document.documentElement.dataset.layout === expected, width < 768 ? 'mobile' : 'desktop')
    if (width < 768) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await page.getByRole('button', { name: '多日', exact: true }).click()
      await page.getByLabel('显示天数', { exact: true }).selectOption('7')
      assert.equal(await page.getByRole('button', { name: '上一页', exact: true }).count(), 1)
      await page.getByRole('button', { name: '下一页', exact: true }).click()
      assert.equal(await page.locator('[data-calendar-scroll]').evaluate(el => el.scrollWidth > el.clientWidth), true)
      await page.getByRole('button', { name: '日程', exact: true }).click()
      await page.screenshot({ path: resolve(output, `home-${width}.png`) })
    }
  }
  assert.deepEqual(errors, [])
  console.log('PASS: unique mobile navigation, 25 long groups and chains scroll/reorder/rename, type filtering, search, tools undo/redo, backup export, persisted desktop/mobile override and automatic resize, narrow screens and seven-day horizontal scrolling')
} catch (error) {
  await page.screenshot({ path: resolve(output, 'failure.png') }); console.error((await page.locator('body').innerText()).slice(-3500)); throw error
} finally { await browser.close(); await new Promise(r => server.close(r)) }
