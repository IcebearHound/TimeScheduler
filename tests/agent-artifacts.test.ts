import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { generatedFileBlob } from '../src/utils/agentDownloads'
import { messageLinks, requestedWebLinks, publicWebUrl, readAgentWebPage } from '../src/utils/agentWeb'
import { generatedFileSchema } from '../src/integrations/agentArtifacts'

test('generated files download UTF-8 text and genuine Excel cells without executing formulas', async () => {
  assert.equal(await generatedFileBlob({ name: '计划.md', content: '# 课程安排' }).text(), '# 课程安排')
  const blob = generatedFileBlob({ name: '课表.xlsx', content: JSON.stringify([['课程', '时间'], ['图形学', '19:00'], ['=1+1', 4]]) })
  const book = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
  assert.equal(book.Sheets.Sheet1.A2.v, '图形学')
  assert.equal(book.Sheets.Sheet1.A3.t, 's')
  assert.equal(book.Sheets.Sheet1.A3.f, undefined)
  assert.throws(() => generatedFileSchema.parse({ name: '../秘密.txt', content: 'x' }))
  assert.throws(() => generatedFileSchema.parse({ name: '任务.xlsx', content: '{}'}))
  assert.throws(() => generatedFileSchema.parse({ name: '任务.json', content: 'invalid'}))
})

test('web links normalize and reject local or credential URLs', () => {
  assert.deepEqual(messageLinks('读取 https://example.com/a 和 [课表](https://example.org/b)。'), ['https://example.com/a', 'https://example.org/b'])
  assert.equal(publicWebUrl('https://example.com/a#b'), 'https://example.com/a')
  for (const url of ['http://localhost/', 'http://127.0.0.1/', 'http://192.168.1.1/', 'http://[::1]/', 'https://user:secret@example.com/', 'file:///tmp/a', 'https://internal.local/']) assert.throws(() => publicWebUrl(url))
})

test('web reader uses only the reader credential, reports failures, and bounds extracted content', async t => {
  const calls: string[] = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push(String(url))
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer reader-only')
    return new Response('课程正文'.repeat(10000))
  })
  const page = await readAgentWebPage('https://example.com/course', new AbortController().signal, 'reader-only')
  assert.equal(calls[0], 'https://r.jina.ai/https://example.com/course')
  assert.equal(page.text.length, 20000); assert.equal(page.truncated, true)
  assert.ok((await readAgentWebPage('http://127.0.0.1', new AbortController().signal)).error)
  assert.equal(calls.length, 1)
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 401 }))
  assert.match((await readAgentWebPage('https://example.com', new AbortController().signal)).error!, /Reader Key/)
})


test('web reading requires explicit intent; submission links remain ordinary task data', () => {
  const urls = Array.from({ length: 6 }, (_, i) => `https://v.wjx.cn/vm/report${i}.aspx#`)
  const links = urls.join('\n')
  assert.deepEqual(requestedWebLinks(`将机器学习实验报告提交链接加入每一次实验报告事件：从实验1开始：\n${links}`), [])
  for (const prefix of ['保存这些链接', '从文本中提取链接填写到事件', '这些网址是什么意思', '不要读取网页，只保存链接', '不用打开这些链接', 'Do not read these URLs', '']) {
    assert.deepEqual(requestedWebLinks(`${prefix}\n${links}`), [], prefix)
  }
  assert.deepEqual(requestedWebLinks(`请读取以下网页：\n${links}`), urls)
  assert.deepEqual(requestedWebLinks('读取 https://example.com/course 并生成安排文件'), ['https://example.com/course'])
  assert.deepEqual(requestedWebLinks('请总结这个网页的内容 https://example.com/course'), ['https://example.com/course'])
  assert.deepEqual(requestedWebLinks('Please summarize https://example.com/course'), ['https://example.com/course'])
  assert.deepEqual(requestedWebLinks('读取 https://example.com/read；把链接加入报告：\nhttps://example.com/store'), ['https://example.com/read'])
  assert.deepEqual(requestedWebLinks('https://example.com/read 帮我总结一下'), ['https://example.com/read'])
  assert.deepEqual(requestedWebLinks('保存 https://example.com/读取网页'), [])
  assert.deepEqual(requestedWebLinks('把“读取网页”作为标题，链接为 https://example.com'), [])
  assert.deepEqual(requestedWebLinks('> 读取 https://example.com\n仅保存上述链接'), [])
})
