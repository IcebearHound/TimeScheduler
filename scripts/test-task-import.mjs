import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from 'playwright'

const output = resolve('test-results/task-import'); await mkdir(output, { recursive: true })
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
    page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 500 })
    page.setDefaultTimeout(10000)
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    await page.clock.install({ time: new Date('2026-09-21T08:00:00+08:00') })
    await page.addInitScript(() => {
      localStorage.setItem('hasSeenWelcomeGuide', 'true'); localStorage.setItem('notificationPromptSeen', 'true')
      if (localStorage.getItem('eventStore')) return
      const stamp = new Date().toISOString()
      const chain = id => [id, { id, name: '同名课程', typeId: 'course', color: '#6366f1', defaultReminders: [], createdAt: stamp, updatedAt: stamp }]
      const event = (id, chainId, day) => [id, { id, name: id, chainId, typeId: 'lab', startTime: `2026-09-${day}T14:00:00+08:00`, endTime: `2026-09-${day}T16:00:00+08:00`, properties: { taskKind: '实验课' }, reminders: [], priority: 0, isHighlight: false, createdAt: stamp, updatedAt: stamp }]
      localStorage.setItem('eventStore', JSON.stringify({ events: [event('下周甲', 'a', 28), event('下周乙', 'b', 29)], eventChains: [chain('a'), chain('b')], eventTypes: [['course', { id: 'course', name: '课程', category: 'course', emoji: '📚', color: '#6366f1' }], ['lab', { id: 'lab', name: '实验', category: 'lab', emoji: '🧪', color: '#16a34a' }]], semesterStartDate: stamp }))
    })
    await page.goto(`http://127.0.0.1:${server.address().port}/TimeScheduler/`)
    if (width < 500) await page.getByRole('button', { name: '待办', exact: true }).click()
    await page.locator('[data-right-sidebar]').getByRole('button', { name: '实验作业', exact: true }).click()
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('eventStore')))
    const open = async name => { await page.getByRole('button', { name: '＋ 添加作业 / 实验', exact: true }).click(); await page.getByRole('menuitem', { name, exact: true }).click() }
    const save = async () => { await page.getByRole('button', { name: '保存任务', exact: true }).click(); await page.getByText('已保存到事件链，可撤销', { exact: true }).waitFor() }
    await open('快捷添加')
    const options = await page.getByLabel('课程', { exact: true }).locator('option').allTextContents()
    assert.equal(options.filter(s => s.includes('同名课程')).length, 2)
    assert.equal(new Set(options).size, options.length, 'Duplicate course names need distinct option labels')
    await page.getByLabel('课程', { exact: true }).selectOption('b')
    await page.getByLabel('名称', { exact: true }).fill('新建带编号实验')
    await page.getByLabel('类别', { exact: true }).selectOption('实验课')
    await page.getByLabel('上课开始时间', { exact: true }).fill('2026-09-21T14:00')
    await page.getByLabel('上课结束时间', { exact: true }).fill('2026-09-21T16:00')
    await page.getByLabel('本次编号', { exact: true }).fill('0')
    await page.getByRole('button', { name: '填入下次实验课时间', exact: true }).click()
    assert.equal(await page.getByLabel('新增验收截止时间', { exact: true }).inputValue(), '2026-09-29T14:00', 'Next class lookup uses the selected chain ID')
    await page.getByRole('checkbox', { name: '每周重复', exact: true }).check()
    await page.getByLabel('重复次数', { exact: true }).fill('2')
    await page.getByRole('checkbox', { name: '该课程遇法定节假日自动跳过作业／实验', exact: true }).check()
    await save()
    let data = await stored(), added = data.events.map(([, e]) => e).filter(e => e.name === '新建带编号实验')
    assert.equal(data.eventChains.length, 2)
    assert.equal(added.length, 4); assert.ok(added.every(e => e.chainId === 'b'))
    assert.equal(new Map(data.eventChains).get('a').taskRules, undefined)
    assert.equal(new Map(data.eventChains).get('b').taskRules.labAnchor.number, 0)
    assert.equal(new Map(data.eventChains).get('b').taskRules.skipHolidays, true)
    await page.getByLabel('灯珠显示天数').selectOption('14')
    const classes = added.filter(e => e.properties.taskKind === '实验课').sort((a, b) => a.startTime.localeCompare(b.startTime))
    for (const [i, e] of classes.entries()) assert.equal(await page.locator(`table [data-task-lamp="${e.id}"] sub`).textContent(), String(i))

    await open('快捷添加')
    await page.getByLabel('课程', { exact: true }).selectOption('__new_course__')
    await page.getByLabel('新课程名称', { exact: true }).fill(' 同名课程 ')
    await page.getByLabel('名称', { exact: true }).fill('精确选择作业')
    await page.getByLabel('作业截止时间', { exact: true }).fill('2026-09-21T23:59')
    await page.getByRole('button', { name: '保存任务', exact: true }).click()
    await page.getByText('已有同名课程，请在课程下拉框中选择已有课程', { exact: true }).waitFor()
    assert.equal((await stored()).eventChains.length, 2)
    await page.getByLabel('课程', { exact: true }).selectOption('a'); await save()
    data = await stored(); const homework = data.events.map(([, e]) => e).find(e => e.name === '精确选择作业')
    assert.equal(homework.chainId, 'a'); assert.equal(data.eventChains.length, 2)
    assert.equal(await page.locator('tr[data-assignment-course="a"]').count(), 2, 'A course can have multiple type rows')
    const row = page.locator(`tr[data-assignment-course="a"][data-assignment-type="${homework.typeId}"]`)
    await row.getByRole('button', { name: /事件类型$/ }).click()
    await page.getByRole('dialog', { name: '整行事件类型', exact: true }).getByRole('button', { name: '考试', exact: true }).click()
    await page.getByText('该行事件类型已更新，可撤销', { exact: true }).waitFor()
    data = await stored()
    assert.equal(data.events.find(([id]) => id === homework.id)[1].properties.taskKind, '考试')
    assert.ok(data.events.filter(([id]) => id !== homework.id).every(([, e]) => e.typeId === 'lab'), 'Changing a row must preserve the other rows and courses')
    await page.screenshot({ path: resolve(output, `course-rows-${width}.png`) })

    await open('快捷添加')
    await page.getByLabel('课程', { exact: true }).selectOption('__new_course__')
    await page.getByLabel('新课程名称', { exact: true }).fill('导入课程')
    await page.getByLabel('名称', { exact: true }).fill('手工练习')
    await page.getByLabel('作业截止时间', { exact: true }).fill('2026-09-20T23:59')
    await page.getByLabel('本次编号', { exact: true }).fill('0'); await save()
    assert.equal((await stored()).eventChains.length, 3)
    await open('从表格获取')
    const table = page.getByLabel('粘贴任务表格')
    await table.fill('课程\t名称\t截止日期\n导入课程\t第三次作业\t2026-09-21\n导入课程\t作业四\t2026-09-22')
    const beforeImport = await stored()
    await page.getByRole('button', { name: '预览粘贴内容', exact: true }).click()
    const review = page.getByRole('dialog', { name: '确认表格任务编号', exact: true })
    assert.equal(await review.getByLabel('第 1 项编号', { exact: true }).inputValue(), '3')
    assert.equal(await review.getByLabel('第 2 项编号', { exact: true }).inputValue(), '4')
    assert.deepEqual(await stored(), beforeImport, 'Recognition must not write before confirmation and apply')
    await review.getByLabel('第 2 项编号', { exact: true }).fill('6')
    await review.getByRole('button', { name: '确认编号并预览', exact: true }).click()
    await review.getByRole('alert').waitFor(); assert.deepEqual(await stored(), beforeImport)
    await review.getByLabel('第 2 项编号', { exact: true }).fill('4')
    await page.screenshot({ path: resolve(output, `number-confirm-${width}.png`) })
    await review.getByRole('button', { name: '确认编号并预览', exact: true }).click()
    await review.waitFor({ state: 'hidden' }); assert.deepEqual(await stored(), beforeImport)
    await page.getByRole('button', { name: '应用到事件链', exact: true }).click()
    await page.getByText('已导入 2 项，可整体撤销', { exact: true }).waitFor()
    const imported = await stored(), importChain = imported.eventChains.find(([, c]) => c.name === '导入课程')[1]
    assert.equal(importChain.taskRules.homeworkAnchor.number, 3)
    assert.ok(imported.events.some(([id]) => id === importChain.taskRules.homeworkAnchor.eventId))
    await table.fill('课程\t名称\t截止日期\t编号\n导入课程\t普通练习\t2026-09-23\t0')
    await page.getByRole('button', { name: '预览粘贴内容', exact: true }).click()
    assert.equal(await review.getByLabel('第 1 项编号', { exact: true }).inputValue(), '0')
    await review.getByRole('button', { name: '不导入编号', exact: true }).click()
    await page.getByRole('button', { name: '应用到事件链', exact: true }).click()
    await page.getByText('已导入 1 项，可整体撤销', { exact: true }).waitFor()
    assert.deepEqual(new Map((await stored()).eventChains).get(importChain.id).taskRules, importChain.taskRules)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('PASS: exact duplicate course selection, no accidental new chains, next-class lookup, zero/weekly numbering, isolated course/type rows, import recognition/confirmation/conflict/skip, desktop and mobile')
} catch (e) {
  if (page && !page.isClosed()) { console.error(await page.locator('[role="alert"], [role="status"]').allTextContents()); await page.screenshot({ path: resolve(output, 'failure.png') }) }
  throw e
} finally { await browser.close(); await new Promise(r => server.close(r)) }
