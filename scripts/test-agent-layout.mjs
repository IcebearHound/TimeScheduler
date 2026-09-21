import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from 'playwright'
const output = resolve('test-results/agent-layout'); await mkdir(output, { recursive: true })
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
    const mobile = width < 500
    page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: mobile })
    page.setDefaultTimeout(10000)
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    await page.addInitScript(() => { localStorage.setItem('hasSeenWelcomeGuide', 'true'); localStorage.setItem('notificationPromptSeen', 'true') })
    let mode = 'clarify', payloads = []
    await page.route('https://api.deepseek.com/**', async route => {
      const body = route.request().postDataJSON(), input = JSON.parse(body.messages[1].content)
      payloads.push({ ...input, model: body.model, authorization: route.request().headers().authorization })
      const action = { op: 'create_event', event: { name: 'Agent 实验', startTime: '2026-10-15T10:00:00+08:00', endTime: '2026-10-15T11:00:00+08:00', chainId: '', typeId: input.archive.eventTypes[0].id, reminders: [], properties: { taskKind: '实验' }, isHighlight: false, priority: 0 } }
      const result = mode === 'edit' ? { intent: 'edit', message: '请确认这项实验安排。', actions: [action] }
        : mode === 'query' ? { intent: 'query', message: '找到这项实验，已定位。', question: '需要查看其他课程吗？', eventIds: [input.archive.events.find(e => e.name === 'Agent 实验').id] }
        : mode === 'import' ? { intent: 'import', message: '打开课程表导入。' }
        : { intent: 'clarify', message: '实验安排在哪一天、几点？' }
      await route.fulfill({ json: { choices: [{ message: { content: JSON.stringify(result) } }] } })
    })
    await page.goto(`http://127.0.0.1:${server.address().port}/TimeScheduler/`)
    await page.locator('.app-left-panel.is-closed').waitFor({ state: 'attached' })
    const openAgent = async () => { if (!await page.getByLabel('发送给 Agent').isVisible()) await page.getByRole('button', { name: mobile ? '日程 Agent' : 'Agent', exact: true }).click() }
    const count = () => page.evaluate(() => JSON.parse(localStorage.getItem('eventStore'))?.events.length || 0)
    await openAgent()
    await page.locator('[data-agent-window]').waitFor(); assert.equal(await page.getByRole('dialog', { name: '设置', exact: true }).count(), 0)
    await page.getByLabel('配置名称', { exact: true }).fill('主密钥')
    await page.getByLabel('API Key', { exact: true }).fill('synthetic-key-one')
    await page.getByRole('button', { name: '保存配置', exact: true }).click()
    await page.getByText('已加密保存，可继续对话', { exact: true }).waitFor()
    await page.getByRole('button', { name: '＋ 添加 API Key', exact: true }).click()
    await page.getByLabel('配置名称', { exact: true }).fill('备用密钥')
    await page.getByLabel('API Key', { exact: true }).fill('synthetic-key-two')
    await page.getByRole('button', { name: '保存配置', exact: true }).click()
    await page.getByText('已加密保存，可继续对话', { exact: true }).waitFor()
    await page.getByRole('button', { name: '完成配置', exact: true }).click()
    await page.getByLabel('API 配置', { exact: true }).selectOption({ label: '主密钥' })
    await page.getByLabel('当前模型', { exact: true }).fill('deepseek-reasoner')
    const before = await count()
    await page.getByLabel('发送给 Agent').fill('添加实验')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await page.getByText('实验安排在哪一天、几点？', { exact: true }).waitFor()
    assert.equal(await count(), before)
    assert.equal(payloads.at(-1).model, 'deepseek-reasoner')
    assert.ok(payloads.at(-1).authorization.includes('synthetic-key-one'))
    mode = 'edit'
    await page.getByLabel('发送给 Agent').fill('10月15日上午10到11点')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await page.getByText('即将应用 1 项操作', { exact: true }).waitFor()
    assert.ok(JSON.parse(payloads.at(-1).instruction).conversation.some(m => m.text === '添加实验'))
    assert.equal(await count(), before)
    await page.getByRole('button', { name: '确认应用到存档', exact: true }).click()
    await page.waitForFunction(n => JSON.parse(localStorage.getItem('eventStore')).events.length === n + 1, before)
    await openAgent()
    await page.getByText('已应用到日程，可整体撤销。', { exact: true }).waitFor()
    await page.waitForFunction(() => document.querySelector('[aria-label="当前模型"]').value === 'deepseek-reasoner')
    mode = 'query'
    await page.getByLabel('发送给 Agent').fill('查实验')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('[data-agent-window]')?.textContent.includes('找到这项实验'))
    if (mobile) { await page.locator('[data-agent-window]').waitFor({ state: 'hidden' }); await openAgent() }
    await page.getByText('找到这项实验，已定位。', { exact: false }).waitFor()
    assert.equal(await count(), before + 1)
    mode = 'import'
    await page.getByLabel('发送给 Agent').fill('导入课程表')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await page.getByRole('button', { name: '关闭导入课表', exact: true }).waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: '关闭导入课表', exact: true }).waitFor({ state: 'hidden' })
    assert.ok(await page.getByLabel('发送给 Agent').isVisible(), 'Escape closes only the nested import dialog')
    assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('synthetic-key'))
    const windowBox = page.locator('[data-agent-window]')
    const firstId = await page.evaluate(() => JSON.parse(localStorage.getItem('time-scheduler-agent-history-v1')).activeId)
    await page.getByLabel('发送给 Agent').fill('第一段未发送草稿')
    await page.getByRole('button', { name: '新建对话', exact: true }).click()
    assert.equal(await page.getByLabel('发送给 Agent').inputValue(), '')
    mode = 'clarify'
    await page.getByLabel('发送给 Agent').fill('第二段独立对话')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await page.getByText('实验安排在哪一天、几点？', { exact: true }).waitFor()
    assert.equal(JSON.parse(payloads.at(-1).instruction).conversation.length, 0)
    await page.getByRole('button', { name: '历史对话', exact: true }).click()
    const row = page.locator('[data-history-id="' + firstId + '"]')
    await row.getByRole('textbox').fill('实验计划'); await row.getByRole('textbox').press('Enter')
    await row.getByRole('button', { name: '打开对话', exact: true }).click()
    assert.equal(await page.getByLabel('发送给 Agent').inputValue(), '第一段未发送草稿')
    await page.getByText('已应用到日程，可整体撤销。', { exact: true }).waitFor()
    await page.getByRole('button', { name: '最小化 Agent', exact: true }).click()
    assert.equal(await windowBox.isVisible(), false)
    await page.getByRole('button', { name: '恢复 Agent', exact: true }).click()
    await page.getByRole('button', { name: '关闭 Agent', exact: true }).click()
    await openAgent()
    assert.equal(await page.getByLabel('发送给 Agent').inputValue(), '第一段未发送草稿')
    if (!mobile) {
      const box = await windowBox.boundingBox()
      await page.mouse.move(box.x + 100, box.y + 25); await page.mouse.down(); await page.mouse.move(box.x - 80, box.y + 55); await page.mouse.up()
      assert.ok((await windowBox.boundingBox()).x < box.x - 100)
      await page.getByRole('button', { name: '放大 Agent', exact: true }).click()
      assert.ok((await windowBox.boundingBox()).width > box.width)
      await page.getByRole('button', { name: '还原 Agent 大小', exact: true }).click()
    }
    const inputBox = await page.getByLabel('发送给 Agent').boundingBox(), controlsBox = await page.getByLabel('Agent 模型与 API').boundingBox()
    assert.ok(controlsBox.y > inputBox.y)
    await page.screenshot({ path: resolve(output, 'floating-' + width + '.png') })
    await page.reload(); await openAgent()
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="API 配置"] option').length === 2)
    assert.equal(await page.getByLabel('发送给 Agent').inputValue(), '第一段未发送草稿')
    assert.equal(await page.getByRole('button', { name: '确认应用到存档', exact: true }).count(), 0)
    await page.getByRole('button', { name: '历史对话', exact: true }).click()
    assert.equal(await page.locator('[data-history-id]').count(), 2)
    await page.getByLabel('搜索历史对话').fill('独立')
    assert.equal(await page.locator('[data-history-id]').count(), 1)
    await page.getByRole('button', { name: '删除对话：第二段独立对话', exact: true }).click()
    await page.getByLabel('搜索历史对话').fill('')
    assert.equal(await page.locator('[data-history-id]').count(), 1)
    await page.getByRole('button', { name: '继续当前对话', exact: true }).click()
    await page.keyboard.press('Escape'); await windowBox.waitFor({ state: 'hidden' })
    await openAgent(); await page.evaluate(() => history.back()); await windowBox.waitFor({ state: 'hidden' })
    assert.deepEqual(errors, [])
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    console.log('Floating Agent, inline API, isolated persistent history and dismissal passed at ' + width + 'px')
    await page.close()
  }
} catch (e) { if (page) { await page.screenshot({ path: resolve(output, 'failure.png') }); console.error((await page.locator('body').innerText()).replaceAll('双击创建事件\n', '')) }; throw e }
finally { await browser.close(); await new Promise(r => server.close(r)) }
