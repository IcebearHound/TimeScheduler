import { AgentAttachment } from '../integrations/attachments'
import * as XLSX from 'xlsx'

export const agentFileAccept = '.txt,.md,.csv,.tsv,.json,.ics,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp'
export async function readAgentFile(file: File): Promise<AgentAttachment> {
  if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name}：单个文件不能超过 5 MB`)
  if (!file.size) throw new Error(`${file.name}：文件为空`)
  if (file.name.length > 255) throw new Error('文件名不能超过 255 个字符')
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mime: string | undefined = ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf' } as Record<string, string>)[ext]
  if (mime) {
    const signature = new TextDecoder('latin1').decode(bytes.slice(0, 12))
    const valid = mime === 'application/pdf' ? signature.startsWith('%PDF-') : mime === 'image/png' ? bytes[0] === 137 && signature.slice(1, 4) === 'PNG' : mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : signature.startsWith('RIFF') && signature.slice(8, 12) === 'WEBP'
    if (!valid) throw new Error(`${file.name}：文件内容与扩展名不符`)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
    const data = btoa(binary)
    return mime === 'application/pdf' ? { kind: 'pdf', name: file.name, mimeType: mime, data } : { kind: 'image', name: file.name, mimeType: mime as 'image/png' | 'image/jpeg' | 'image/webp', data }
  }
  let text: string
  if (['xlsx', 'xls'].includes(ext)) {
    const book = XLSX.read(bytes, { type: 'array' })
    text = book.SheetNames.map(sheet => `工作表：${sheet}\n${XLSX.utils.sheet_to_csv(book.Sheets[sheet], { FS: '\t' })}`).join('\n\n')
  } else if (['txt', 'md', 'csv', 'tsv', 'json', 'ics'].includes(ext)) {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } else throw new Error(`${file.name}：暂不支持此格式，请使用文本、表格、PDF 或图片`)
  if (!text.trim()) throw new Error(`${file.name}：没有可读取的文字`)
  if (text.length > 60000) throw new Error(`${file.name}：文字超过 6 万字，请拆分文件后上传`)
  return { kind: 'text', name: file.name, text }
}
