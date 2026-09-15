import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const directory = mkdtempSync(join(tmpdir(), 'time-scheduler-browser-'))
const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'server/index.ts', '--mcp'], cwd: process.cwd(), env: { ...process.env, TIMESCHEDULER_DATA_DIR: directory }, stderr: 'pipe' })
let stderr = ''
transport.stderr.on('data', data => { stderr += data.toString() })
const client = new Client({ name: 'workspace-browser-test', version: '1.0.0' })
let browser
let aiRequests = 0
const mockAI = createServer(async (req, res) => {
  let raw = ''; for await (const part of req) raw += part
  assert.equal(req.headers.authorization, 'Bearer synthetic-ai-test-key')
  const request = JSON.parse(raw), archive = JSON.parse(request.messages[1].content).archive
  const event = archive.events.find(e => e.name === '第三次作业')
  ++aiRequests
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ actions: [{ op: 'update_event', id: event.id, changes: { properties: { ...event.properties, notes: 'AI 更新的备注' } } }] }) } }] }))
})
await new Promise(resolve => mockAI.listen(0, '127.0.0.1', resolve))
const output = resolve('test-results'); mkdirSync(output, { recursive: true })
try {
  await client.connect(transport)
  for (let i = 0; i < 100 && !stderr.match(/配对码：(\d{8})/); i++) await new Promise(r => setTimeout(r, 100))
  const code = stderr.match(/配对码：(\d{8})/)?.[1]
  assert.ok(code, 'Local service must start and issue a pairing code')
  const tools = await client.listTools(); assert.deepEqual(tools.tools.map(t => t.name), ['get_archive', 'apply_actions'])
  const disconnected = await client.callTool({ name: 'get_archive', arguments: {} }); assert.equal(disconnected.isError, true)
  const unauthorized = await fetch('http://127.0.0.1:4318/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(unauthorized.status, 401)
  const badOrigin = await fetch('http://127.0.0.1:4318/pair', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' }, body: JSON.stringify({ code }) }); assert.equal(badOrigin.status, 403)
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(() => { localStorage.setItem('hasSeenWelcomeGuide', 'true'); localStorage.setItem('notificationPromptSeen', 'true') })
  await page.goto('http://127.0.0.1:4318/TimeScheduler/')
  await page.getByRole('button', { name: '课程作业 / 实验', exact: true }).click()
  await page.getByRole('button', { name: '全屏放大', exact: true }).click()
  await page.getByLabel('课程', { exact: true }).fill('高等数学')
  await page.getByLabel('名称', { exact: true }).fill('第三次作业')
  await page.getByLabel('验收截止时间', { exact: true }).fill('2026-09-18T23:59')
  await page.getByLabel('提交链接', { exact: true }).fill('https://example.com/assignment')
  await page.getByLabel('作业 / 实验内容', { exact: true }).fill('积分练习 1–8')
  await page.getByRole('button', { name: '保存任务', exact: true }).click()
  await page.getByText('已保存到事件链，可撤销', { exact: true }).waitFor()
  await page.getByRole('dialog').locator('[data-task-lamp]').filter({ hasText: '第三次作业' }).first().click()
  assert.equal(await page.getByLabel('作业 / 实验内容', { exact: true }).inputValue(), '积分练习 1–8')
  await page.getByRole('button', { name: '取消编辑' }).click()
  await page.getByLabel('粘贴任务表格').fill('课程\t名称\t提交链接\n高等数学\t第三次作业\thttps://example.com/updated')
  await page.getByRole('button', { name: '预览粘贴内容' }).click()
  await page.getByRole('button', { name: '应用到事件链' }).click()
  await page.getByText('已导入 1 项，可整体撤销', { exact: true }).waitFor()
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('eventStore')))
  assert.equal(stored.events.length, 1); assert.equal(stored.eventChains.length, 1); assert.equal(stored.events[0][1].properties.submissionUrl, 'https://example.com/updated')
  await page.screenshot({ path: join(output, 'course-workspace-desktop.png') })
  await page.getByRole('button', { name: '收起详情面板' }).click()
  await page.getByRole('button', { name: 'AI / MCP', exact: true }).click()
  await page.getByLabel('本机配对码').fill(code)
  await page.getByRole('button', { name: '连接此存档（允许 MCP 读写）' }).click()
  await page.getByLabel('本地加密口令').fill('browser-test-only-password')
  await page.getByRole('button', { name: '创建 / 解锁凭据库' }).click()
  await page.getByRole('button', { name: '锁定凭据库', exact: true }).waitFor()
  assert.equal(await page.getByRole('heading', { name: 'GitHub / Gitee 私有仓库同步' }).count(), 0)
  await page.getByText('此存档已连接 · MCP 可读写', { exact: true }).waitFor()
  await page.getByLabel('API 基础地址').fill(`http://127.0.0.1:${mockAI.address().port}/v1`)
  await page.getByLabel('模型名称').fill('synthetic-model')
  await page.getByLabel('API 密钥').fill('synthetic-ai-test-key')
  await page.getByRole('button', { name: '加密保存 API 配置' }).click()
  await page.getByText('AI 配置已加密保存在本机', { exact: true }).waitFor()
  await page.getByLabel('用自然语言安排日程').fill('给第三次作业添加备注')
  await page.getByRole('button', { name: '生成操作预览' }).click()
  await page.getByRole('button', { name: '确认应用到存档' }).waitFor()
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('eventStore')).events[0][1].properties.notes), undefined)
  await page.getByRole('button', { name: '确认应用到存档' }).click()
  await page.getByText('AI 操作已写入当前存档，可整体撤销', { exact: true }).waitFor()
  assert.equal(aiRequests, 1)
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('eventStore')).events[0][1].properties.notes), 'AI 更新的备注')
  await page.waitForFunction(() => document.body.innerText.includes('此存档已连接'))
  // Allow a fresh heartbeat after the UI transaction; get_archive must reflect it before MCP writes.
  for (let i = 0; i < 30; i++) { const check = JSON.parse((await client.callTool({ name: 'get_archive', arguments: {} })).content[0].text); if (check.snapshot.events[0].properties.notes === 'AI 更新的备注') break; await new Promise(resolve => setTimeout(resolve, 100)) }
  const read = JSON.parse((await client.callTool({ name: 'get_archive', arguments: {} })).content[0].text)
  assert.equal(read.snapshot.events[0].name, '第三次作业')
  const now = new Date(), start = new Date(now); start.setHours(0, 0, 0, 0)
  const late = new Date(start); late.setHours(23, 0, 0, 0)
  const actions = [start, late].map((date, i) => ({ op: 'create_event', event: { name: i ? '夜间事件' : '凌晨事件', startTime: date.toISOString(), endTime: new Date(+date + 1800000).toISOString(), chainId: read.snapshot.eventChains[0].id, typeId: 'type-course', properties: {}, reminders: [], isHighlight: false, priority: 0 } }))
  const applied = await client.callTool({ name: 'apply_actions', arguments: { revision: read.revision, actions } })
  assert.ok(!applied.isError, JSON.stringify(applied))
  assert.equal(JSON.parse(applied.content[0].text).applied, true)
  const stale = await client.callTool({ name: 'apply_actions', arguments: { revision: read.revision, actions } }); assert.equal(stale.isError, true)
  await page.screenshot({ path: join(output, 'integrations-desktop.png') })
  await page.getByRole('button', { name: '关闭工作台' }).click()
  for (const name of ['GitHub', 'Gitee']) {
    await page.getByRole('button', { name: '用户', exact: true }).click()
    if (name === 'GitHub') await page.screenshot({ path: join(output, 'user-menu-desktop.png') })
    await page.getByRole('button', { name: `${name} 登录与同步`, exact: true }).click()
    await page.getByRole('heading', { name: '登录账号，日程随身同步' }).waitFor()
    assert.equal(await page.getByRole('dialog').getByText(/npm|配对码|Client Secret|本地加密口令/).count(), 0)
    await page.getByRole('button', { name: '关闭工作台' }).click()
  }
  await page.locator('[aria-label="上方未完整显示的事件"]').first().waitFor()
  await page.locator('[aria-label="下方未完整显示的事件"]').first().waitFor()
  await page.screenshot({ path: join(output, 'calendar-offscreen-both-edges.png') })
  const scroller = page.locator('[data-calendar-scroll]')
  const beforeScroll = await scroller.evaluate(e => e.scrollTop)
  await page.locator('[aria-label="下方未完整显示的事件"]').getByRole('button', { name: /夜间事件/ }).click()
  await page.waitForFunction(before => document.querySelector('[data-calendar-scroll]').scrollTop > before + 200, beforeScroll)
  await page.waitForFunction(() => { const el = document.querySelector('[data-calendar-scroll]'); const last = window.__lastScroll; window.__lastScroll = [el.scrollTop, Date.now()]; return last && last[0] === el.scrollTop }, undefined, { polling: 200 })
  await page.screenshot({ path: join(output, 'calendar-offscreen-desktop.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  for (const name of ['GitHub', 'Gitee']) {
    await page.getByRole('button', { name: '用户', exact: true }).click()
    await page.getByRole('button', { name: `${name} 登录与同步`, exact: true }).click()
    await page.getByRole('heading', { name: '登录账号，日程随身同步' }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: join(output, `${name.toLowerCase()}-account-mobile.png`) })
    await page.getByRole('button', { name: '关闭工作台' }).click()
  }
  await page.getByRole('button', { name: '课程作业 / 实验', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: join(output, 'course-workspace-mobile.png') })
  await page.getByRole('button', { name: '收起详情面板' }).click()
  await page.reload()
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('eventStore')))
  assert.equal(stored.events.length, 3, 'MCP changes survive a browser reload')
  const rawStorage = await page.evaluate(() => JSON.stringify(localStorage))
  assert.ok(!rawStorage.includes('browser-test-only-password'))
  assert.ok(!rawStorage.includes('synthetic-ai-test-key'))
  assert.ok(!rawStorage.includes('synthetic-gitee-secret'))
  const encrypted = readFileSync(join(directory, 'credentials.enc'), 'utf8')
  assert.ok(!encrypted.includes('browser-test-only-password'))
  assert.ok(!encrypted.includes('synthetic-ai-test-key'))
  assert.ok(!encrypted.includes('synthetic-gitee-secret'))
  assert.deepEqual(errors, [])
  console.log('PASS: desktop/mobile user-menu GitHub/Gitee entry points, task creation/edit/import, AI preview/apply, edge summaries, pairing/CORS, encrypted vault, real MCP read/write/conflict, persistence')
} catch (error) {
  if (browser) { const page = browser.contexts()[0]?.pages()[0]; if (page) { await page.screenshot({ path: join(output, 'workspace-failure.png') }); console.error((await page.locator('body').innerText()).slice(-5000)) } }
  throw error
} finally {
  await browser?.close(); await client.close(); await new Promise(resolve => mockAI.close(resolve))
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + '\\') || resolve(directory).startsWith(resolve(tmpdir()) + '/'))
  rmSync(directory, { recursive: true, force: true })
}
