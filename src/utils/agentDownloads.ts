import * as XLSX from 'xlsx'
import { GeneratedFile, generatedFileSchema } from '../integrations/agentArtifacts'

export function generatedFileBlob(input: GeneratedFile): Blob {
  const file = generatedFileSchema.parse(input)
  const ext = file.name.split('.').pop()!.toLowerCase()
  if (ext === 'xlsx') {
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(JSON.parse(file.content)), 'Sheet1')
    return new Blob([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  }
  const mime = ({ txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json', ics: 'text/calendar' } as Record<string, string>)[ext]
  return new Blob([ext === 'csv' ? '\ufeff' : '', file.content], { type: `${mime};charset=utf-8` })
}
export function downloadAgentFile(file: GeneratedFile) {
  const url = URL.createObjectURL(generatedFileBlob(file))
  const link = document.createElement('a'); link.href = url; link.download = file.name
  document.body.appendChild(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
