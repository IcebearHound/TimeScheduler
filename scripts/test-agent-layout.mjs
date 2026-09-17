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
    await page.getByRole('dialog', { name: '设置', exact: true }).waitFor()
    await page.getByLabel('配置名称', { exact: true }).fill('主密钥')
    await page.getByLabel('API Key', { exact: true }).fill('synthetic-key-one')
    await page.getByRole('button', { name: '保存配置', exact: true }).click()
    await page.getByText('已加密保存，可返回 Agent 使用', { exact: true }).waitFor()
    await page.getByRole('button', { name: '＋ 添加 API Key', exact: true }).click()
    await page.getByLabel('配置名称', { exact: true }).fill('备用密钥')
    await page.getByLabel('API Key', { exact: true }).fill('synthetic-key-two')
    await page.getByRole('button', { name: '保存配置', exact: true }).click()
    await page.getByText('已加密保存，可返回 Agent 使用', { exact: true }).waitFor()
    await page.getByRole('button', { name: '返回 Agent', exact: true }).click()
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
    await page.waitForFunction(() => document.querySelector('[data-right-sidebar]')?.textContent.includes('找到这项实验') || document.querySelector('.app-right-panel') === null)
    if (mobile) { await page.locator('[data-mobile-sheet="日程 Agent"]').waitFor({ state: 'hidden' }); await openAgent() }
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
    if (mobile) { await page.evaluate(() => history.back()); await page.locator('[data-mobile-sheet]').waitFor({ state: 'hidden' }); await page.getByRole('button', { name: '待办', exact: true }).click() }
    else await page.getByRole('button', { name: 'TODO', exact: true }).click()
    await page.locator('[data-right-sidebar]').getByRole('button', { name: '实验作业', exact: true }).click()
    assert.equal(await page.getByText('快捷添加作业 / 实验', { exact: true }).count(), 0)
    await page.getByRole('button', { name: '＋ 添加作业 / 实验', exact: true }).click()
    await page.getByRole('menuitem', { name: '快捷添加', exact: true }).click()
    await page.getByRole('dialog', { name: '快捷添加作业 / 实验', exact: true }).waitFor()
    await page.evaluate(() => history.back())
    await page.getByRole('dialog', { name: '快捷添加作业 / 实验', exact: true }).waitFor({ state: 'hidden' })
    assert.ok(await page.getByRole('button', { name: 'TODO', exact: true }).isVisible())
    await page.getByRole('button', { name: '＋ 添加作业 / 实验', exact: true }).click()
    await page.keyboard.press('Escape')
    await page.getByRole('menuitem', { name: '快捷添加', exact: true }).waitFor({ state: 'hidden' })
    assert.ok(await page.getByRole('button', { name: 'TODO', exact: true }).isVisible(), 'Menu Escape retains TODO')
    await page.getByText('从今天开始', { exact: true }).dblclick()
    await page.getByRole('button', { name: '退出全屏', exact: true }).waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: '全屏放大', exact: true }).waitFor()
    if (!mobile) {
      const resize = page.getByRole('separator', { name: '调整右边栏宽度' }), box = await resize.boundingBox()
      const previous = Number(await resize.getAttribute('aria-valuenow'))
      await page.mouse.move(box.x + 3, box.y + 200); await page.mouse.down(); await page.mouse.move(box.x - 90, box.y + 200); await page.mouse.up()
      assert.ok(Number(await resize.getAttribute('aria-valuenow')) > previous + 50)
      await page.locator('button:has(.lucide-panel-left-open)').click()
      await page.getByRole('separator', { name: '调整左边栏宽度' }).focus(); await page.keyboard.press('ArrowRight')
      assert.equal(await page.getByRole('separator', { name: '调整左边栏宽度' }).getAttribute('aria-valuenow'), '300')
    }
    await page.screenshot({ path: resolve(output, `${width}.png`) })
    assert.deepEqual(errors, [])
    await page.reload(); await openAgent()
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="API 配置"] option').length === 2)
    console.log(`Agent, nested dismissal, TODO and layout passed at ${width}px`)
    await page.close()
  }
} catch (e) { if (page) { await page.screenshot({ path: resolve(output, 'failure.png') }); console.error((await page.locator('body').innerText()).replaceAll('双击创建事件\n', '')) }; throw e }
finally { await browser.close(); await new Promise(r => server.close(r)) }
