import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import worker from '../worker/index.ts'

const output = resolve('test-results/cloud'); await mkdir(output, { recursive: true })
const dist = resolve(output, 'dist')
const env = { APP_URL: '', AUTH_STATE_SECRET: 'synthetic-state-secret-for-browser-testing', GITHUB_CLIENT_ID: 'synthetic-github-id', GITHUB_CLIENT_SECRET: 'synthetic-github-secret', GITEE_CLIENT_ID: 'synthetic-gitee-id', GITEE_CLIENT_SECRET: 'synthetic-gitee-secret' }
const repos = new Map(), codes = new Set(), errors = [], requests = []
const originalFetch = globalThis.fetch
let sequence = 0, refreshes = 0
globalThis.fetch = async (url, init) => {
  const uri = new URL(url), provider = uri.hostname === 'gitee.com' ? 'gitee' : 'github'
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status })
  if (uri.pathname.endsWith('/access_token') || uri.pathname === '/oauth/token') {
    const params = init.body
    assert.equal(params.get('client_secret'), `synthetic-${provider}-secret`)
    if (params.get('grant_type') === 'refresh_token') {
      assert.equal(params.get('refresh_token'), `synthetic-${provider}-refresh-token`)
      ++refreshes
      return json({ access_token: `synthetic-${provider}-access-token`, refresh_token: `synthetic-${provider}-refresh-token`, expires_in: 3600 })
    }
    assert.ok(params.get('code') && !codes.has(params.get('code'))); codes.add(params.get('code'))
    return json({ access_token: `synthetic-${provider}-access-token`, refresh_token: `synthetic-${provider}-refresh-token`, expires_in: provider === 'gitee' ? 1 : 3600 })
  }
  assert.equal(init.headers.Authorization, `Bearer synthetic-${provider}-access-token`)
  assert.equal(init.redirect, 'error')
  const path = uri.pathname.replace('/api/v5', ''), repo = repos.get(provider)
  if (path === '/user') return json({ login: 'test-user' })
  if (path === '/user/repos') {
    const data = JSON.parse(init.body); assert.equal(data.private, true); assert.equal(data.name, 'time-scheduler-private')
    assert.ok(!repo); repos.set(provider, { private: true, default_branch: 'main', html_url: `https://${provider}.com/test-user/time-scheduler-private`, file: undefined })
    return json(repos.get(provider), 201)
  }
  if (path === '/repos/test-user/time-scheduler-private') return json(repo || {}, repo ? 200 : 404)
  if (path.endsWith('/contents/time-scheduler-archive.json')) {
    if (init.method === 'GET') return json(repo?.file || {}, repo?.file ? 200 : 404)
    const data = JSON.parse(init.body)
    if (data.sha !== repo.file?.sha) return json({ error: 'conflict' }, 409)
    repo.file = { encoding: 'base64', content: data.content, sha: `revision-${++sequence}` }
    return json({ content: repo.file })
  }
  throw new Error(`Unexpected upstream request: ${path}`)
}
const snapshot = provider => { const file = repos.get(provider)?.file; return file ? JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')).snapshot : undefined }
const waitUntil = async (predicate, message) => { for (let i = 0; i < 150; i++) { if (await predicate()) return; await new Promise(r => setTimeout(r, 100)) }; throw new Error(message) }
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, env.APP_URL)
    if (url.pathname.startsWith('/TimeScheduler/')) {
      const path = resolve(dist, url.pathname.slice('/TimeScheduler/'.length) || 'index.html')
      assert.ok(path.startsWith(dist + '/') || path.startsWith(dist + '\\'))
      const data = await readFile(path)
      res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(path)] || 'application/octet-stream' }); res.end(data)
    } else {
      const chunks = []; for await (const chunk of req) chunks.push(chunk)
      const request = new Request(url, { method: req.method, headers: req.headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) })
      const response = await worker.fetch(request, env)
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()))
    }
  } catch (e) { errors.push(e.message); res.writeHead(500); res.end('Test server failure') }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
env.APP_URL = `http://127.0.0.1:${server.address().port}/TimeScheduler/`
let browser
try {
  await new Promise((resolveBuild, reject) => {
    const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', dist], { env: { ...process.env, VITE_AUTH_SERVICE_URL: new URL(env.APP_URL).origin }, stdio: 'pipe', windowsHide: true })
    let output = ''; child.stdout.on('data', d => { output += d }); child.stderr.on('data', d => { output += d })
    child.on('error', reject); child.on('exit', code => code === 0 ? resolveBuild() : reject(new Error(output)))
  })
  browser = await chromium.launch({ headless: true })
  const createDevice = async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message)); page.on('request', r => requests.push(r.url()))
    await context.addInitScript(() => { localStorage.setItem('hasSeenWelcomeGuide', 'true'); localStorage.setItem('notificationPromptSeen', 'true') })
    for (const provider of ['github', 'gitee']) await context.route(`https://${provider}.com/**`, route => {
      const url = new URL(route.request().url()), callback = new URL(url.searchParams.get('redirect_uri'))
      callback.searchParams.set('code', `synthetic-${provider}-code-${crypto.randomUUID()}`); callback.searchParams.set('state', url.searchParams.get('state'))
      return route.fulfill({ status: 302, headers: { Location: callback.href } })
    })
    await page.goto(env.APP_URL)
    return { page, context }
  }
  const openAccount = async (page, provider = 'github') => {
    await page.getByRole('button', { name: '用户', exact: true }).click()
    await page.getByRole('button', { name: `${provider === 'github' ? 'GitHub' : 'Gitee'} 登录与同步`, exact: true }).click()
    await page.getByRole('heading', { name: '登录账号，日程随身同步' }).waitFor()
    assert.equal(await page.getByRole('dialog').getByText(/npm|配对码|Client Secret|Client ID|口令/).count(), 0)
  }
  const login = async (device, provider) => {
    await openAccount(device.page, provider)
    await device.page.getByRole('button', { name: `使用 ${provider === 'github' ? 'GitHub' : 'Gitee'} 账号登录` }).click()
    await device.page.getByText('所有更改已同步', { exact: true }).waitFor()
    assert.equal(new URL(device.page.url()).hash, '')
  }
  const addTask = async (page, name) => {
    if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: '关闭工作台' }).click()
    await page.getByRole('button', { name: '课程作业 / 实验', exact: true }).click()
    await page.getByLabel('课程', { exact: true }).fill('高等数学')
    await page.getByLabel('名称', { exact: true }).fill(name)
    await page.getByLabel('验收截止时间').fill('2026-10-18T23:59')
    await page.getByRole('button', { name: '保存任务', exact: true }).click()
    await page.getByText('已保存到事件链，可撤销', { exact: true }).waitFor()
    await page.getByRole('button', { name: '收起详情面板' }).click()
  }
  const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('eventStore')).events.map(([, e]) => e))
  const first = await createDevice()
  await login(first, 'github')
  await first.page.screenshot({ path: resolve(output, 'mobile-signed-in.png') })
  await addTask(first.page, '自动同步作业')
  await waitUntil(() => snapshot('github')?.events.some(e => e.name === '自动同步作业'), 'Automatic upload did not run')
  const second = await createDevice(); await login(second, 'github')
  assert.equal((await stored(second.page)).length, 1)
  await first.context.setOffline(true)
  await addTask(first.page, '离线添加作业')
  assert.equal(snapshot('github').events.length, 1)
  await first.context.setOffline(false)
  await waitUntil(() => snapshot('github').events.length === 2, 'Offline changes were not uploaded after reconnect')
  await second.page.reload()
  await waitUntil(async () => (await stored(second.page)).length === 2, 'Second device did not automatically recover changes')
  assert.equal(codes.size, 2, 'Reload must reuse the encrypted login instead of another OAuth flow')
  // Create competing edits while both devices are offline, then reconnect in order.
  const editNotes = async (page, notes) => {
    if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: '关闭工作台' }).click()
    await page.getByRole('button', { name: '课程作业 / 实验', exact: true }).click()
    await page.getByText(/全部课程任务 ·/).click()
    await page.getByRole('dialog').getByRole('button', { name: /自动同步作业/ }).click()
    await page.getByLabel('备注', { exact: true }).fill(notes)
    await page.getByRole('button', { name: '保存任务', exact: true }).click()
    await page.getByText('已保存到事件链，可撤销', { exact: true }).waitFor()
    await page.getByRole('button', { name: '收起详情面板' }).click()
  }
  await first.context.setOffline(true); await second.context.setOffline(true)
  await editNotes(first.page, '手机一的备注'); await editNotes(second.page, '手机二的备注')
  await first.context.setOffline(false)
  await waitUntil(() => snapshot('github').events.find(e => e.name === '自动同步作业')?.properties.notes === '手机一的备注', 'First edit not synced')
  await second.context.setOffline(false); await openAccount(second.page)
  await second.page.getByText('两台设备同时修改了同一项内容，自动同步已暂停。', { exact: true }).waitFor()
  await second.page.getByText(/同时修改了事件“自动同步作业” · 详情 · 备注/).waitFor()
  assert.equal(snapshot('github').events.find(e => e.name === '自动同步作业').properties.notes, '手机一的备注')
  await second.page.screenshot({ path: resolve(output, 'mobile-conflict.png') })
  await second.page.getByRole('button', { name: '采用云端版本' }).click()
  await second.page.getByText('所有更改已同步', { exact: true }).waitFor()
  const encryption = await first.page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('time-scheduler-private', 1); r.onsuccess = () => resolve(r.result); r.onerror = reject })
    const read = name => new Promise(resolve => { const r = db.transaction('vault').objectStore('vault').get(name); r.onsuccess = () => resolve(r.result) })
    const key = await read('device-key'), account = await read('account')
    let exported = false; try { await crypto.subtle.exportKey('raw', key); exported = true } catch {}
    return { extractable: key.extractable, exported, ciphertext: [...new Uint8Array(account.data)], storage: JSON.stringify(localStorage) + JSON.stringify(sessionStorage) }
  })
  assert.equal(encryption.extractable, false); assert.equal(encryption.exported, false)
  assert.ok(!encryption.storage.includes('access-token')); assert.ok(!new TextDecoder().decode(new Uint8Array(encryption.ciphertext)).includes('access-token'))
  const gitee = await createDevice(); await login(gitee, 'gitee'); await addTask(gitee.page, 'Gitee 手机作业')
  await waitUntil(() => snapshot('gitee')?.events.length === 1, 'Gitee automatic sync failed')
  await openAccount(gitee.page, 'gitee'); await gitee.page.getByText('所有更改已同步', { exact: true }).waitFor()
  assert.equal(refreshes, 1, 'Expiring Gitee token must renew automatically')
  await gitee.page.screenshot({ path: resolve(output, 'gitee-mobile-sync.png') })
  const otherTab = await gitee.context.newPage()
  await otherTab.goto(env.APP_URL); await openAccount(otherTab, 'gitee')
  await otherTab.getByText('所有更改已同步', { exact: true }).waitFor()
  await gitee.page.getByRole('button', { name: '退出登录', exact: true }).click()
  await gitee.page.getByRole('button', { name: '使用 Gitee 账号登录' }).waitFor()
  await otherTab.evaluate(() => window.dispatchEvent(new Event('focus')))
  await otherTab.getByRole('button', { name: '使用 Gitee 账号登录' }).waitFor()
  await otherTab.close()
  await gitee.page.reload(); await openAccount(gitee.page, 'gitee')
  await gitee.page.getByRole('button', { name: '使用 Gitee 账号登录' }).waitFor()
  assert.equal((await stored(gitee.page)).length, 1)
  assert.ok(!requests.some(url => url.includes(':4318') || url.includes('access-token') || url.includes('refresh-token')))
  assert.deepEqual(errors, [])
  console.log('PASS: mobile OAuth redirect for GitHub/Gitee, no local daemon/password/pairing, encrypted nonextractable browser key, auto private repo/readback, offline reconnect, second-device restore, reload without relogin, automatic token renewal, readable conflict resolution, cross-tab logout preserves events')
} catch (e) {
  for (const [i, context] of (browser?.contexts() || []).entries()) { const page = context.pages()[0]; if (page) { await page.screenshot({ path: resolve(output, `failure-${i}.png`) }); console.error((await page.locator('body').innerText()).slice(0, 2500)) } }
  throw e
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); globalThis.fetch = originalFetch }
