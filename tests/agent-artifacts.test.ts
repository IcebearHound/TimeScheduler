import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { generatedFileBlob } from '../src/utils/agentDownloads'
import { messageLinks, publicWebUrl, readAgentWebPage } from '../src/utils/agentWeb'
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
