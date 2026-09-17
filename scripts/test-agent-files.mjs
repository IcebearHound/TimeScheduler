import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from 'playwright'

const output = resolve('test-results/agent-files'); await mkdir(output, { recursive: true })
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
    await page.addInitScript(() => { localStorage.setItem('hasSeenWelcomeGuide', 'true'); localStorage.setItem('notificationPromptSeen', 'true') })
    let fail = false, payloads = [], reads = 0
    await page.route('https://r.jina.ai/**', async route => { reads++; assert.equal(route.request().headers().authorization, 'Bearer reader-synthetic'); await route.fulfill({ contentType: 'text/plain', body: '公开课程网页：周一晚 19:00 图形学实验' }) })
    await page.route('https://api.deepseek.com/**', async route => {
      const body = route.request().postDataJSON(), parts = body.messages[1].content
      payloads.push(JSON.parse(Array.isArray(parts) ? parts[0].text : parts))
      if (fail) { await route.fulfill({ status: 503, body: '{}' }); return }
      await route.fulfill({ json: { choices: [{ message: { content: JSON.stringify({ intent: 'query', message: '已根据资料生成文件', files: [{ name: '安排.md', content: '# 安排\n周一 19:00 图形学实验' }] }) } }] } })
    })
    await page.goto(`http://127.0.0.1:${server.address().port}/TimeScheduler/`)
    await page.getByRole('button', { name: width < 500 ? '日程 Agent' : 'Agent', exact: true }).click()
    const settings = page.getByRole('dialog', { name: '设置', exact: true })
    await settings.getByLabel('配置名称', { exact: true }).fill('测试配置')
    await settings.getByLabel('API Key', { exact: true }).fill('synthetic')
    await settings.getByRole('button', { name: '保存配置', exact: true }).click()
    await settings.getByText('已加密保存，可返回 Agent 使用', { exact: true }).waitFor()
    await settings.getByText('外部 MCP 连接', { exact: true }).click()
    await settings.getByLabel('本机配对码').waitFor()
    await settings.getByText('网页读取服务', { exact: true }).click()
    await settings.getByLabel('Jina Reader Key').fill('reader-synthetic')
    await settings.getByRole('button', { name: '保存网页密钥', exact: true }).click()
    await settings.getByText('网页读取密钥已加密保存').waitFor()
    await settings.getByRole('button', { name: '返回 Agent', exact: true }).click()
    assert.equal(await page.locator('[data-right-sidebar]').getByText('外部 MCP 连接', { exact: true }).count(), 0)
    const fileInput = page.getByLabel('上传 Agent 附件'), name = '课程.txt'
    await fileInput.setInputFiles([{ name, mimeType: 'text/plain', buffer: Buffer.from('附件内容：周一 19:00 图形学实验') }, { name: '课表.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6AAAAAElFTkSuQmCC', 'base64') }, { name: '课程.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\n% synthetic upload fixture') }])
    await page.getByRole('button', { name: '移除附件：课程.txt' }).waitFor()
    await page.getByLabel('发送给 Agent').fill('读取 https://example.com/course 并生成安排文件')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await page.getByRole('button', { name: '下载 安排.md', exact: true }).waitFor()
    assert.equal(payloads.at(-1).attachments.length, 3)
    assert.equal(payloads.at(-1).attachments[0].text, '附件内容：周一 19:00 图形学实验')
    assert.match(payloads.at(-1).webPages[0].text, /公开课程网页/)
    assert.equal(reads, 1)
    const downloaded = page.waitForEvent('download')
    await page.getByRole('button', { name: '下载 安排.md', exact: true }).click()
    const download = await downloaded
    assert.equal(download.suggestedFilename(), '安排.md')
    const chunks = []; for await (const chunk of await download.createReadStream()) chunks.push(chunk)
    assert.match(Buffer.concat(chunks).toString(), /图形学实验/)
    await page.getByRole('button', { name: '移除附件：课程.txt' }).click()
    await fileInput.setInputFiles({ name: '重试.txt', mimeType: 'text/plain', buffer: Buffer.from('失败重试的附件') })
    await page.getByRole('button', { name: '移除附件：重试.txt' }).waitFor()
    fail = true
    await page.getByLabel('发送给 Agent').fill('继续')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await page.getByRole('alert').waitFor()
    assert.equal(await page.getByLabel('发送给 Agent').inputValue(), '继续')
    assert.equal(await page.getByRole('button', { name: '移除附件：重试.txt' }).count(), 1)
    fail = false
    await page.getByRole('button', { name: '清空对话', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: /^移除附件：/ }).count(), 0)
    assert.equal(await page.getByRole('button', { name: /^下载 / }).count(), 0)
    const stored = await page.evaluate(() => JSON.stringify(localStorage))
    assert.ok(!stored.includes('reader-synthetic') && !stored.includes('附件内容'))
    await fileInput.setInputFiles({ name: '不支持.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') })
    await page.getByRole('alert').filter({ hasText: '暂不支持' }).waitFor()
    await page.screenshot({ path: resolve(output, `${width}.png`) })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('PASS: uploads and retry/removal, reader context and credential isolation, generated file download, MCP configuration location, 1440/390/320px')
} catch (error) { if (page) await page.screenshot({ path: resolve(output, 'failure.png') }); throw error }
finally { await browser.close(); await new Promise(r => server.close(r)) }
