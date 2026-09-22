import type { AssignmentRow } from './assignmentTable'

export interface TaskNumberSuggestion { row: number; number: number | undefined; source: string }
function parseNumber(raw: string): number | undefined {
  const text = raw.normalize('NFKC').trim().replace(/^第/, '').replace(/次$/, '')
  if (/^\d+$/.test(text)) { const n = Number(text); return n <= 100000 ? n : undefined }
  if (!/^[零〇一二两三四五六七八九十百千]+$/.test(text)) return undefined
  const digits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  if (!/[十百千]/.test(text)) return Number([...text].map(c => digits[c]).join(''))
  let total = 0, digit = 0
  for (const c of text) {
    const unit = ({ 十: 10, 百: 100, 千: 1000 } as Record<string, number>)[c]
    if (unit) { total += (digit || 1) * unit; digit = 0 } else digit = digits[c]
  }
  return total + digit
}

/** Suggestions only: callers must obtain confirmation before assigning a number. */
export function detectTaskNumbers(rows: AssignmentRow[]): TaskNumberSuggestion[] {
  return rows.flatMap((item, row) => {
    if (item.numberText?.trim()) return [{ row, number: parseNumber(item.numberText), source: `编号列：${item.numberText}` }]
    const name = item.name.normalize('NFKC')
    const numbers = [...name.matchAll(/第\s*([0-9零〇一二两三四五六七八九十百千]+)\s*次|(?:实验(?:报告|验收)?|作业|Homework|Lab)\s*[（(]?\s*([0-9零〇一二两三四五六七八九十百千]+)(?=$|[\s、:：)）])/gi)]
      .map(match => parseNumber(match[1] || match[2])).filter((n): n is number => n !== undefined)
    if (!numbers.length) return []
    const unique = [...new Set(numbers)]
    return [{ row, number: unique.length === 1 ? unique[0] : undefined, source: `任务名称：${item.name}${unique.length > 1 ? '（多个编号，请选择）' : ''}` }]
  })
}
