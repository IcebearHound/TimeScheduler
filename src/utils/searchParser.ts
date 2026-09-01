import { getStartOfWeek } from './dateUtils'

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

export const EN_TO_CN: Record<string, string> = {
  location: '地点', teacher: '授课老师', courseCode: '课序号',
  examForm: '考试形式', supervisor: '监考老师',
  labTeacher: '实验指导老师', labContent: '实验内容',
}

type DatePredicate = (date: Date) => boolean

function isSameLocalDate(date: Date, target: Date): boolean {
  return date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
}

function createExactDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null
}

function removeToken(text: string, token: string): string {
  return text.split(token).join(' ')
}

export function parseTimeQuery(q: string, referenceDate: Date = new Date()): { text: string; dateFilter?: DatePredicate } {
  const now = referenceDate
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const predicates: DatePredicate[] = []
  let text = q

  const relativeDays: Array<[string, number]> = [['今天', 0], ['明天', 1], ['后天', 2]]
  for (const [label, offset] of relativeDays) {
    if (!text.includes(label)) continue
    const target = new Date(today)
    target.setDate(target.getDate() + offset)
    predicates.push(date => isSameLocalDate(date, target))
    text = removeToken(text, label)
  }

  const weekRanges: Array<[string, number]> = [['本周', 0], ['下周', 1]]
  for (const [label, offset] of weekRanges) {
    if (!text.includes(label)) continue
    const start = getStartOfWeek(today, 1)
    start.setDate(start.getDate() + offset * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    predicates.push(date => date >= start && date < end)
    text = removeToken(text, label)
  }

  for (let i = 0; i < 7; i++) {
    const label = `周${DAY_NAMES[i]}`
    if (!text.includes(label)) continue
    predicates.push(date => date.getDay() === i)
    text = removeToken(text, label)
  }

  const timePattern = /(\d{1,2}):(\d{2})/g
  const timeMatches = [...text.matchAll(timePattern)]
  for (const match of timeMatches) {
    const hour = Number(match[1])
    const minute = Number(match[2])
    predicates.push(hour <= 23 && minute <= 59
      ? date => date.getHours() === hour && date.getMinutes() === minute
      : () => false)
  }
  text = text.replace(timePattern, ' ')

  const fullDatePattern = /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/g
  const fullDateMatches = [...text.matchAll(fullDatePattern)]
  for (const match of fullDateMatches) {
    const target = createExactDate(Number(match[1]), Number(match[2]), Number(match[3]))
    predicates.push(target ? date => isSameLocalDate(date, target) : () => false)
  }
  text = text.replace(fullDatePattern, ' ')

  const shortDatePattern = /(\d{1,2})[-\/](\d{1,2})/g
  const shortDateMatches = [...text.matchAll(shortDatePattern)]
  for (const match of shortDateMatches) {
    const target = createExactDate(today.getFullYear(), Number(match[1]), Number(match[2]))
    predicates.push(target ? date => isSameLocalDate(date, target) : () => false)
  }
  text = text.replace(shortDatePattern, ' ')

  const normalizedText = text.replace(/\s+/g, ' ').trim()
  return predicates.length > 0
    ? { text: normalizedText, dateFilter: date => predicates.every(predicate => predicate(date)) }
    : { text: normalizedText }
}
