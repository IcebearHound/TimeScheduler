import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { readAgentFile } from '../src/utils/agentFiles'
import { attachmentsSchema } from '../src/integrations/attachments'

test('Agent reads text and all spreadsheet sheets; rejects empty, oversized and unsupported files', async () => {
  const plain = await readAgentFile(new File(['周一晚计算机实验'], '课表.txt'))
  assert.deepEqual(plain, { kind: 'text', name: '课表.txt', text: '周一晚计算机实验' })
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['课程', '时间'], ['图形学', '19:00']]), '课表')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['数据库实验']]), '实验')
  const result = await readAgentFile(new File([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], '课程.xlsx'))
  assert.equal(result.kind, 'text')
  if (result.kind === 'text') { assert.match(result.text, /图形学/); assert.match(result.text, /数据库实验/); assert.match(result.text, /19:00/) }
  await assert.rejects(readAgentFile(new File([], '空.txt')), /为空/)
  await assert.rejects(readAgentFile(new File(['not png'], '图.png')), /不符/)
  await assert.rejects(readAgentFile(new File(['content'], '文件.exe')), /暂不支持/)
  await assert.rejects(readAgentFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], '过大.txt')), /5 MB/)
  assert.throws(() => attachmentsSchema.parse(Array(6).fill(plain)))
  assert.throws(() => attachmentsSchema.parse([{ kind: 'image', name: 'x', mimeType: 'image/png', data: 'https://example.com/x.png' }]))
})
