import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from 'playwright'
const output = resolve('test-results/agent-web-intent'); await mkdir(output, { recursive: true })
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
    const errors = [], payloads = [], reads = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => { localStorage.setItem('hasSeenWelcomeGuide', 'true'); localStorage.setItem('notificationPromptSeen', 'true') })
    await page.route('https://r.jina.ai/**', async route => { reads.push(route.request().url()); await route.fulfill({ contentType: 'text/plain', body: '公开课程网页正文' }) })
    await page.route('https://api.deepseek.com/**', async route => {
      const input = JSON.parse(route.request().postDataJSON().messages[1].content)
      payloads.push(input)
      await route.fulfill({ json: { choices: [{ message: { content: JSON.stringify({ intent: 'query', message: `已接收请求 ${payloads.length}` }) } }] } })
    })
    await page.goto(`http://127.0.0.1:${server.address().port}/TimeScheduler/`)
    await page.getByRole('button', { name: width < 500 ? '日程 Agent' : 'Agent', exact: true }).click()
    await page.getByLabel('配置名称', { exact: true }).fill('网页意图测试')
    await page.getByLabel('API Key', { exact: true }).fill('synthetic')
    await page.getByRole('button', { name: '保存配置', exact: true }).click()
    await page.getByText('已加密保存，可继续对话', { exact: true }).waitFor()
    await page.getByRole('button', { name: '完成配置', exact: true }).click()
    const urls = Array.from({ length: 6 }, (_, i) => `https://v.wjx.cn/vm/report${i}.aspx#`)
    const instruction = `将机器学习实验报告提交链接加入每一次实验报告事件：\n从实验1开始：\n${urls.join('\n')}`
    const send = async text => {
      const count = payloads.length + 1
      await page.getByLabel('发送给 Agent').fill(text)
      await page.getByRole('button', { name: '发送', exact: true }).click()
      await page.getByText(`已接收请求 ${count}`, { exact: true }).waitFor()
    }
    await send(instruction)
    assert.equal(reads.length, 0, 'Batch submission links must not contact a reader')
    assert.equal(payloads[0].webPages, undefined)
    assert.equal(JSON.parse(payloads[0].instruction).instruction, instruction, 'Keep complete URLs including fragments and order')
    assert.equal(await page.getByText('每次最多读取 3 个网页链接，请分批发送').count(), 0)
    await send('读取 https://example.com/course 并总结网页内容')
    assert.equal(reads.length, 1)
    assert.equal(payloads[1].webPages[0].text, '公开课程网页正文')
    await send(`不要读取网页，只将这些链接保存到任务：\n${urls.join('\n')}`)
    assert.equal(reads.length, 1, 'Previously read context does not authorize reading new URLs')
    await page.getByLabel('发送给 Agent').fill(`请读取以下网页：\n${urls.join('\n')}`)
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: '每次最多读取 3 个网页链接' }).waitFor()
    assert.equal(payloads.length, 3)
    assert.equal(reads.length, 1, 'Over-limit explicit reading must not start partial network requests')
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('PASS: 6 submission URLs reach the Agent unchanged without web requests, explicit reading works, opt-out and actual reading limits on desktop/mobile')
} catch (error) { if (page && !page.isClosed()) await page.screenshot({ path: resolve(output, 'failure.png') }); throw error }
finally { await browser.close(); await new Promise(r => server.close(r)) }
